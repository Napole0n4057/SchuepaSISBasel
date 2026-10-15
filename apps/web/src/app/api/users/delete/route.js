import sql from "../../../../app/api/utils/sql.js";
import { auth } from "../../../../auth.js";

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
    const { userId, confirm } = body;

    if (!userId || confirm !== true) {
      return Response.json(
        { error: "Confirmation required" },
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
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    if (targetRole[0].designation === "admin") {
      const adminCount = await sql`
        SELECT COUNT(*)::int AS admin_count
        FROM user_roles
        WHERE designation = 'admin'
      `;

      if (Number(adminCount[0]?.admin_count || 0) <= 1) {
        return Response.json(
          { error: "Cannot delete the last admin account" },
          { status: 409 },
        );
      }
    }

    const userExists = await sql`
      SELECT id
      FROM auth_users
      WHERE id = ${userId}
      LIMIT 1
    `;

    if (userExists.length === 0) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    await sql.transaction((tx) => [
      tx`DELETE FROM auth_sessions WHERE "userId" = ${userId}`,
      tx`DELETE FROM auth_accounts WHERE "userId" = ${userId}`,
      tx`DELETE FROM user_settings WHERE user_id = ${userId}`,
      tx`DELETE FROM student_classes WHERE user_id = ${userId}`,
      tx`DELETE FROM user_roles WHERE user_id = ${userId}`,
      tx`DELETE FROM auth_users WHERE id = ${userId} RETURNING id`,
    ]);

    return Response.json({ success: true });
  } catch (err) {
    console.error("POST /api/users/delete error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
