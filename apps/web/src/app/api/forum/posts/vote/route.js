import sql from "../../../../../app/api/utils/sql.js";
import { auth } from "../../../../../auth.js";

export async function POST(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { post_id, vote_type, is_anonymous } = body;

    if (!post_id || ![1, -1, 0].includes(vote_type)) {
      return Response.json(
        { error: "post_id and vote_type (1, -1, or 0) required" },
        { status: 400 },
      );
    }

    // If vote_type is 0, remove the vote
    if (vote_type === 0) {
      await sql`
        DELETE FROM forum_votes
        WHERE post_id = ${post_id} AND user_id = ${session.user.id}
      `;
      return Response.json({ success: true, action: "removed" });
    }

    // Upsert vote
    const result = await sql`
      INSERT INTO forum_votes (post_id, comment_id, user_id, vote_type, is_anonymous, created_at)
      VALUES (${post_id}, NULL, ${session.user.id}, ${vote_type}, ${is_anonymous || false}, NOW())
      ON CONFLICT (post_id, user_id)
      DO UPDATE SET vote_type = ${vote_type}, is_anonymous = ${is_anonymous || false}, created_at = NOW()
      RETURNING *
    `;

    return Response.json({ success: true, vote: result[0] });
  } catch (err) {
    console.error("POST /api/forum/posts/vote error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
