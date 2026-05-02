import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { extractNameFromEmail } from "@/app/api/utils/nameHelper";

export async function GET(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const postId = searchParams.get("post_id");

    if (!postId) {
      return Response.json({ error: "post_id required" }, { status: 400 });
    }

    const comments = await sql`
      SELECT fc.*, u.email as author_email,
             us.profile_picture,
             COALESCE(SUM(CASE WHEN fv.vote_type = 1 THEN 1 ELSE 0 END), 0) as upvotes,
             COALESCE(SUM(CASE WHEN fv.vote_type = -1 THEN 1 ELSE 0 END), 0) as downvotes
      FROM forum_comments fc
      LEFT JOIN auth_users u ON fc.user_id = u.id
      LEFT JOIN user_settings us ON fc.user_id = us.user_id
      LEFT JOIN forum_votes fv ON fc.id = fv.comment_id
      WHERE fc.post_id = ${postId}
      GROUP BY fc.id, u.email, us.profile_picture
      ORDER BY fc.created_at ASC
    `;

    const commentsWithDetails = comments.map((comment) => ({
      ...comment,
      author_name: comment.is_anonymous
        ? "Anonymous"
        : extractNameFromEmail(comment.author_email),
      profile_picture: comment.is_anonymous ? null : comment.profile_picture,
    }));

    return Response.json({ comments: commentsWithDetails });
  } catch (err) {
    console.error("GET /api/forum/comments/list error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
