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

    // Get votes based on role
    let votes;
    if (isAdmin || isSpectator) {
      // Admins and spectators see all votes
      votes = await sql`
        SELECT v.*, u.email as creator_email
        FROM votes v
        LEFT JOIN auth_users u ON v.created_by = u.id
        ORDER BY v.created_at DESC
      `;
    } else {
      // Regular members see only non-admin votes
      votes = await sql`
        SELECT v.*, u.email as creator_email
        FROM votes v
        LEFT JOIN auth_users u ON v.created_by = u.id
        WHERE v.admin_only = false
        ORDER BY v.created_at DESC
      `;
    }

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

    return Response.json({ votes: votesWithOptions });
  } catch (err) {
    console.error("GET /api/votes/list error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
