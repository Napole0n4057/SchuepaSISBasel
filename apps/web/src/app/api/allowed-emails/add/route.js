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
    const { email } = body;

    if (!email || typeof email !== "string") {
      return Response.json(
        { error: "Missing or invalid email" },
        { status: 400 },
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email already exists
    const existing = await sql`
      SELECT id FROM allowed_emails WHERE email = ${normalizedEmail}
    `;

    if (existing.length > 0) {
      return Response.json(
        { error: "Email already in allowed list" },
        { status: 400 },
      );
    }

    const result = await sql`
      INSERT INTO allowed_emails (email)
      VALUES (${normalizedEmail})
      RETURNING id, email, added_at
    `;

    return Response.json({ email: result[0] });
  } catch (err) {
    console.error("POST /api/allowed-emails/add error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
