import sql from "../../../../app/api/utils/sql.js";
import { auth } from "../../../../auth.js";

export async function POST(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const userRole = await sql`
      SELECT designation FROM user_roles WHERE user_id = ${session.user.id}
    `;

    if (userRole.length === 0 || userRole[0].designation !== "admin") {
      return Response.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { title, content } = body;

    if (!title || !content) {
      return Response.json(
        { error: "Title and content required" },
        { status: 400 },
      );
    }

    const post = await sql`
      INSERT INTO blog_posts (user_id, title, content, created_at, updated_at)
      VALUES (${session.user.id}, ${title}, ${content}, NOW(), NOW())
      RETURNING *
    `;

    return Response.json({ post: post[0] });
  } catch (err) {
    console.error("POST /api/blog/create error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
