import sql from "../../../../app/api/utils/sql.js";
import { auth } from "../../../../auth.js";

export async function GET(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check user role
    const userRole = await sql`
      SELECT designation FROM user_roles WHERE user_id = ${session.user.id}
    `;

    const isAdmin = userRole.length > 0 && userRole[0].designation === "admin";
    const isSpectator =
      userRole.length > 0 && userRole[0].designation === "spectator";

    // Keep existing visibility: admins and spectators see all polls; other users see public polls.
    const votes = await sql`
      SELECT
        v.*,
        u.email AS creator_email,
        CASE
          WHEN v.is_active IS NULL THEN 'past'
          WHEN v.is_active = false THEN 'past'
          WHEN v.is_active = true
            AND v.ends_at IS NOT NULL
            AND v.ends_at <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
          THEN 'past'
          WHEN v.is_active = true
            AND (v.ends_at IS NULL OR v.ends_at > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'))
          THEN 'active'
        END AS status,
        ARRAY(
          SELECT vc.class_name
          FROM vote_classes vc
          WHERE vc.vote_id = v.id
          ORDER BY vc.class_name
        ) AS class_names
      FROM votes v
      LEFT JOIN auth_users u ON v.created_by = u.id
      WHERE v.deleted_at IS NULL
        AND (${isAdmin} OR ${isSpectator} OR v.admin_only = false)
      ORDER BY v.created_at DESC
    `;

    // Get options and vote counts for each vote
    const votesWithOptions = await Promise.all(
      votes.map(async (vote) => {
        const options = await sql`
          SELECT vo.*, COUNT(uv.id) as vote_count
          FROM vote_options vo
          LEFT JOIN user_votes uv ON vo.id = uv.option_id
          WHERE vo.vote_id = ${vote.id}
          GROUP BY vo.id
          ORDER BY vo.id
        `;

        // Check if current user has voted
        const userVote = await sql`
          SELECT option_id FROM user_votes 
          WHERE vote_id = ${vote.id} AND user_id = ${session.user.id}
        `;

        return {
          ...vote,
          options,
          user_voted_option_id:
            userVote.length > 0 ? userVote[0].option_id : null,
        };
      }),
    );

    const activeVotes = votesWithOptions.filter((vote) => vote.status === "active");
    const pastVotes = votesWithOptions.filter((vote) => vote.status === "past");

    return Response.json({
      votes: votesWithOptions,
      active_votes: activeVotes,
      past_votes: pastVotes,
    });
  } catch (err) {
    console.error("GET /api/votes/list error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
