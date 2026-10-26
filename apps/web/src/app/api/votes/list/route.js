import { isValidUserId } from "../../../../studentClasses.js";
import sql from "../../../../app/api/utils/sql.js";
import { auth } from "../../../../auth.js";
import { getVisibleVotes } from "../../utils/voteAccess.js";

export async function GET(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // This endpoint also supplies vote details and results; filter before reading either.
    const voteId = request
      ? new URL(request.url).searchParams.get("vote_id")
      : null;
    if (voteId && !isValidUserId(voteId))
      return Response.json({ error: "Invalid vote_id" }, { status: 400 });
    const votes = voteId
      ? await getVisibleVotes(session.user.id, voteId)
      : await getVisibleVotes(session.user.id);
    if (voteId && !votes.length)
      return Response.json({ error: "Vote not found" }, { status: 404 });

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
        const userVote =
          vote.status === "active"
            ? await sql`
          SELECT option_id FROM user_votes 
          WHERE vote_id = ${vote.id} AND user_id = ${session.user.id}
        `
            : [];

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
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    console.error("GET /api/votes/list error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
