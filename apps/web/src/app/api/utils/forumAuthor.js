import { extractNameFromEmail } from "./nameHelper.js";

export function withForumAuthor(record) {
  const { account_name, author_email, user_id, ...publicRecord } = record;
  const isAnonymous = Boolean(record.is_anonymous);
  const accountName =
    typeof account_name === "string" ? account_name.trim() : "";

  return {
    ...publicRecord,
    ...(isAnonymous ? {} : { user_id }),
    author_name: isAnonymous
      ? "Anonymous"
      : accountName || extractNameFromEmail(author_email),
    profile_picture: isAnonymous ? null : record.profile_picture || null,
  };
}
