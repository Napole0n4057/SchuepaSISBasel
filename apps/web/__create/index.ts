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

// Mount dynamic Auth config using clean, compiler-safe Hono execution parameters
app.use(
  '/api/auth/*',
  initAuthConfig((c) => ({
    secret: process.env.AUTH_SECRET || c.env?.AUTH_SECRET,
    trustHost: true,
    providers: [
      Credentials({
        id: 'credentials-signin',
        name: 'Credentials',
        authorize: async (credentials) => {
          if (!credentials?.email || !credentials?.password) return null;

          const verified = await argonVerify(
            "$argon2id$v=19$m=65536,t=3,p=4$bnD9EDl1+6DKYy1Z73EUhg$Mm0jML+ZdxLg/+4m36M4UjVRK1g0MDgS3JfL8av0clk",
            credentials.password as string
          );

          if (verified && String(credentials.email).toLowerCase() === 'viggo.bang-larsen@sis-basel.ch') {
            return { id: 'user-1', email: String(credentials.email).toLowerCase(), name: 'Viggo' };
          }
          return null;
        },
      }),
    ],
  }))
);

app.all('/api/auth/*', authHandler());
app.route(API_BASENAME, api);

export default createHonoServer({
  app,
  defaultLogger: false,
});
