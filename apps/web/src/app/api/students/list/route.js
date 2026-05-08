import { auth } from "../../../../auth.js";
import sql from "../../../../app/api/utils/sql.js";
import { readStudents } from "../../../../app/api/utils/studentStore.js";

export async function GET() {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUserRole = await sql`
      SELECT designation
      FROM user_roles
      WHERE user_id = ${session.user.id}
      LIMIT 1
    `;

    if (
      currentUserRole.length === 0 ||
      currentUserRole[0].designation !== "admin"
    ) {
      return Response.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 },
      );
    }

    const students = await readStudents();
    return Response.json({
      students: students.map((s) => ({
        email: s.email,
        created_at: s.createdAt,
      })),
    });
  } catch (err) {
    console.error("GET /api/students/list error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
