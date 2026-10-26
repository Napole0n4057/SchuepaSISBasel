import { accountMutation } from "./permissions.js";

// All input is bound; the only interpolated fragments below are static constants.
export const ACCOUNT_TARGET_CTE = `WITH target AS (
  SELECT ur.user_id, ur.designation FROM user_roles ur
  WHERE ur.user_id = $2::uuid
    AND EXISTS (SELECT 1 FROM user_roles actor WHERE actor.user_id = $1::uuid
      AND (actor.designation = 'admin' OR
        (actor.designation = 'spectator' AND ur.designation IN ('member', 'spectator'))))
)`;
export const LAST_ADMIN_SQL = `(target.designation <> 'admin' OR
  (SELECT COUNT(DISTINCT user_id) FROM user_roles WHERE designation = 'admin') > 1)`;
export const ACCOUNT_STATEMENTS = {
  role: `${ACCOUNT_TARGET_CTE} UPDATE user_roles ur SET designation = $3, updated_at = NOW()
      FROM target WHERE ur.user_id = target.user_id
      AND EXISTS (SELECT 1 FROM user_roles actor WHERE actor.user_id = $1::uuid AND actor.designation = 'admin')
      AND ($3 = 'admin' OR ${LAST_ADMIN_SQL}) RETURNING ur.user_id, ur.email, ur.designation`,
  password: `${ACCOUNT_TARGET_CTE} UPDATE auth_accounts a SET password = $3 FROM target
      WHERE a."userId" = target.user_id AND a.provider = 'credentials' RETURNING a.id`,
  details: `${ACCOUNT_TARGET_CTE}, changed AS (
      UPDATE auth_users u SET name = $3, email = $4 FROM target WHERE u.id = target.user_id
      AND NOT EXISTS (SELECT 1 FROM auth_users other WHERE LOWER(other.email) = LOWER($4) AND other.id <> u.id)
      RETURNING u.id, u.name, u.email
    ), roles AS (UPDATE user_roles ur SET email = $4, updated_at = NOW() FROM changed WHERE ur.user_id = changed.id),
    accounts AS (UPDATE auth_accounts a SET "providerAccountId" = $4 FROM changed WHERE a."userId" = changed.id AND a.provider = 'credentials')
    SELECT * FROM changed`,
  class: `${ACCOUNT_TARGET_CTE} INSERT INTO student_classes (user_id, class_name, programme, year, review_required)
      SELECT user_id, $3, NULL, NULL, false FROM target
      ON CONFLICT (user_id) DO UPDATE SET class_name = EXCLUDED.class_name, programme = NULL, year = NULL,
        review_required = false, updated_at = NOW()
      RETURNING user_id, class_name, programme, year, review_required`,
  delete: `${ACCOUNT_TARGET_CTE}, permitted AS (SELECT * FROM target WHERE ${LAST_ADMIN_SQL}),
      sessions AS (DELETE FROM auth_sessions WHERE "userId" IN (SELECT user_id FROM permitted)),
      accounts AS (DELETE FROM auth_accounts WHERE "userId" IN (SELECT user_id FROM permitted)),
      settings AS (DELETE FROM user_settings WHERE user_id IN (SELECT user_id FROM permitted)),
      roles AS (DELETE FROM user_roles WHERE user_id IN (SELECT user_id FROM permitted))
      DELETE FROM auth_users WHERE id IN (SELECT user_id FROM permitted) RETURNING id`,
};
export async function mutateAccount(
  actorId,
  targetId,
  action,
  value = null,
  extra = null,
) {
  const params = [actorId, targetId];
  if (action !== "delete") params.push(value);
  if (action === "details") params.push(extra);
  return accountMutation((tx) => tx(ACCOUNT_STATEMENTS[action], params));
}
