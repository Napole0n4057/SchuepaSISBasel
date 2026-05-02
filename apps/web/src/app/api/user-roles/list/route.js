import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if current user is admin or spectator
    const currentUserRole = await sql`
      SELECT designation
      FROM user_roles
      WHERE user_id = ${session.user.id}
      LIMIT 1
    `;

    if (
      currentUserRole.length === 0 ||
      (currentUserRole[0].designation !== "admin" &&
        currentUserRole[0].designation !== "spectator")
    ) {
      return Response.json(
        { error: "Forbidden - Admin or Spectator access required" },
        { status: 403 },
      );
    }

    const rows = await sql`
      SELECT user_id, email, designation, created_at, updated_at
      FROM user_roles
      ORDER BY created_at DESC
    `;

    return Response.json({ users: rows });
  } catch (err) {
    console.error("GET /api/user-roles/list error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
