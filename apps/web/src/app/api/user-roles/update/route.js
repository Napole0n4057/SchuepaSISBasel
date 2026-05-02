import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function POST(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if current user is admin (spectators can see but not modify, but they CAN promote/demote)
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

    const body = await request.json();
    const { userId, designation } = body;

    if (!userId || !designation) {
      return Response.json(
        { error: "Missing userId or designation" },
        { status: 400 },
      );
    }

    if (!["admin", "member", "spectator"].includes(designation)) {
      return Response.json({ error: "Invalid designation" }, { status: 400 });
    }

    const result = await sql`
      UPDATE user_roles
      SET designation = ${designation}, updated_at = NOW()
      WHERE user_id = ${userId}
      RETURNING user_id, email, designation, updated_at
    `;

    if (result.length === 0) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    return Response.json({ user: result[0] });
  } catch (err) {
    console.error("POST /api/user-roles/update error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
