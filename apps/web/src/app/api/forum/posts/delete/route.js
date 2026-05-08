import sql from "../../../../../app/api/utils/sql.js";
import { auth } from "../../../../../auth.js";

export async function POST(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUserRole = await sql`
      SELECT designation
      FROM user_roles
      WHERE user_id = ${session.user.id}
      LIMIT 1
    `;

    if (
      currentUserRole.length === 0 ||
      currentUserRole[0].designation !== "admin"
    ) {
      return Response.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { post_id } = body;

    if (!post_id) {
      return Response.json({ error: "post_id required" }, { status: 400 });
    }

    await sql`
      DELETE FROM forum_votes
      WHERE post_id = ${post_id}
    `;

    await sql`
      DELETE FROM forum_comments
      WHERE post_id = ${post_id}
    `;

    const deleted = await sql`
      DELETE FROM forum_posts
      WHERE id = ${post_id}
      RETURNING id
    `;

    if (deleted.length === 0) {
      return Response.json({ error: "Post not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("POST /api/forum/posts/delete error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
