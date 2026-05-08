import sql from "../../../../app/api/utils/sql.js";
import { auth } from "../../../../auth.js";

export async function GET() {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if current user is admin
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

    const rows = await sql`
      SELECT id, email, added_at
      FROM allowed_emails
      ORDER BY added_at DESC
    `;

    return Response.json({ emails: rows });
  } catch (err) {
    console.error("GET /api/allowed-emails/list error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
