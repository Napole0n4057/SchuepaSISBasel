import sql from "../../../../app/api/utils/sql.js";
import { auth } from "../../../../auth.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = await sql`
      SELECT designation FROM user_roles WHERE user_id = ${session.user.id}
    `;
    if (userRole.length === 0 || userRole[0].designation !== "admin") {
      return Response.json({ error: "Forbidden - Admin access required" }, { status: 403 });
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

    const voteId = body.vote_id;
    if (typeof voteId !== "string" || !UUID_PATTERN.test(voteId)) {
      return Response.json({ error: "A valid vote_id is required" }, { status: 400 });
    }

    const existingVote = await sql`SELECT id FROM votes WHERE id = ${voteId}`;
    if (existingVote.length === 0) {
      return Response.json({ error: "Vote not found" }, { status: 404 });
    }

    const deletedVote = await sql`
      UPDATE votes
      SET deleted_at = NOW()
      WHERE id = ${voteId}
      RETURNING id, deleted_at
    `;

    return Response.json({ success: true, vote: deletedVote[0] });
  } catch (err) {
    console.error("DELETE /api/votes/delete error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
