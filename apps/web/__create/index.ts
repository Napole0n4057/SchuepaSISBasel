import { AsyncLocalStorage } from 'node:async_hooks';
import nodeConsole from 'node:console';
import { webcrypto } from 'node:crypto';
import Credentials from '@auth/core/providers/credentials';
import { CredentialsSignin } from '@auth/core/errors';
import { authHandler, initAuthConfig } from '@hono/auth-js';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { verify as argonVerify } from 'argon2';
import { Hono } from 'hono';
import { contextStorage } from 'hono/context-storage';
import { cors } from 'hono/cors';
import { proxy } from 'hono/proxy';
import { bodyLimit } from 'hono/body-limit';
import { requestId } from 'hono/request-id';
import { createHonoServer } from 'react-router-hono-server/node';
import { getConnInfo } from '@hono/node-server/conninfo';
import { serializeError } from 'serialize-error';
import {
  clearAccountSourceFailures,
  createLoginRateLimitBuckets,
  getConnectionPeerIp,
  isLoginRateLimited,
  recordLoginFailure,
} from '../src/auth/loginRateLimit';
import ws from 'ws';
import NeonAdapter from './adapter';
import { getHTMLForErrorPage } from './get-html-for-error-page';
import { API_BASENAME, api } from './route-builder';
import { baselCalendarDate, processDueStudentClassRollovers } from '../src/studentClassRollovers.js';

neonConfig.webSocketConstructor = ws;

// Auth.js JWT encode/decode relies on global WebCrypto in Node.
if (typeof globalThis.crypto === 'undefined' && webcrypto) {
  // @ts-expect-error Node WebCrypto is compatible here.
  globalThis.crypto = webcrypto;
}

function normalizeDatabaseUrl(rawValue?: string): string | undefined {
  if (typeof rawValue !== 'string') return undefined;
  const trimmed = rawValue.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/^['"]|['"]$/g, '');
}

function normalizeEnvValue(rawValue?: string): string | undefined {
  if (typeof rawValue !== 'string') return undefined;
  const trimmed = rawValue.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/^['"]|['"]$/g, '');
}

const als = new AsyncLocalStorage<{ requestId: string }>();

for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
  const original = nodeConsole[method].bind(console);

  console[method] = (...args: unknown[]) => {
    const requestId = als.getStore()?.requestId;
    if (requestId) {
      original(`[traceId:${requestId}]`, ...args);
    } else {
      original(...args);
    }
  };
}

const pool = new Pool({
  connectionString: normalizeDatabaseUrl(process.env.DATABASE_URL),
});
const adapter = NeonAdapter(pool);

class RateLimitedCredentialsSignin extends CredentialsSignin {
  constructor() {
    super();
    this.code = 'rate_limited';
  }
}

class RateLimiterUnavailableSignin extends CredentialsSignin {
  constructor() {
    super();
    this.code = 'unavailable';
  }
}

const app = new Hono();
let completedRolloverCheckDate: string | undefined;
let lastRolloverAttemptDate: string | undefined;
let lastRolloverAttemptAt = 0;

app.use('*', requestId());

app.use('*', (c, next) => {
  const requestId = c.get('requestId');
  return als.run({ requestId }, () => next());
});

app.use(contextStorage());

app.onError((err, c) => {
  if (!import.meta.env.DEV) {
    console.error('Unhandled application error', err);

    if (c.req.method !== 'GET') {
      return c.json({ error: 'Internal Server Error' }, 500);
    }

    return c.html(
      getHTMLForErrorPage({
        name: 'Error',
        message: 'Internal Server Error',
      }),
      500
    );
  }

  if (c.req.method !== 'GET') {
    return c.json(
      {
        error: 'An error occurred in your app',
        details: serializeError(err),
      },
      500
    );
  }
  return c.html(getHTMLForErrorPage(err), 200);
});

// Process a due school-year rollover on the first request for that Basel date.
// The database marker makes this safe across requests and Render instances.
app.use('*', async (c, next) => {
  const today = baselCalendarDate();
  const now = Date.now();
  if (
    completedRolloverCheckDate !== today &&
    (lastRolloverAttemptDate !== today || now - lastRolloverAttemptAt >= 60_000)
  ) {
    lastRolloverAttemptDate = today;
    lastRolloverAttemptAt = now;
    try {
      await processDueStudentClassRollovers(
        (strings: TemplateStringsArray, ...values: unknown[]) => {
          const query = strings.reduce(
            (text, part, index) =>
              text + part + (index < values.length ? `$${index + 1}` : ''),
            ''
          );
          return pool.query(query, values).then((result) => result.rows);
        },
        today
      );
      completedRolloverCheckDate = today;
    } catch {
      // Keep serving normal requests and retry after a short delay if Neon is
      // temporarily unavailable. A failed SQL statement cannot claim a year.
      console.error('Student class rollover check failed');
    }
  }
  return next();
});

if (process.env.CORS_ORIGINS) {
  app.use(
    '/*',
    cors({
      origin: process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim()),
    })
  );
}
const MAX_BODY_SIZE = 4.5 * 1024 * 1024;

