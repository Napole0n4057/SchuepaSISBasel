import { auth } from "../../../auth.js";
import sql from "../utils/sql.js";
import { getVisibleVotes } from "../utils/voteAccess.js";
import { latestContentTime } from "../../../utils/sectionNotifications.js";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const [votes, posts] = await Promise.all([
      getVisibleVotes(session.user.id),
      sql`SELECT (SELECT MAX(created_at) AT TIME ZONE 'UTC' FROM forum_posts) AS forum,
                 (SELECT MAX(created_at) AT TIME ZONE 'UTC' FROM blog_posts) AS blog`,
    ]);
    const voteTime = latestContentTime(votes.filter((vote) => vote.status === "active"));
    return Response.json({ latest: {
      votes: voteTime ? new Date(voteTime).toISOString() : null,
      forum: posts[0]?.forum || null,
      blog: posts[0]?.blog || null,
    } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("GET /api/notifications error", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
