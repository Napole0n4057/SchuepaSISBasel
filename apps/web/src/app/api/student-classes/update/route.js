import sql from "../../../../app/api/utils/sql.js";
import { auth } from "../../../../auth.js";
import { isValidStudentClass, isValidUserId } from "../../../../studentClasses.js";

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

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await canManageClasses(session))) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { userId, programme, year } = body ?? {};
    if (!isValidUserId(userId) || !isValidStudentClass(programme, year)) {
      return Response.json({ error: "Invalid student class" }, { status: 400 });
    }

    const updated = await sql`
      INSERT INTO student_classes (user_id, programme, year, updated_at)
      SELECT user_id, ${programme}, ${year}, NOW()
      FROM user_roles
      WHERE user_id = ${userId} AND designation = 'member'
      ON CONFLICT (user_id) DO UPDATE
        SET programme = EXCLUDED.programme,
            year = EXCLUDED.year,
            updated_at = NOW()
      RETURNING user_id, programme, year
    `;
    if (updated.length === 0) {
      return Response.json({ error: "Student not found" }, { status: 404 });
    }
    return Response.json({ success: true, student: updated[0] });
  } catch (err) {
    console.error("POST /api/student-classes/update error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
