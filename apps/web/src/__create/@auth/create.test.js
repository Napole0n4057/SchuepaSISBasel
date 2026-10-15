import { beforeEach, describe, expect, it, vi } from 'vitest';

const fixtures = vi.hoisted(() => ({
  getContext: vi.fn(),
  getToken: vi.fn(),
  sql: vi.fn(),
}));

vi.mock('@auth/core/jwt', () => ({ getToken: fixtures.getToken }));
vi.mock('hono/context-storage', () => ({ getContext: fixtures.getContext }));
vi.mock('../../app/api/utils/sql.js', () => ({ default: fixtures.sql }));

import CreateAuth from './create.js';

describe('authenticated account status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_SECRET = 'process-secret-that-is-at-least-thirty-two-characters';
    process.env.AUTH_URL = 'https://example.org';
    fixtures.getContext.mockReturnValue({
      env: {},
      req: { raw: new Request('https://example.org') },
    });
    fixtures.getToken.mockResolvedValue({
      sub: 'user-id',
      email: 'user@example.org',
      exp: 1_800_000_000,
    });
    fixtures.sql.mockResolvedValue([{ active: true }]);
  });

  it('keeps a valid JWT for an active account', async () => {
    const { auth } = CreateAuth();

    await expect(auth()).resolves.toMatchObject({
      user: { id: 'user-id', email: 'user@example.org' },
    });
    expect(fixtures.sql).toHaveBeenCalledOnce();
    expect(fixtures.sql.mock.calls[0][1]).toBe('user-id');
    expect(fixtures.sql.mock.calls[0][0].join(' ')).toContain('au.id = ');
  });

  it('verifies JWTs with the same normalized secret and URL source as auth config', async () => {
    const { auth } = CreateAuth();
    fixtures.getContext.mockReturnValue({
      env: {
        AUTH_SECRET: ' "context-secret-that-is-at-least-thirty-two-characters" ',
        AUTH_URL: 'https://context.example.org',
      },
      req: { raw: new Request('https://context.example.org') },
    });

    await auth();

    expect(fixtures.getToken).toHaveBeenCalledWith({
      req: expect.any(Request),
      secret: 'context-secret-that-is-at-least-thirty-two-characters',
      secureCookie: true,
    });
  });

  it('rejects JWTs for deleted accounts', async () => {
    const { auth } = CreateAuth();
    fixtures.sql.mockResolvedValue([{ active: false }]);

    await expect(auth()).resolves.toBeUndefined();
  });

  it('rejects JWTs when the account has a disabled or unknown role', async () => {
    const { auth } = CreateAuth();
    fixtures.sql.mockResolvedValue([{ active: false }]);

    await expect(auth()).resolves.toBeUndefined();
    expect(fixtures.sql.mock.calls[0][0].join(' ')).toContain(
      "ur.designation NOT IN ('admin', 'member', 'spectator')",
    );
  });

  it('does not accept a token without a subject', async () => {
    const { auth } = CreateAuth();
    fixtures.getToken.mockResolvedValue({ email: 'user@example.org' });

    await expect(auth()).resolves.toBeUndefined();
    expect(fixtures.sql).not.toHaveBeenCalled();
  });
});
