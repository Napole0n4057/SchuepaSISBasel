import { AsyncLocalStorage } from 'node:async_hooks';
import nodeConsole from 'node:console';
import { webcrypto } from 'node:crypto';
import Credentials from '@auth/core/providers/credentials';
import { authHandler, initAuthConfig } from '@hono/auth-js';
import { Pool, neonConfig } from '@neondatabase/serverless';
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
}

if (process.env.AUTH_SECRET) {
  const authSecret = normalizeEnvValue(process.env.AUTH_SECRET);
  const authUrl = normalizeEnvValue(process.env.AUTH_URL);
  const isSecureCookie =
    typeof process.env.AUTH_URL === 'string' &&
    process.env.AUTH_URL.startsWith('https');
    typeof authUrl === 'string' && authUrl.startsWith('https');

  const sharedCookieOptions = {
    secure: isSecureCookie,
    sameSite: (isSecureCookie ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
  };

  app.use(
    '*',
    initAuthConfig((c) => ({
      secret: c.env.AUTH_SECRET,
      secret: authSecret ?? c.env.AUTH_SECRET,
      trustHost: true,
      pages: {
        signIn: '/account/signin',
      cookies: {
        csrfToken: {
          options: {
            secure: isSecureCookie,
            sameSite: isSecureCookie ? 'none' : 'lax',
            ...sharedCookieOptions,
          },
        },
        sessionToken: {
          options: {
            secure: isSecureCookie,
            sameSite: isSecureCookie ? 'none' : 'lax',
            ...sharedCookieOptions,
          },
        },
        callbackUrl: {
          options: {
            secure: isSecureCookie,
            sameSite: isSecureCookie ? 'none' : 'lax',
            ...sharedCookieOptions,
          },
        },
      },
            if (!user) {
              return null;
            }
            const credentialProviderIds = new Set([
              'credentials',
              'credentials-signin',
            ]);
            const matchingAccount = user.accounts.find(
              (account) => account.provider === 'credentials'
              (account) => credentialProviderIds.has(account.provider)
            );
            const accountPassword = matchingAccount?.password;
            if (!accountPassword) {
              return null;
            }

            // return user object with the their profile data
            return user;
            // Return only the Auth.js user fields.
            return {
              id: user.id,
              name: user.name,
              email: user.email,
              image: user.image,
              emailVerified: user.emailVerified ?? null,
            };
          },
        }),
      ],
