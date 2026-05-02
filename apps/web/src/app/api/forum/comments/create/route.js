import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function POST(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { post_id, content, is_anonymous } = body;

    if (!post_id || !content) {
      return Response.json(
        { error: "post_id and content required" },
        { status: 400 },
      );
    }

    const comment = await sql`
      INSERT INTO forum_comments (post_id, user_id, content, is_anonymous, created_at)
      VALUES (${post_id}, ${session.user.id}, ${content}, ${is_anonymous || false}, NOW())
      RETURNING *
    `;

    return Response.json({ comment: comment[0] });
  } catch (err) {
    console.error("POST /api/forum/comments/create error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
