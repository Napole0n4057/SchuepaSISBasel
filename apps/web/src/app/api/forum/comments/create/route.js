import sql from "../../../../../app/api/utils/sql.js";
import { auth } from "../../../../../auth.js";
import { withForumAuthor } from "../../../../../app/api/utils/forumAuthor.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_COMMENT_LENGTH = 2000;
const MAX_REQUEST_BYTES = 16 * 1024;

export async function POST(request) {
  let attemptedParentId = null;
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const declaredLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
      return Response.json({ error: "Comment request is too large" }, { status: 413 });
    }

    let rawBody;
    try {
      rawBody = await request.text();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
      return Response.json({ error: "Comment request is too large" }, { status: 413 });
    }

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { post_id, parent_comment_id, content, is_anonymous } = body;
    attemptedParentId = parent_comment_id;

    if (typeof post_id !== "string" || !UUID_PATTERN.test(post_id)) {
      return Response.json(
        { error: "A valid post_id is required" },
        { status: 400 },
      );
    }

    if (typeof content !== "string" || !content.trim()) {
      return Response.json({ error: "Comment content is required" }, { status: 400 });
    }
    if (content.trim().length > MAX_COMMENT_LENGTH) {
      return Response.json(
        { error: "Comment must be 2000 characters or fewer" },
        { status: 400 },
      );
    }

    if (parent_comment_id != null &&
        (typeof parent_comment_id !== "string" || !UUID_PATTERN.test(parent_comment_id))) {
      return Response.json(
        { error: "parent_comment_id must be a valid UUID" },
        { status: 400 },
      );
    }

    if (is_anonymous != null && typeof is_anonymous !== "boolean") {
      return Response.json({ error: "is_anonymous must be a boolean" }, { status: 400 });
    }

    const post = await sql`
      SELECT id
      FROM forum_posts
      WHERE id = ${post_id}
      LIMIT 1
    `;
    if (post.length === 0) {
      return Response.json({ error: "Post not found" }, { status: 404 });
    }

    if (parent_comment_id) {
      const parent = await sql`
        SELECT id
        FROM forum_comments
        WHERE id = ${parent_comment_id} AND post_id = ${post_id}
        LIMIT 1
      `;

      if (parent.length === 0) {
        return Response.json(
          { error: "Parent comment not found for this post" },
          { status: 404 },
        );
      }
    }

    const inserted = await sql`
      INSERT INTO forum_comments (
        post_id, user_id, parent_comment_id, content, is_anonymous, created_at
      )
      VALUES (
        ${post_id}, ${session.user.id}, ${parent_comment_id || null},
        ${content.trim()}, ${is_anonymous === true}, NOW()
      )
      RETURNING *
    `;

    const createdComment = await sql`
      SELECT fc.*, u.name as account_name, u.email as author_email,
             us.profile_picture
      FROM forum_comments fc
      LEFT JOIN auth_users u ON fc.user_id = u.id
      LEFT JOIN user_settings us ON fc.user_id = us.user_id
      WHERE fc.id = ${inserted[0].id}
      LIMIT 1
    `;

    if (createdComment.length === 0) {
      throw new Error("Created comment could not be loaded");
    }

    return Response.json({ comment: withForumAuthor(createdComment[0]) });
  } catch (err) {
    console.error("POST /api/forum/comments/create error", err);
    if (err?.code === "42703" && /parent_comment_id/i.test(err?.message || "")) {
      return Response.json(
        {
          error:
            "Comments are temporarily unavailable. Please ask an administrator to apply the forum replies database update.",
        },
        { status: 503 },
      );
    }
    if (attemptedParentId && err?.code === "23503") {
      return Response.json(
        { error: "Parent comment not found for this post" },
        { status: 404 },
      );
    }
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
