import sql from "../../../../app/api/utils/sql.js";
import { auth } from "../../../../auth.js";

export async function POST(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: "Request body must be valid JSON" },
        { status: 400 },
      );
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json(
        { error: "Request body must be a JSON object" },
        { status: 400 },
      );
    }

    const hasProfilePicture = Object.hasOwn(body, "profile_picture");
    const hasDefaultAnonymous = Object.hasOwn(body, "default_anonymous");

    if (!hasProfilePicture && !hasDefaultAnonymous) {
      return Response.json(
        { error: "At least one setting must be provided" },
        { status: 400 },
      );
    }

    const profilePicture = body.profile_picture;
    const defaultAnonymous = body.default_anonymous;

    if (
      hasProfilePicture &&
      profilePicture !== null &&
      typeof profilePicture !== "string"
    ) {
      return Response.json(
        { error: "profile_picture must be a string or null" },
        { status: 400 },
      );
    }

    if (hasDefaultAnonymous && typeof defaultAnonymous !== "boolean") {
      return Response.json(
        { error: "default_anonymous must be a boolean" },
        { status: 400 },
      );
    }

    const userId = session.user.id;

    // Keep this upsert aligned with user_settings in sql/schema.sql.
    const result = await sql`
      INSERT INTO user_settings (user_id, profile_picture, default_anonymous)
      VALUES (
        ${userId},
        ${hasProfilePicture ? profilePicture : null},
        ${hasDefaultAnonymous ? defaultAnonymous : false}
      )
      ON CONFLICT (user_id)
      DO UPDATE SET
        profile_picture = CASE
          WHEN ${hasProfilePicture} THEN EXCLUDED.profile_picture
          ELSE user_settings.profile_picture
        END,
        default_anonymous = CASE
          WHEN ${hasDefaultAnonymous} THEN EXCLUDED.default_anonymous
          ELSE user_settings.default_anonymous
        END
      RETURNING *
    `;

    return Response.json({ settings: result[0] });
  } catch (err) {
    console.error("POST /api/settings/update error", err);
    return Response.json(
      { error: "Unable to save settings" },
      { status: 500 },
    );
  }
}
