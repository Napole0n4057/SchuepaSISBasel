import { describe, expect, it, vi } from 'vitest';
import {
  LOGIN_RATE_LIMIT_POLICY,
  clearAccountSourceFailures,
  createLoginRateLimitBuckets,
  getTrustedClientIp,
  isLoginRateLimited,
  recordLoginFailure,
} from './loginRateLimit';

const secret = 'test-secret-that-is-at-least-thirty-two-characters-long';

describe('login rate limiting', () => {
  it('uses the rightmost IP appended by the trusted Render proxy', () => {
    expect(getTrustedClientIp('203.0.113.9')).toBe('203.0.113.9');
    expect(getTrustedClientIp('198.51.100.77, 203.0.113.9')).toBe('203.0.113.9');
    expect(() => getTrustedClientIp(undefined)).toThrow('Trusted client IP is unavailable');
    expect(() => getTrustedClientIp('not-an-ip')).toThrow('Trusted client IP is unavailable');
    expect(() => getTrustedClientIp('203.0.113.9, not-an-ip')).toThrow(
      'Trusted client IP is unavailable',
    );
    expect(getTrustedClientIp(undefined, { development: true })).toBe('127.0.0.1');
  });

  it('creates stable, private account and source buckets', () => {
    const first = createLoginRateLimitBuckets({
      email: ' Student@Example.org ',
      clientIp: '203.0.113.9',
      secret,
    });
    const normalized = createLoginRateLimitBuckets({
      email: 'student@example.org',
      clientIp: '203.0.113.9',
      secret,
    });
    const differentAccount = createLoginRateLimitBuckets({
      email: 'another@example.org',
      clientIp: '203.0.113.9',
      secret,
    });

    expect(first).toEqual(normalized);
    expect(first.accountAndSource.hash).not.toContain('student');
    expect(first.accountAndSource.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.accountAndSource.hash).not.toBe(differentAccount.accountAndSource.hash);
    expect(first.source.hash).toBe(differentAccount.source.hash);
    expect(first.accountAndSource.threshold).toBe(5);
    expect(first.source.threshold).toBe(50);
  });

  it('fails closed when Neon reports an active block or a database error', async () => {
    const buckets = createLoginRateLimitBuckets({
      email: 'student@example.org',
      clientIp: '203.0.113.9',
      secret,
    });
    const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [{}] });

    await expect(isLoginRateLimited({ query }, buckets)).resolves.toBe(true);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('blocked_until > NOW()'), [
      [buckets.accountAndSource.hash, buckets.source.hash],
    ]);

    query.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(isLoginRateLimited({ query }, buckets)).rejects.toThrow('database unavailable');
  });

  it('records failures in both shared buckets and clears only the successful account/source pair', async () => {
    const buckets = createLoginRateLimitBuckets({
      email: 'student@example.org',
      clientIp: '203.0.113.9',
      secret,
    });
    const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [] });
    const client = { query };

    await recordLoginFailure(client, buckets);
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1][0]).toContain('ON CONFLICT (bucket_hash) DO UPDATE');
    expect(query.mock.calls[1][1]).toEqual([
      [buckets.accountAndSource.hash, buckets.source.hash],
      [5, 50],
      LOGIN_RATE_LIMIT_POLICY.windowMinutes,
      LOGIN_RATE_LIMIT_POLICY.cooldownSeconds,
    ]);

    await clearAccountSourceFailures(client, buckets);
    expect(query.mock.calls[2][0]).toContain('DELETE FROM login_rate_limit_buckets WHERE bucket_hash = $1');
    expect(query.mock.calls[2][1]).toEqual([buckets.accountAndSource.hash]);
  });

  it('does not swallow failures while writing the shared limiter state', async () => {
    const buckets = createLoginRateLimitBuckets({
      email: 'student@example.org',
      clientIp: '203.0.113.9',
      secret,
    });
    const query = vi.fn().mockRejectedValue(new Error('database unavailable'));

    await expect(recordLoginFailure({ query }, buckets)).rejects.toThrow('database unavailable');
  });
});
