export default function AnonymityNotice({ t }) {
  return (
    <p className="mt-2 text-xs leading-5 text-slate-600">
      {t("Anonymous posts are only anonymous to other students. Administrators and moderators can view your identity for moderation purposes.")}
      {" "}{t("This also applies to comments and replies.")}
    </p>
  );
}
