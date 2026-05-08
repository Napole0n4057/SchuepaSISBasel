import sql from "../../../../app/api/utils/sql.js";
import { auth } from "../../../../auth.js";
import { hash } from "argon2";

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
    const { userId, newPassword } = body;

    if (!userId || !newPassword) {
      return Response.json(
        { error: "Missing userId or newPassword" },
        { status: 400 },
      );
    }

    const targetRole = await sql`
      SELECT designation
      FROM user_roles
      WHERE user_id = ${userId}
      LIMIT 1
    `;

    if (targetRole.length === 0) {
      return Response.json({ error: "User role not found" }, { status: 404 });
    }

    if (targetRole[0].designation !== "member") {
      return Response.json(
        { error: "Only member passwords can be reset" },
        { status: 403 },
      );
    }

    const hashedPassword = await hash(newPassword);

    const updated = await sql`
      UPDATE auth_accounts
      SET password = ${hashedPassword}
      WHERE "userId" = ${userId} AND provider = 'credentials'
      RETURNING id
    `;

    if (updated.length === 0) {
      return Response.json(
        { error: "Credentials account not found" },
        { status: 404 },
      );
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("POST /api/users/reset-password error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
