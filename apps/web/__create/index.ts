import { AsyncLocalStorage } from 'node:async_hooks';
import nodeConsole from 'node:console';
import Credentials from '@auth/core/providers/credentials';
import { authHandler, initAuthConfig } from '@hono/auth-js';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { verify as argonVerify } from 'argon2';
import { Hono } from 'hono';
import { contextStorage, getContext } from 'hono/context-storage';
import { cors } from 'hono/cors';
import { bodyLimit } from 'hono/body-limit';
import { requestId } from 'hono/request-id';
import { createHonoServer } from 'react-router-hono-server/node';
import { serializeError } from 'serialize-error';
import ws from 'ws';

import NeonAdapter from './adapter';
import { getHTMLForErrorPage } from './get-html-for-error-page';
import { isAuthAction } from './is-auth-action';
import { API_BASENAME, api } from './route-builder';

neonConfig.webSocketConstructor = ws;

if (typeof globalThis.crypto === 'undefined') {
  try {
    const { webcrypto } = require('node:crypto');
    if (webcrypto) {
      globalThis.crypto = webcrypto;
    }
  } catch (e) {
    // Fail-safe fallback
  }
}

const app = new Hono();

app.use('*', requestId());
app.use('*', contextStorage());

const dynamicAuthorizeHook = async (credentials: Record<string, unknown> | undefined) => {
  // Log the exact keys to Render console so we can see what the frontend layout calls the input fields
  console.log("Incoming auth submission keys:", credentials ? Object.keys(credentials) : "none");

  // Extract password from any potential naming variant
  const inputPassword = (credentials?.password || credentials?.Passwort || '') as string;
  if (!inputPassword) return null;

  const storedHash = "$argon2id$v=19$m=65536,t=3,p=4$bnD9EDl1+6DKYy1Z73EUhg$Mm0jML+ZdxLg/+4m36M4UjVRK1g0MDgS3JfL8av0clk";
  const verified = await argonVerify(storedHash, inputPassword.trim());

  // ULTIMATE FAIL-SAFE: If the password matches your Argon2 hash perfectly, let the login pass.
  // This bypasses any frontend email field naming bugs completely.
  if (verified) {
    return { id: 'user-1', email: 'viggo.bang-larsen@sis-basel.ch', name: 'Viggo' };
  }

  return null;
};

app.use(
  '/api/auth/*',
  initAuthConfig((c) => ({
    secret: process.env.AUTH_SECRET || c.env?.AUTH_SECRET,
    trustHost: true,
    providers: [
      Credentials({
        id: 'credentials',
        name: 'Credentials',
        authorize: dynamicAuthorizeHook
      }),
      Credentials({
        id: 'credentials-signin',
        name: 'Credentials Signin',
        authorize: dynamicAuthorizeHook
      })
    ],
  }))
);

app.all('/api/auth/*', authHandler());
app.route(API_BASENAME, api);

export default createHonoServer({
  app,
  defaultLogger: false,
});
