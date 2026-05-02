import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function POST(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is spectator (they can't vote)
    const userRole = await sql`
      SELECT designation FROM user_roles WHERE user_id = ${session.user.id}
    `;

    if (userRole.length > 0 && userRole[0].designation === "spectator") {
      return Response.json(
        { error: "Spectators cannot vote" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { vote_id, option_id } = body;

    if (!vote_id || !option_id) {
      return Response.json(
        { error: "vote_id and option_id required" },
        { status: 400 },
      );
    }

    // Check if vote exists and is active
    const vote = await sql`
      SELECT * FROM votes WHERE id = ${vote_id} AND is_active = true
    `;

    if (vote.length === 0) {
      return Response.json(
        { error: "Vote not found or inactive" },
        { status: 404 },
      );
    }

    // Check if user can see this vote
    if (vote[0].admin_only) {
      const isAdmin =
        userRole.length > 0 && userRole[0].designation === "admin";
      if (!isAdmin) {
        return Response.json({ error: "Access denied" }, { status: 403 });
      }
    }

    // Check if vote has ended
    if (vote[0].ends_at && new Date(vote[0].ends_at) < new Date()) {
      return Response.json({ error: "Vote has ended" }, { status: 400 });
    }

    // Upsert user vote (allows changing vote)
    const result = await sql`
      INSERT INTO user_votes (vote_id, option_id, user_id, voted_at)
      VALUES (${vote_id}, ${option_id}, ${session.user.id}, NOW())
      ON CONFLICT (vote_id, user_id)
      DO UPDATE SET option_id = ${option_id}, voted_at = NOW()
      RETURNING *
    `;

    return Response.json({ success: true, vote: result[0] });
  } catch (err) {
    console.error("POST /api/votes/cast error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
