import sql from "./sql.js";
import { auth } from "../../../auth.js";
import { isValidUserId } from "../../../studentClasses.js";
import { getRole } from "./permissions.js";

const tables = {
  blog: "blog_posts",
  "forum/posts": "forum_posts",
  "forum/comments": "forum_comments",
};
export function moderationHandler(resource, action) {
  return async (request) => {
    try {
      const session = await auth();
      if (!session?.user?.id)
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      if (!["admin", "spectator"].includes(await getRole(session.user.id)))
        return Response.json({ error: "Forbidden" }, { status: 403 });
      let body;
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: "Invalid JSON" }, { status: 400 });
      }
      if (!isValidUserId(body?.id))
        return Response.json({ error: "Valid id required" }, { status: 400 });
      const comments = resource === "forum/comments";
      if (
        action === "update" &&
        (typeof body.content !== "string" ||
          !body.content.trim() ||
          (comments && body.content.trim().length > 2000) ||
          (!comments && (typeof body.title !== "string" || !body.title.trim())))
      ) {
        return Response.json(
          { error: "Valid title and content required" },
          { status: 400 },
        );
      }
      const scope = `EXISTS (SELECT 1 FROM user_roles WHERE user_id = $1::uuid AND designation IN ('admin', 'spectator'))`;
      const query =
        action === "delete"
          ? `DELETE FROM ${tables[resource]} WHERE id = $2::uuid AND ${scope} RETURNING id`
          : `UPDATE ${tables[resource]} SET content = $3${comments ? "" : ", title = $4, updated_at = NOW()"} WHERE id = $2::uuid AND ${scope} RETURNING id, content${comments ? "" : ", title, updated_at"}`;
      const params = [session.user.id, body.id];
      if (action === "update") {
        params.push(body.content.trim());
        if (!comments) params.push(body.title.trim());
      }
      const rows = await sql(query, params);
      if (!rows.length)
        return Response.json(
          { error: "Content not found or forbidden" },
          { status: 404 },
        );
      return Response.json({
        success: true,
        item: action === "delete" ? null : rows[0],
      });
    } catch (err) {
      console.error("Content moderation failed", err);
      return Response.json({ error: "Internal Server Error" }, { status: 500 });
    }
  };
}
