import sql from "../../../../app/api/utils/sql.js";
import { auth } from "../../../../auth.js";

export async function GET() {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const rows = await sql`
      SELECT designation, email, created_at
      FROM user_roles 
      WHERE user_id = ${userId}
      LIMIT 1
    `;

    if (rows.length === 0) {
      // Create default member role if doesn't exist
      const newRole = await sql`
        INSERT INTO user_roles (user_id, email, designation)
        VALUES (${userId}, ${session.user.email}, 'member')
        RETURNING designation, email, created_at
      `;
      return Response.json({ role: newRole[0] });
    }

    return Response.json({ role: rows[0] });
  } catch (err) {
    console.error("GET /api/user-roles/get error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
