import { auth } from "../../../../auth.js";
import sql from "../../../../app/api/utils/sql.js";
import { removeStudent } from "../../../../app/api/utils/studentStore.js";

export async function POST(request) {
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

    const body = await request.json();
    const { email } = body;

    if (!email) {
      return Response.json({ error: "Missing email" }, { status: 400 });
    }

    await removeStudent(email.toLowerCase().trim());
    return Response.json({ success: true });
  } catch (err) {
    console.error("POST /api/students/remove error", err);
    return Response.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
