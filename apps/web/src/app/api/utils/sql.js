import { neon } from '@neondatabase/serverless';

function normalizeDatabaseUrl(rawValue) {
  if (typeof rawValue !== 'string') return undefined;
  const trimmed = rawValue.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/^['"]|['"]$/g, '');
}

const NullishQueryFunction = () => {
  throw new Error(
    'No database connection string was provided to `neon()`. Perhaps process.env.DATABASE_URL has not been set'
  );
};
NullishQueryFunction.transaction = () => {
  throw new Error(
    'No database connection string was provided to `neon()`. Perhaps process.env.DATABASE_URL has not been set'
  );
};
const databaseUrl = normalizeDatabaseUrl(process.env.DATABASE_URL);
const sql = databaseUrl ? neon(databaseUrl) : NullishQueryFunction;

export default sql;
