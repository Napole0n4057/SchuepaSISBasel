import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import type { Handler } from 'hono/types';

declare global {
  interface ImportMetaEnv {
    readonly DEV: boolean;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
    glob<T = unknown>(
      pattern: string,
      options?: { eager?: boolean }
    ): Record<string, T>;
  }
}

const API_BASENAME = '/api';
const api = new Hono();

const routeRootCandidates = [
  join(fileURLToPath(new URL('.', import.meta.url)), '../src/app/api'),
  join(process.cwd(), 'src/app/api'),
];

async function resolveRoutesRoot(): Promise<string | null> {
  for (const candidate of routeRootCandidates) {
    try {
      const statResult = await stat(candidate);

      if (statResult.isDirectory()) {
        return candidate;
      }
    } catch {
      // Try next candidate
    }
  }

  return null;
}

async function findRouteFiles(dir: string): Promise<string[]> {
  const files = await readdir(dir);
  let routes: string[] = [];

  for (const file of files) {
    try {
      const filePath = join(dir, file);
      const statResult = await stat(filePath);

      if (statResult.isDirectory()) {
        routes = routes.concat(await findRouteFiles(filePath));
      } else if (file === 'route.js') {
        routes.push(filePath);
      }
    } catch (error) {
      console.error(`Error reading file ${file}:`, error);
    }
  }

  return routes;
}

function getHonoPath(
  routeFile: string,
  routesRoot: string
): { name: string; pattern: string }[] {
  const relativePath = routeFile.replace(routesRoot, '');
  const parts = relativePath.split('/').filter(Boolean);
  const routeParts = parts.slice(0, -1);

  if (routeParts.length === 0) {
    return [{ name: 'root', pattern: '' }];
  }

  return routeParts.map((segment) => {
    const match = segment.match(/^\[(\.{3})?([^\]]+)\]$/);

    if (match) {
      const [, dots, param] = match;

      return dots === '...'
        ? { name: param, pattern: `:${param}{.+}` }
        : { name: param, pattern: `:${param}` };
    }

    return {
      name: segment,
      pattern: segment,
    };
  });
}

export async function registerRoutes() {
  console.log('=== REGISTERING API ROUTES ===');

  const routesRoot = await resolveRoutesRoot();

  if (!routesRoot) {
    api.routes = [];
    return;
  }

  const routeFiles = await findRouteFiles(routesRoot).catch((error) => {
    console.error('Error finding route files:', error);
    return [];
  });

  console.log('=== FOUND API ROUTES ===');
  console.log(routeFiles);

  routeFiles.sort((a, b) => b.length - a.length);

  // Clear existing routes
  api.routes = [];

  for (const routeFile of routeFiles) {
    try {
      const route = await import(
        /* @vite-ignore */
        `${routeFile}?update=${Date.now()}`
      );

      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;

      for (const method of methods) {
        try {
          if (!route[method]) {
            continue;
          }

          const parts = getHonoPath(routeFile, routesRoot);

          const honoPath = `/${parts
            .map(({ pattern }) => pattern)
            .join('/')}`;

          const handler: Handler = async (c) => {
            const params = c.req.param();

            if (import.meta.env.DEV) {
              const updatedRoute = await import(
                /* @vite-ignore */
                `${routeFile}?update=${Date.now()}`
              );

              return await updatedRoute[method](c.req.raw, { params });
            }

            return await route[method](c.req.raw, { params });
          };

          switch (method) {
            case 'GET':
              api.get(honoPath, handler);
              break;

            case 'POST':
              api.post(honoPath, handler);
              break;

            case 'PUT':
              api.put(honoPath, handler);
              break;

            case 'DELETE':
              api.delete(honoPath, handler);
              break;

            case 'PATCH':
              api.patch(honoPath, handler);
              break;
          }
        } catch (error) {
          console.error(
            `Error registering route ${routeFile} for method ${method}:`,
            error
          );
        }
      }
    } catch (error) {
      console.error(`Error importing route file ${routeFile}:`, error);
    }
  }

}

// Hono copies a child app's routes when `app.route()` is called. Wait for
// discovery to finish so the server mounts a populated API router.
try {
  await registerRoutes();
} catch (error) {
  console.error('Error registering routes:', error);
}

if (import.meta.env.DEV) {
  import.meta.glob('../src/app/api/**/route.js', {
    eager: true,
  });

}

export { api, API_BASENAME };
