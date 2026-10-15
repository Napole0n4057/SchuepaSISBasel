import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';

// Five failures for one account/IP pair or 50 from one IP in 15 minutes trigger a 60-second wait.
export const LOGIN_RATE_LIMIT_POLICY = Object.freeze({
  windowMinutes: 15,
  accountAndSourceFailures: 5,
  sourceFailures: 50,
  cooldownSeconds: 60,
});

export function getConnectionPeerIp(
  remoteAddress: string | undefined,
  { development = false }: { development?: boolean } = {},
) {
  const address = typeof remoteAddress === 'string' ? remoteAddress.trim() : '';
  if (address && isIP(address)) return address.toLowerCase();
  if (development && !address) return '127.0.0.1';
  throw new Error('Trusted client IP is unavailable');
}

function digestBucket(secret: string, value: string) {
  return createHmac('sha256', secret).update(value).digest('hex');
}

export function createLoginRateLimitBuckets({
  email,
  clientIp,
  secret,
}: {
  email: string;
  clientIp: string;
  secret: string | undefined;
}) {
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!normalizedEmail || normalizedEmail.length > 320) {
    throw new Error('Invalid login identity');
  }
  if (typeof secret !== 'string' || secret.trim().length < 32) {
    throw new Error('Login rate limiter is not configured');
  }
  if (typeof clientIp !== 'string' || !isIP(clientIp)) {
    throw new Error('Trusted client IP is unavailable');
  }

  return {
    accountAndSource: {
      hash: digestBucket(secret, `account-source:${normalizedEmail}\0${clientIp}`),
      threshold: LOGIN_RATE_LIMIT_POLICY.accountAndSourceFailures,
    },
    source: {
      hash: digestBucket(secret, `source:${clientIp}`),
      threshold: LOGIN_RATE_LIMIT_POLICY.sourceFailures,
    },
  };
}

type Buckets = ReturnType<typeof createLoginRateLimitBuckets>;

type NeonPool = {
  query: (query: string, values?: unknown[]) => Promise<{ rowCount: number | null; rows: unknown[] }>;
};

export async function isLoginRateLimited(client: NeonPool, buckets: Buckets) {
  const result = await client.query(
    `SELECT 1
     FROM login_rate_limit_buckets
     WHERE bucket_hash = ANY($1::text[])
       AND blocked_until > NOW()
     LIMIT 1`,
    [[buckets.accountAndSource.hash, buckets.source.hash]],
  );
  return (result.rowCount ?? result.rows.length) > 0;
}

export async function recordLoginFailure(client: NeonPool, buckets: Buckets) {
  await client.query(
    `DELETE FROM login_rate_limit_buckets
     WHERE updated_at < NOW() - INTERVAL '1 day'`,
  );

  await client.query(
    `INSERT INTO login_rate_limit_buckets
       (bucket_hash, failures, max_failures, window_started_at, blocked_until, updated_at)
     SELECT bucket_hash, 1, max_failures, NOW(), NULL, NOW()
     FROM unnest($1::text[], $2::integer[]) AS input(bucket_hash, max_failures)
     ON CONFLICT (bucket_hash) DO UPDATE SET
       failures = CASE
         WHEN login_rate_limit_buckets.window_started_at <= NOW() - ($3::integer * INTERVAL '1 minute') THEN 1
         ELSE login_rate_limit_buckets.failures + 1
       END,
       max_failures = EXCLUDED.max_failures,
       window_started_at = CASE
         WHEN login_rate_limit_buckets.window_started_at <= NOW() - ($3::integer * INTERVAL '1 minute') THEN NOW()
         ELSE login_rate_limit_buckets.window_started_at
       END,
       blocked_until = CASE
         WHEN login_rate_limit_buckets.window_started_at <= NOW() - ($3::integer * INTERVAL '1 minute') THEN NULL
         WHEN login_rate_limit_buckets.failures + 1 >= EXCLUDED.max_failures
           THEN NOW() + ($4::integer * INTERVAL '1 second')
         ELSE NULL
       END,
       updated_at = NOW()`,
    [
      [buckets.accountAndSource.hash, buckets.source.hash],
      [buckets.accountAndSource.threshold, buckets.source.threshold],
      LOGIN_RATE_LIMIT_POLICY.windowMinutes,
      LOGIN_RATE_LIMIT_POLICY.cooldownSeconds,
    ],
  );
}

export async function clearAccountSourceFailures(client: NeonPool, buckets: Buckets) {
  await client.query(
    `DELETE FROM login_rate_limit_buckets WHERE bucket_hash = $1`,
    [buckets.accountAndSource.hash],
  );
}
