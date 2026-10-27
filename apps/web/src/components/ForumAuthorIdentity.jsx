// This field is supplied only to moderators by the forum APIs.
export default function ForumAuthorIdentity({ item, t }) {
  if (!item.is_anonymous || !("moderation_author_name" in item)) return null;
  return (
    <span className="text-xs font-normal text-slate-500">
      {" · "}{t("Author")}: {item.moderation_author_name || t("Author unavailable")}
    </span>
  );
}
