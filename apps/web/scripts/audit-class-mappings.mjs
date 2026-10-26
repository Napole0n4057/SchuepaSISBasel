import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL.trim().replace(/^['"]|['"]$/g, ""));
const [columns] = await sql.transaction(
  [
    sql`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'student_classes' AND column_name = 'class_name'`,
  ],
  { readOnly: true },
);
const classColumn = columns.length ? "class_name" : "NULL::text";
const results = await sql.transaction(
  [
    sql(
      `SELECT programme, year, ${classColumn} AS class_name, count(*)::int AS accounts FROM student_classes GROUP BY 1, 2, 3 ORDER BY 1, 2, 3`,
    ),
    sql`SELECT class_name, count(*)::int AS audiences FROM vote_classes GROUP BY class_name ORDER BY class_name`,
    sql`SELECT designation, count(*)::int AS accounts FROM user_roles GROUP BY designation`,
  ],
  { readOnly: true },
);
console.log(JSON.stringify(results, null, 2));
