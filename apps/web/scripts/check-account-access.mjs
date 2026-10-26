// Synthetic fixtures and EXPLAIN without ANALYZE, in READ ONLY transactions.
import assert from "node:assert/strict";
import { neon } from "@neondatabase/serverless";
import {
  ACCOUNT_TARGET_CTE,
  LAST_ADMIN_SQL,
  ACCOUNT_STATEMENTS,
} from "../src/app/api/utils/accountManagement.js";
const sql = neon(process.env.DATABASE_URL.trim().replace(/^['"]|['"]$/g, ""));
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const fixture = (
  oneAdmin = false,
) => `user_roles(user_id, designation) AS (VALUES
  ('${id(1)}'::uuid, 'member'), ('${id(2)}'::uuid, 'spectator'), ('${id(3)}'::uuid, 'admin')${oneAdmin ? "" : `, ('${id(4)}'::uuid, 'admin')`}), `;
const read = async (query, params) =>
  (await sql.transaction([sql(query, params)], { readOnly: true }))[0];
let checks = 0;
for (const actor of [1, 2, 3])
  for (const target of [1, 2, 3, 99]) {
    const query =
      ACCOUNT_TARGET_CTE.replace(/^WITH /, `WITH ${fixture()}`) +
      " SELECT * FROM target";
    const rows = await read(query, [id(actor), id(target)]);
    const expected =
      target !== 99 &&
      (actor === 3 || (actor === 2 && [1, 2].includes(target)));
    assert.equal(rows.length > 0, expected, `actor ${actor}, target ${target}`);
    checks++;
  }
for (const oneAdmin of [true, false]) {
  const cte = ACCOUNT_TARGET_CTE.replace(/^WITH /, `WITH ${fixture(oneAdmin)}`);
  assert.equal(
    (
      await read(`${cte} SELECT * FROM target WHERE ${LAST_ADMIN_SQL}`, [
        id(3),
        id(3),
      ])
    ).length > 0,
    !oneAdmin,
  );
  checks++;
  for (const actor of [2, 3]) {
    const query = `${cte} SELECT * FROM target WHERE EXISTS (SELECT 1 FROM user_roles actor WHERE actor.user_id = $1::uuid AND actor.designation = 'admin') AND ($3 = 'admin' OR ${LAST_ADMIN_SQL})`;
    for (const designation of ["member", "admin"]) {
      const rows = await read(query, [id(actor), id(actor), designation]);
      assert.equal(
        rows.length > 0,
        actor === 3 && (designation === "admin" || !oneAdmin),
      );
      checks++;
    }
  }
}
// Planning confirms actual PostgreSQL syntax without executing any mutation.
for (const [action, params] of [
  ["role", [id(3), id(1), "spectator"]],
  ["password", [id(3), id(1), "synthetic-hash"]],
  ["details", [id(3), id(1), "Synthetic", "synthetic@example.invalid"]],
  ["delete", [id(3), id(1)]],
]) {
  await read(`EXPLAIN ${ACCOUNT_STATEMENTS[action]}`, params);
  checks++;
}
console.log(
  `Passed ${checks} read-only account permission SQL checks. Class writes require the unapplied migration; no migrations executed.`,
);
