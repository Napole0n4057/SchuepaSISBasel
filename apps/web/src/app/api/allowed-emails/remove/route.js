import sql from "../../../../app/api/utils/sql.js";
import { auth } from "../../../../auth.js";

export async function POST(request) {
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

    const body = await request.json();
    const { emailId } = body;

    if (!emailId) {
      return Response.json({ error: "Missing emailId" }, { status: 400 });
    }

    await sql`
      DELETE FROM allowed_emails
      WHERE id = ${emailId}
    `;

    return Response.json({ success: true });
  } catch (err) {
    console.error("POST /api/allowed-emails/remove error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
