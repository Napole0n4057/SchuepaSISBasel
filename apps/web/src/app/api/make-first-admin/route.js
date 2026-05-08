import sql from "../../../app/api/utils/sql.js";
import { auth } from "../../../auth.js";

export async function POST() {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existingAdmins = await sql`
      SELECT user_id
      FROM user_roles
      WHERE designation = 'admin'
      LIMIT 1
    `;

    if (existingAdmins.length > 0) {
      return Response.json(
        { error: "Admin already exists" },
        { status: 403 },
      );
    }

    const existingRole = await sql`
      SELECT user_id
      FROM user_roles
      WHERE user_id = ${session.user.id}
      LIMIT 1
    `;

    if (existingRole.length === 0) {
      await sql`
        INSERT INTO user_roles (user_id, email, designation)
        VALUES (${session.user.id}, ${session.user.email}, 'admin')
      `;
    } else {
      await sql`
        UPDATE user_roles
        SET designation = 'admin', updated_at = NOW()
        WHERE user_id = ${session.user.id}
      `;
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("POST /api/make-first-admin error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
