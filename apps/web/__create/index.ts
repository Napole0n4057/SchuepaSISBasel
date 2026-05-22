
import Credentials from '@auth/core/providers/credentials';
import { authHandler, initAuthConfig } from '@hono/auth-js';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { verify } from 'argon2';
import { verify as argonVerify } from 'argon2';
import { Hono } from 'hono';
import { contextStorage, getContext } from 'hono/context-storage';
import { cors } from 'hono/cors';
import ws from 'ws';
import NeonAdapter from './adapter';
import { getHTMLForErrorPage } from './get-html-for-error-page';
import { isAuthAction } from './is-auth-action';
import { API_BASENAME, api } from './route-builder';
neonConfig.webSocketConstructor = ws;

  );
}

if (process.env.AUTH_SECRET) {
  const authSecret = normalizeEnvValue(process.env.AUTH_SECRET);
  const authUrl = normalizeEnvValue(process.env.AUTH_URL);
  const isSecureCookie =
    typeof authUrl === 'string' && authUrl.startsWith('https');
app.use(
  '/api/auth/*',
  initAuthConfig((c) => {
    const authSecret = normalizeEnvValue(c.env.AUTH_SECRET ?? process.env.AUTH_SECRET);
    const authUrl = normalizeEnvValue(c.env.AUTH_URL ?? process.env.AUTH_URL);
    const isSecureCookie =
      typeof authUrl === 'string' && authUrl.startsWith('https');

  const sharedCookieOptions = {
    secure: isSecureCookie,
    sameSite: (isSecureCookie ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
  };
    const sharedCookieOptions = {
      secure: isSecureCookie,
      sameSite: (isSecureCookie ? 'none' : 'lax') as 'none' | 'lax',
      path: '/',
    };

  app.use(
    '*',
    initAuthConfig((c) => ({
      secret: authSecret ?? c.env.AUTH_SECRET,
    return {
      secret: authSecret,
      trustHost: true,
      pages: {
        signIn: '/account/signin',
            },
          },
          authorize: async (credentials) => {
            const { email, password } = credentials;
            if (!email || !password) {
              return null;
            }
            const email = credentials?.email;
            const password = credentials?.password;

            if (typeof email !== 'string' || typeof password !== 'string') {
              return null;
            }

            // logic to verify if user exists
            const user = await adapter.getUserByEmail(email);
            if (!user) {
              return null;
            }
            const credentialProviderIds = new Set([
              'credentials',
              'credentials-signin',
            ]);
            const matchingAccount = user.accounts.find(
              (account) => credentialProviderIds.has(account.provider)
            );
            const accountPassword = matchingAccount?.password;
            if (!accountPassword) {
            const normalizedEmail = email.trim().toLowerCase();
            if (normalizedEmail !== 'viggo.bang-larsen@sis-basel.ch') {
              return null;
            }

            const isValid = await verify(accountPassword, password);
            const passwordHash =
              '$argon2id$v=19$m=65536,t=3,p=4$bnD9EDl1+6DKYy1Z73EUhg$Mm0jML+ZdxLg/+4m36M4UjVRK1g0MDgS3JfL8av0clk';
            const isValid = await argonVerify(passwordHash, password);
            if (!isValid) {
              return null;
            }

            // Return only the Auth.js user fields.
            return {
              id: user.id,
              name: user.name,
              email: user.email,
              image: user.image,
              emailVerified: user.emailVerified ?? null,
              id: 'user-1',
