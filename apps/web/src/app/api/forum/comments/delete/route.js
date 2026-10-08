import sql from "../../../../../app/api/utils/sql.js";
import { auth } from "../../../../../auth.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const comment_id =
      body && typeof body === "object" && !Array.isArray(body)
        ? body.comment_id
        : null;

    if (typeof comment_id !== "string" || !UUID_PATTERN.test(comment_id)) {
      return Response.json({ error: "A valid comment_id is required" }, { status: 400 });
    }

    const target = await sql`
      SELECT post_id
      FROM forum_comments
      WHERE id = ${comment_id}
      LIMIT 1
    `;
    if (target.length === 0) {
      return Response.json({ error: "Comment not found" }, { status: 404 });
    }

    const postId = target[0].post_id;
    const crossPostDescendants = await sql`
      WITH RECURSIVE comment_tree(id, post_id, path) AS (
        SELECT id, post_id, ARRAY[id]::uuid[]
        FROM forum_comments
        WHERE id = ${comment_id}
        UNION ALL
        SELECT child.id, child.post_id, parent.path || child.id
        FROM forum_comments child
        INNER JOIN comment_tree parent ON child.parent_comment_id = parent.id
        WHERE NOT child.id = ANY(parent.path)
      )
      SELECT COALESCE(BOOL_OR(post_id <> ${postId}), false) AS crosses_posts
      FROM comment_tree
    `;

    if (crossPostDescendants[0]?.crosses_posts) {
      return Response.json(
        { error: "Comment tree crosses posts" },
        { status: 409 },
      );
    }

    const transactionResults = await sql.transaction((txn) => [
      txn`
        WITH RECURSIVE comment_tree(id, path) AS (
          SELECT id, ARRAY[id]::uuid[]
          FROM forum_comments
          WHERE id = ${comment_id} AND post_id = ${postId}
          UNION ALL
          SELECT child.id, parent.path || child.id
          FROM forum_comments child
          INNER JOIN comment_tree parent ON child.parent_comment_id = parent.id
          WHERE child.post_id = ${postId}
            AND NOT child.id = ANY(parent.path)
        )
        DELETE FROM forum_votes
        WHERE comment_id IN (SELECT id FROM comment_tree)
      `,
      txn`
        DELETE FROM forum_comments
        WHERE id = ${comment_id} AND post_id = ${postId}
        RETURNING id
      `,
    ]);

    const deleted = transactionResults[1];

    if (deleted.length === 0) {
      return Response.json({ error: "Comment not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("POST /api/forum/comments/delete error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
