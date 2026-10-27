import sql from "../../../../../app/api/utils/sql.js";
import { withForumAuthor } from "../../../utils/forumAuthor.js";
import { auth } from "../../../../../auth.js";

export async function POST(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roles =
      await sql`SELECT designation FROM user_roles WHERE user_id = ${session.user.id} LIMIT 1`;
    if (!["admin", "member"].includes(roles[0]?.designation)) {
      return Response.json(
        { error: "Participation is not permitted" },
        { status: 403 });
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

    if (post[0].is_anonymous) {
      const authors = await sql`SELECT name as account_name, email as author_email
        FROM auth_users WHERE id = ${session.user.id} LIMIT 1`;
      return Response.json({
        post: withForumAuthor({ ...post[0], ...authors[0] }, roles[0]?.designation),
      });
    }
    return Response.json({ post: post[0] });
  } catch (err) {
    console.error("POST /api/forum/posts/create error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