if (import.meta.env.DEV) {
  // Vite's dev server provides a Request implementation that Hono's
  // bodyLimit middleware cannot safely re-wrap with `new Request(...)`.
  // Check the declared size without replacing the Request object.
  for (const method of ['post', 'put', 'patch'] as const) {
    app[method]('*', async (c, next) => {
      const contentLength = c.req.header('content-length');

      if (
        contentLength &&
        Number.parseInt(contentLength, 10) > MAX_BODY_SIZE
      ) {
        return c.json({ error: 'Body size limit exceeded' }, 413);
      }

      return next();
    });
  }
} else {
  for (const method of ['post', 'put', 'patch'] as const) {
    app[method](
      '*',
      bodyLimit({
        maxSize: MAX_BODY_SIZE,
        onError: (c) => {
          return c.json({ error: 'Body size limit exceeded' }, 413);
        },
      })
    );
  }
}

app.use(
  '/api/auth/*',
  initAuthConfig((c) => {
    const authSecret = normalizeEnvValue(c.env.AUTH_SECRET ?? process.env.AUTH_SECRET);

    return {
      adapter,
      secret: authSecret,
      basePath: '/api/auth',
      trustHost: true,
      // AUTH_URL is also used for the public origin and secure-cookie setup.
      // Auth.js warns whenever it is set alongside an explicit basePath,
      // even though this Hono route must keep its /api/auth path. Filter only
      // that redundant warning and keep forwarding all other Auth.js warnings.
      logger: {
        warn(code) {
          if (code !== 'env-url-basepath-redundant') {
            console.warn(
              `[auth][warn][${code}]`,
              `Read more: https://warnings.authjs.dev#${code}`
            );
          }
        },
      },
      pages: {
        signIn: '/account/signin',
        signOut: '/account/logout',
      },
      session: {
        strategy: 'jwt',
      },
      callbacks: {
        session({ session, token }) {
          if (token.sub) {
            session.user.id = token.sub;
          }
          return session;
        },
      },
      providers: [
        Credentials({
          id: 'credentials',
          name: 'Credentials Sign in',
          credentials: {
            email: {
              label: 'Email',
              type: 'email',
            },
            password: {
              label: 'Password',
              type: 'password',
            },
          },
          authorize: async (credentials) => {
            const email = credentials?.email;
            const password = credentials?.password;

            if (typeof email !== 'string' || typeof password !== 'string') {
              return null;
            }

            const normalizedEmail = email.trim().toLowerCase();
            if (!normalizedEmail || normalizedEmail.length > 320 || password.length > 1024) {
              return null;
            }

            let rateLimitBuckets;
            try {
              const clientIp = getConnectionPeerIp(getConnInfo(c).remote.address, {
                development: import.meta.env.DEV,
              });
              rateLimitBuckets = createLoginRateLimitBuckets({
                email: normalizedEmail,
                clientIp,
                secret: authSecret,
              });
              if (await isLoginRateLimited(pool, rateLimitBuckets)) {
                throw new RateLimitedCredentialsSignin();
              }
            } catch (error) {
              if (error instanceof RateLimitedCredentialsSignin) throw error;
              console.error('Credential sign-in rate-limit check failed');
              throw new RateLimiterUnavailableSignin();
            }

            const recordFailure = async () => {
              try {
                await recordLoginFailure(pool, rateLimitBuckets);
              } catch {
                console.error('Credential sign-in failure could not be recorded');
                throw new RateLimiterUnavailableSignin();
              }
              return null;
            };

            const user = await adapter.getUserByEmail(normalizedEmail);
            if (!user) {
              return recordFailure();
            }

            const credentialsAccount = user.accounts.find(
              (account) => account.provider === 'credentials'
            );
            const passwordHash = credentialsAccount?.password;
            if (!passwordHash) {
              return recordFailure();
            }

            const isValid = await argonVerify(passwordHash, password);
            if (!isValid) {
              return recordFailure();
            }

            try {
              await clearAccountSourceFailures(pool, rateLimitBuckets);
            } catch {
              console.error('Credential sign-in rate-limit state could not be cleared');
              throw new RateLimiterUnavailableSignin();
            }

            return user;
          },
        }),
      ],
    };
  })
);
app.all('/integrations/:path{.+}', async (c) => {
  const queryParams = c.req.query();
  const url = `${process.env.NEXT_PUBLIC_CREATE_BASE_URL ?? 'https://www.create.xyz'}/integrations/${c.req.param('path')}${Object.keys(queryParams).length > 0 ? `?${new URLSearchParams(queryParams).toString()}` : ''}`;

  return proxy(url, {
    method: c.req.method,
    body: c.req.raw.body ?? null,
    // @ts-ignore - this key is accepted even if types not aware and is
    // required for streaming integrations
    duplex: 'half',
    redirect: 'manual',
    headers: {
      ...c.req.header(),
      'X-Forwarded-For': process.env.NEXT_PUBLIC_CREATE_HOST,
      'x-createxyz-host': process.env.NEXT_PUBLIC_CREATE_HOST,
      Host: process.env.NEXT_PUBLIC_CREATE_HOST,
      'x-createxyz-project-group-id': process.env.NEXT_PUBLIC_PROJECT_GROUP_ID,
    },
  });
});

app.all('/api/auth/*', authHandler());
app.route(API_BASENAME, api);

export default createHonoServer({
  app,
  defaultLogger: false,
});
