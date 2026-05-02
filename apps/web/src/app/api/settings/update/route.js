import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function POST(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { profile_picture, default_anonymous } = body;
    const userId = session.user.id;

    // Upsert settings
    const result = await sql`
      INSERT INTO user_settings (user_id, profile_picture, default_anonymous, updated_at)
      VALUES (${userId}, ${profile_picture || null}, ${default_anonymous || false}, NOW())
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        profile_picture = COALESCE(${profile_picture}, user_settings.profile_picture),
        default_anonymous = COALESCE(${default_anonymous}, user_settings.default_anonymous),
        updated_at = NOW()
      RETURNING *
    `;

    return Response.json({ settings: result[0] });
  } catch (err) {
    console.error("POST /api/settings/update error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
