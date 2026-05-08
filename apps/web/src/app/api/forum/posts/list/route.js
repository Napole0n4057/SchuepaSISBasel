import sql from "../../../../../app/api/utils/sql.js";
import { auth } from "../../../../../auth.js";
import { extractNameFromEmail } from "../../../../../app/api/utils/nameHelper.js";

export async function GET(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const posts = await sql`
      SELECT fp.*, u.email as author_email,
             us.profile_picture,
             COUNT(DISTINCT fc.id) as comment_count,
             COALESCE(SUM(CASE WHEN fv.vote_type = 1 THEN 1 ELSE 0 END), 0) as upvotes,
             COALESCE(SUM(CASE WHEN fv.vote_type = -1 THEN 1 ELSE 0 END), 0) as downvotes
      FROM forum_posts fp
      LEFT JOIN auth_users u ON fp.user_id = u.id
      LEFT JOIN user_settings us ON fp.user_id = us.user_id
      LEFT JOIN forum_comments fc ON fp.id = fc.post_id
      LEFT JOIN forum_votes fv ON fp.id = fv.post_id
      GROUP BY fp.id, u.email, us.profile_picture
      ORDER BY fp.created_at DESC
    `;

    const postsWithDetails = posts.map((post) => ({
      ...post,
      author_name: post.is_anonymous
        ? "Anonymous"
        : extractNameFromEmail(post.author_email),
      profile_picture: post.is_anonymous ? null : post.profile_picture,
    }));

    return Response.json({ posts: postsWithDetails });
  } catch (err) {
    console.error("GET /api/forum/posts/list error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
