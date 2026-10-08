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

    const post_id =
      body && typeof body === "object" && !Array.isArray(body)
        ? body.post_id
        : null;

    if (typeof post_id !== "string" || !UUID_PATTERN.test(post_id)) {
      return Response.json({ error: "A valid post_id is required" }, { status: 400 });
    }

    const existingPost = await sql`
      SELECT id
      FROM forum_posts
      WHERE id = ${post_id}
      LIMIT 1
    `;
    if (existingPost.length === 0) {
      return Response.json({ error: "Post not found" }, { status: 404 });
    }

    const crossPostDescendants = await sql`
      WITH RECURSIVE comment_tree(id, post_id, path) AS (
        SELECT comment.id, comment.post_id, ARRAY[comment.id]::uuid[]
        FROM forum_comments comment
        WHERE comment.post_id = ${post_id}
          AND (
            comment.parent_comment_id IS NULL
            OR NOT EXISTS (
              SELECT 1
              FROM forum_comments parent
              WHERE parent.id = comment.parent_comment_id
                AND parent.post_id = ${post_id}
            )
          )
        UNION ALL
        SELECT child.id, child.post_id, parent.path || child.id
        FROM forum_comments child
        INNER JOIN comment_tree parent ON child.parent_comment_id = parent.id
        WHERE NOT child.id = ANY(parent.path)
      )
      SELECT COALESCE(BOOL_OR(post_id <> ${post_id}), false) AS crosses_posts
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
        DELETE FROM forum_votes
        WHERE post_id = ${post_id}
      `,
      txn`
        WITH RECURSIVE comment_tree(id, post_id, path) AS (
          SELECT comment.id, comment.post_id, ARRAY[comment.id]::uuid[]
          FROM forum_comments comment
          WHERE comment.post_id = ${post_id}
            AND (
              comment.parent_comment_id IS NULL
              OR NOT EXISTS (
                SELECT 1
                FROM forum_comments parent
                WHERE parent.id = comment.parent_comment_id
                  AND parent.post_id = ${post_id}
              )
            )
          UNION ALL
          SELECT child.id, child.post_id, parent.path || child.id
          FROM forum_comments child
          INNER JOIN comment_tree parent ON child.parent_comment_id = parent.id
          WHERE child.post_id = ${post_id}
            AND NOT child.id = ANY(parent.path)
        )
        DELETE FROM forum_votes
        WHERE comment_id IN (
          SELECT id FROM comment_tree WHERE post_id = ${post_id}
        )
      `,
      txn`
        DELETE FROM forum_comments
        WHERE post_id = ${post_id}
      `,
      txn`
        DELETE FROM forum_posts
        WHERE id = ${post_id}
        RETURNING id
      `,
    ]);

    const deleted = transactionResults[3];

    if (deleted.length === 0) {
      return Response.json({ error: "Post not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("POST /api/forum/posts/delete error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
