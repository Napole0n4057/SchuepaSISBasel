import sql from "./sql.js";

// These static SQL fragments always use v/viewer aliases and $1 for the viewer ID.
// Share the predicates between listing/results, notifications and the atomic write.
export const VOTE_VIEWER_SQL = `WITH viewer AS (
  SELECT
    (SELECT designation FROM user_roles WHERE user_id = $1 LIMIT 1) AS designation,
    (SELECT class_name FROM student_classes WHERE user_id = $1) AS class_name
)`;

export const ACTIVE_VOTE_SQL = `(v.is_active IS TRUE AND
  (v.ends_at IS NULL OR v.ends_at > (clock_timestamp() AT TIME ZONE 'UTC')))`;

export const VOTE_ROLE_ACCESS_SQL = `(viewer.designation IN ('admin', 'spectator') OR v.admin_only IS FALSE)`;

export const VOTE_CLASS_ACCESS_SQL = `(viewer.designation IN ('admin', 'spectator') OR
  NOT EXISTS (SELECT 1 FROM vote_classes vc WHERE vc.vote_id = v.id) OR
  EXISTS (SELECT 1 FROM vote_classes vc WHERE vc.vote_id = v.id AND vc.class_name = viewer.class_name))`;

export const VISIBLE_VOTES_SQL = `${VOTE_VIEWER_SQL}
    SELECT v.*, v.ends_at AT TIME ZONE 'UTC' AS ends_at,
      v.created_at AT TIME ZONE 'UTC' AS created_at, u.email AS creator_email,
      CASE WHEN ${ACTIVE_VOTE_SQL} THEN 'active' ELSE 'past' END AS status,
      ARRAY(SELECT vc.class_name FROM vote_classes vc WHERE vc.vote_id = v.id ORDER BY vc.class_name) AS class_names
    FROM votes v
    CROSS JOIN viewer
    LEFT JOIN auth_users u ON v.created_by = u.id
    WHERE v.deleted_at IS NULL
      AND ($2::uuid IS NULL OR v.id = $2::uuid)
      AND (NOT ${ACTIVE_VOTE_SQL} OR (${VOTE_ROLE_ACCESS_SQL} AND ${VOTE_CLASS_ACCESS_SQL}))
    ORDER BY v.created_at DESC
  `;

export const CAST_VOTE_SQL = `${VOTE_VIEWER_SQL}
  INSERT INTO user_votes (vote_id, option_id, user_id, voted_at)
  SELECT v.id, vo.id, $1, clock_timestamp() AT TIME ZONE 'UTC'
  FROM votes v
  CROSS JOIN viewer
  JOIN vote_options vo ON vo.vote_id = v.id AND vo.id = $3::uuid
  WHERE v.id = $2::uuid AND v.deleted_at IS NULL
    AND ${ACTIVE_VOTE_SQL}
    AND viewer.designation IN ('admin', 'member')
    AND ${VOTE_ROLE_ACCESS_SQL}
    AND ${VOTE_CLASS_ACCESS_SQL}
  ON CONFLICT (vote_id, user_id)
  DO UPDATE SET option_id = EXCLUDED.option_id,
                voted_at = clock_timestamp() AT TIME ZONE 'UTC'
  WHERE EXISTS (
    SELECT 1 FROM votes v CROSS JOIN viewer WHERE v.id = $2::uuid
      AND v.deleted_at IS NULL AND ${ACTIVE_VOTE_SQL}
      AND viewer.designation IN ('admin', 'member')
      AND ${VOTE_ROLE_ACCESS_SQL} AND ${VOTE_CLASS_ACCESS_SQL}
  )
  RETURNING *
`;

export async function getVisibleVotes(userId, voteId = null) {
  return sql(VISIBLE_VOTES_SQL, [userId, voteId]);
}
