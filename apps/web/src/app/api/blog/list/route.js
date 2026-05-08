import sql from "../../../../app/api/utils/sql.js";
import { extractNameFromEmail } from "../../../../app/api/utils/nameHelper.js";

export async function GET(request) {
  try {
    const posts = await sql`
      SELECT bp.*, u.email as author_email,
             us.profile_picture
      FROM blog_posts bp
      LEFT JOIN auth_users u ON bp.user_id = u.id
      LEFT JOIN user_settings us ON bp.user_id = us.user_id
      ORDER BY bp.created_at DESC
    `;

    const postsWithNames = posts.map((post) => ({
      ...post,
      author_name: extractNameFromEmail(post.author_email),
    }));

    return Response.json({ posts: postsWithNames });
  } catch (err) {
    console.error("GET /api/blog/list error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
