import { AsyncLocalStorage } from 'node:async_hooks';
import nodeConsole from 'node:console';
import { webcrypto } from 'node:crypto';
import Credentials from '@auth/core/providers/credentials';
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
import { serializeError } from 'serialize-error';
import ws from 'ws';
import NeonAdapter from './adapter';
import { getHTMLForErrorPage } from './get-html-for-error-page';
import { API_BASENAME, api } from './route-builder';

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

const app = new Hono();

app.use('*', requestId());

app.use('*', (c, next) => {
  const requestId = c.get('requestId');
  return als.run({ requestId }, () => next());
});

app.use(contextStorage());

app.onError((err, c) => {
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

if (process.env.CORS_ORIGINS) {
  app.use(
    '/*',
    cors({
      origin: process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim()),
    })
  );
}
for (const method of ['post', 'put', 'patch'] as const) {
  app[method](
    '*',
    bodyLimit({
      maxSize: 4.5 * 1024 * 1024, // 4.5mb to match vercel limit
      onError: (c) => {
        return c.json({ error: 'Body size limit exceeded' }, 413);
      },
    })
  );
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
            const user = await adapter.getUserByEmail(normalizedEmail);
            if (!user) {
              return null;
            }

            const credentialsAccount = user.accounts.find(
              (account) => account.provider === 'credentials'
            );
            const passwordHash = credentialsAccount?.password;
            if (!passwordHash) {
              return null;
            }

            const isValid = await argonVerify(passwordHash, password);
            if (!isValid) {
              return null;
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
