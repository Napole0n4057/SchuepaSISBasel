import { extractNameFromEmail } from "./nameHelper.js";

import { canModerate } from "../../../permissions.js";

export function withForumAuthor(record, viewerRole = null) {
  const { account_name, author_email, user_id, ...publicRecord } = record;
  const isAnonymous = Boolean(record.is_anonymous);
  const accountName =
    typeof account_name === "string" ? account_name.trim() : "";

  return {
    ...publicRecord,
    ...(isAnonymous ? {} : { user_id }),
    // Only a database-verified moderator role may receive this field.
    ...(isAnonymous && canModerate(viewerRole)
      ? { moderation_author_name: accountName || author_email || null }
      : {}),
    author_name: isAnonymous
      ? "Anonymous"
      : accountName || extractNameFromEmail(author_email),
    profile_picture: isAnonymous ? null : record.profile_picture || null,
  };
}
