import { AsyncLocalStorage } from 'node:async_hooks';
import nodeConsole from 'node:console';
import Credentials from '@auth/core/providers/credentials';
import { authHandler, initAuthConfig } from '@hono/auth-js';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { verify as argonVerify } from 'argon2';
import { Hono } from 'hono';
import { contextStorage, getContext } from 'hono/context-storage';
import { cors } from 'hono/cors';
import { proxy } from 'hono/proxy';
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

// Ensure Node standard Crypto global object is mapped securely for stable JWT signing on cloud environments
if (typeof globalThis.crypto === 'undefined') {
  try {
    const { webcrypto } = require('node:crypto');
    if (webcrypto) {
      globalThis.crypto = webcrypto;
    }
  } catch (e) {
    // Fallback safe bypass
  }
}

const app = new Hono();

// Your main app stack initialization safely continues here...
app.route(API_BASENAME, api);

// CLEANWORKING DEBUG ROUTE (Safe fallback check)
app.get('/debug-password', async (c) => {
  try {
    const typedPassword = "test1234";
    const storedHash = "$argon2id$v=19$m=65536,t=3,p=4$bnD9EDl1+6DKYy1Z73EUhg$Mm0jML+ZdxLg/+4m36M4UjVRK1g0MDgS3JfL8av0clk";
    
    const isMatch = await argonVerify(storedHash, typedPassword);
    return c.json({ 
      match: isMatch,
      status: "Success",
      message: isMatch ? "The password matches perfectly" : "Password hash mismatch on runtime environment"
    });
  } catch (err) {
    return c.json({ status: "Error", error: String(err) });
  }
});

export default createHonoServer({
  app,
  defaultLogger: false,
});
