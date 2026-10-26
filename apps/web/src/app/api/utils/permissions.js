import sql from "./sql.js";
export async function getRole(userId) {
  const rows =
    await sql`SELECT designation FROM user_roles WHERE user_id = ${userId} LIMIT 1`;
  return rows[0]?.designation ?? null;
}
// Run account mutations under one lock. Each subsequent statement sees a fresh
// READ COMMITTED snapshot, including changes by an earlier manager. This also
// serializes last-admin checks across deletion, demotion and password resets.
export async function accountMutation(query) {
  const results = await sql.transaction((tx) => [
    tx`LOCK TABLE user_roles IN SHARE ROW EXCLUSIVE MODE`,
    query(tx),
  ]);
  return results[1];
}
