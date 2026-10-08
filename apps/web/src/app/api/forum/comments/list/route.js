import sql from "../../../../../app/api/utils/sql.js";
import { auth } from "../../../../../auth.js";
import { withForumAuthor } from "../../../../../app/api/utils/forumAuthor.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const postId = searchParams.get("post_id");

    if (!postId || !UUID_PATTERN.test(postId)) {
      return Response.json({ error: "A valid post_id is required" }, { status: 400 });
    }

    const comments = await sql`
      SELECT fc.*, u.name as account_name, u.email as author_email,
             us.profile_picture
      FROM forum_comments fc
      LEFT JOIN auth_users u ON fc.user_id = u.id
      LEFT JOIN user_settings us ON fc.user_id = us.user_id
      WHERE fc.post_id = ${postId}
      ORDER BY fc.created_at ASC
    `;

    const commentsWithDetails = comments.map((comment) => ({
      ...withForumAuthor(comment),
      parent_comment_id: comment.parent_comment_id || null,
    }));

    return Response.json({ comments: commentsWithDetails });
  } catch (err) {
    console.error("GET /api/forum/comments/list error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
