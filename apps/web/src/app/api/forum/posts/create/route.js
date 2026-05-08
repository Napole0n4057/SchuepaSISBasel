import sql from "../../../../../app/api/utils/sql.js";
import { auth } from "../../../../../auth.js";

export async function POST(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, content, is_anonymous } = body;

    if (!title || !content) {
      return Response.json(
        { error: "Title and content required" },
        { status: 400 },
      );
    }

    const post = await sql`
      INSERT INTO forum_posts (user_id, title, content, is_anonymous, created_at, updated_at)
      VALUES (${session.user.id}, ${title}, ${content}, ${is_anonymous || false}, NOW(), NOW())
      RETURNING *
    `;

    return Response.json({ post: post[0] });
  } catch (err) {
    console.error("POST /api/forum/posts/create error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
