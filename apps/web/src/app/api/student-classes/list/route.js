import sql from "../../../../app/api/utils/sql.js";
import { auth } from "../../../../auth.js";

async function canManageClasses(session) {
  if (!session?.user?.id) return false;
  const roles = await sql`
    SELECT designation
    FROM user_roles
    WHERE user_id = ${session.user.id}
    LIMIT 1
  `;
  return roles.some(({ designation }) =>
    ["admin", "spectator"].includes(designation),
  );
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await canManageClasses(session))) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const students = await sql`
      SELECT ur.user_id, ur.email, au.name, sc.programme, sc.year, sc.class_name, sc.review_required, ur.designation
      FROM user_roles ur
      JOIN auth_users au ON au.id = ur.user_id
      LEFT JOIN student_classes sc ON sc.user_id = ur.user_id
      WHERE ur.designation IN ('admin', 'member', 'spectator')
        AND (ur.designation <> 'admin' OR EXISTS (SELECT 1 FROM user_roles actor WHERE actor.user_id = ${session.user.id} AND actor.designation = 'admin'))
      ORDER BY COALESCE(au.name, ur.email), ur.email
    `;
    return Response.json({ students });
  } catch (err) {
    console.error("GET /api/student-classes/list error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
