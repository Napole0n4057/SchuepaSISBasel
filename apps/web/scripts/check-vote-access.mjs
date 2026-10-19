// Optional PostgreSQL verification using synthetic CTE fixtures only.
// Run: node --env-file=.env scripts/check-vote-access.mjs
// Every statement runs in a READ ONLY transaction; no stored rows are changed.
import assert from "node:assert/strict";
import { neon } from "@neondatabase/serverless";
import { CAST_VOTE_SQL, VISIBLE_VOTES_SQL } from "../src/app/api/utils/voteAccess.js";

const rawUrl = process.env.DATABASE_URL?.trim().replace(/^['"]|['"]$/g, "");
if (!rawUrl) throw new Error("DATABASE_URL is required for the read-only PostgreSQL checks");
const sql = neon(rawUrl);
const id = (value) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const uuid = (value) => `'${id(value)}'::uuid`;
const future = "(statement_timestamp() AT TIME ZONE 'UTC') + interval '1 hour'";
const past = "(statement_timestamp() AT TIME ZONE 'UTC') - interval '1 hour'";
const fixtures = `
  user_roles(user_id, designation) AS (VALUES
    (${uuid(101)}, 'member'), (${uuid(102)}, 'member'), (${uuid(103)}, 'member'),
    (${uuid(104)}, 'admin'), (${uuid(105)}, 'spectator')),
  student_classes(user_id, programme, year) AS (VALUES
    (${uuid(101)}, 'Gym', 2), (${uuid(102)}, 'Int', 3)),
  auth_users(id, email) AS (SELECT user_id, 'fixture@example.invalid' FROM user_roles),
  votes(id, title, created_by, admin_only, ends_at, is_active, created_at, deleted_at) AS (VALUES
    (${uuid(1)}, 'School', ${uuid(104)}, false, NULL::timestamp, true, ${past}, NULL::timestamp),
    (${uuid(2)}, 'Gym 2', ${uuid(104)}, false, ${future}, true, ${past}, NULL::timestamp),
    (${uuid(3)}, 'Two classes', ${uuid(104)}, false, ${future}, true, ${past}, NULL::timestamp),
    (${uuid(4)}, 'Legacy', ${uuid(104)}, false, ${future}, true, ${past}, NULL::timestamp),
    (${uuid(5)}, 'Expired class', ${uuid(104)}, false, ${past}, true, ${past}, NULL::timestamp),
    (${uuid(6)}, 'Past admin', ${uuid(104)}, true, ${past}, true, ${past}, NULL::timestamp),
    (${uuid(7)}, 'Active admin', ${uuid(104)}, true, ${future}, true, ${past}, NULL::timestamp),
    (${uuid(8)}, 'Deleted', ${uuid(104)}, false, ${future}, true, ${past}, ${past}),
    (${uuid(9)}, 'Inactive', ${uuid(104)}, false, NULL::timestamp, NULL::boolean, ${past}, NULL::timestamp),
    (${uuid(10)}, 'At deadline', ${uuid(104)}, false, statement_timestamp() AT TIME ZONE 'UTC', true, ${past}, NULL::timestamp)),
  vote_classes(vote_id, class_name) AS (VALUES
    (${uuid(2)}, 'Gym 2'), (${uuid(3)}, 'Gym 2'), (${uuid(3)}, 'Int 3'),
    (${uuid(4)}, 'G4'), (${uuid(5)}, 'Int 6')),
  vote_options(vote_id, id) AS (SELECT id, id FROM votes),
`;
const fixtureQuery = (query) => query.replace(/^WITH /, `WITH ${fixtures}`);
const read = async (query, params) => (await sql.transaction([sql(query, params)], { readOnly: true }))[0];
let checks = 0;

for (const [viewer, expected] of [
  [101, [1, 2, 3, 5, 9, 10]], [102, [1, 3, 5, 9, 10]],
  [103, [1, 5, 9, 10]], [106, [1, 5, 9, 10]],
  [104, [1, 2, 3, 4, 5, 6, 7, 9, 10]], [105, [1, 2, 3, 4, 5, 6, 7, 9, 10]],
]) {
  const rows = await read(fixtureQuery(VISIBLE_VOTES_SQL), [id(viewer), null]);
  assert.deepEqual(rows.map((vote) => vote.id).sort(), expected.map(id).sort(), `visibility for viewer ${viewer}`);
  for (const vote of rows) {
    assert.equal(vote.status, [5, 6, 9, 10].map(id).includes(vote.id) ? "past" : "active");
  }
  checks++;
}

// Check a direct lookup uses exactly the same visibility rules as the full list.
for (const [viewer, vote, visible] of [[101, 2, true], [103, 2, false], [103, 5, true], [103, 6, false]]) {
  const rows = await read(fixtureQuery(VISIBLE_VOTES_SQL), [id(viewer), id(vote)]);
  assert.equal(rows.length, visible ? 1 : 0);
  checks++;
}

// Execute the real INSERT's eligibility SELECT without writing anything.
// Keep EXPLAIN separate (without ANALYZE) to validate the complete upsert syntax.
const castSelection = CAST_VOTE_SQL.replace(/INSERT INTO user_votes \([^)]*\)\s*/, "").split(/\s+ON CONFLICT/)[0];
for (const [viewer, vote, allowed] of [
  [101, 1, true], [101, 2, true], [102, 2, false], [102, 3, true],
  [103, 1, true], [103, 2, false], [103, 3, false], [101, 4, false],
  [101, 5, false], [104, 5, false], [104, 6, false], [101, 7, false],
  [104, 7, true], [104, 2, true], [105, 1, false], [105, 2, false],
  [105, 7, false], [101, 8, false], [101, 9, false], [101, 10, false],
]) {
  const rows = await read(fixtureQuery(castSelection), [id(viewer), id(vote), id(vote)]);
  assert.equal(rows.length, allowed ? 1 : 0, `cast eligibility for viewer ${viewer}, vote ${vote}`);
  checks++;
}
const wrongOption = await read(fixtureQuery(castSelection), [id(101), id(2), id(3)]);
assert.equal(wrongOption.length, 0);
checks++;
await read(`EXPLAIN ${fixtureQuery(CAST_VOTE_SQL)}`, [id(101), id(2), id(2)]);
checks++;
console.log(`Passed ${checks} read-only PostgreSQL checks (synthetic fixtures; no data changes).`);
