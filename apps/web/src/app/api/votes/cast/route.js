import sql from "../../../../app/api/utils/sql.js";
import { auth } from "../../../../auth.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Request body must be valid JSON" }, { status: 400 });
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ error: "Request body must be a JSON object" }, { status: 400 });
    }

    const { vote_id, option_id } = body;

    if (!vote_id || !option_id) {
      return Response.json(
        { error: "vote_id and option_id required" },
        { status: 400 },
      );
    }

    if (
      typeof vote_id !== "string" ||
      !UUID_PATTERN.test(vote_id) ||
      typeof option_id !== "string" ||
      !UUID_PATTERN.test(option_id)
    ) {
      return Response.json({ error: "vote_id and option_id must be valid UUIDs" }, { status: 400 });
    }

    // Use the same UTC wall-time comparison as the list endpoint for timestamp columns without a timezone.
    const vote = await sql`
      SELECT *
      FROM votes
      WHERE id = ${vote_id}
        AND deleted_at IS NULL
        AND is_active IS TRUE
        AND (ends_at IS NULL OR ends_at > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'))
    `;

    if (vote.length === 0) {
      return Response.json(
        { error: "Vote not found, inactive, or expired" },
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

    const option = await sql`
      SELECT id FROM vote_options WHERE id = ${option_id} AND vote_id = ${vote_id}
    `;

    if (option.length === 0) {
      return Response.json(
        { error: "option_id does not belong to vote_id" },
        { status: 400 },
      );
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
