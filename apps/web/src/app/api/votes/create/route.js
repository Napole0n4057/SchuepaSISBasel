import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

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
    const { title, description, options, admin_only, ends_at } = body;

    if (!title || !Array.isArray(options) || options.length < 2) {
      return Response.json(
        { error: "Title and at least 2 options required" },
        { status: 400 },
      );
    }

    // Create vote
    const vote = await sql`
      INSERT INTO votes (title, description, created_by, admin_only, ends_at, is_active)
      VALUES (${title}, ${description || null}, ${session.user.id}, ${admin_only || false}, ${ends_at || null}, true)
      RETURNING *
    `;

    const voteId = vote[0].id;

    // Create options
    for (const option of options) {
      await sql`
        INSERT INTO vote_options (vote_id, option_text)
        VALUES (${voteId}, ${option})
      `;
    }

    return Response.json({ vote: vote[0] });
  } catch (err) {
    console.error("POST /api/votes/create error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
