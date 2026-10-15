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
    process.env.AUTH_URL = 'https://example.org';
    fixtures.getContext.mockReturnValue({ req: { raw: new Request('https://example.org') } });
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
