import sql from "../../../../app/api/utils/sql.js";
import { auth } from "../../../../auth.js";

export async function GET(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get or create user settings
    let settings = await sql`
      SELECT * FROM user_settings WHERE user_id = ${userId}
    `;

    if (settings.length === 0) {
      // Create default settings
      settings = await sql`
        INSERT INTO user_settings (user_id, profile_picture, default_anonymous)
        VALUES (${userId}, NULL, false)
        RETURNING *
      `;
    }

    return Response.json({ settings: settings[0] });
  } catch (err) {
    console.error("GET /api/settings/get error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
