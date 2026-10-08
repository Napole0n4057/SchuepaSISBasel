import { useState } from "react";
import ProfileAvatar from "@/components/ProfileAvatar";

function displayAuthor(comment, t) {
  return comment.author_name === "Anonymous"
    ? t("Anonymous")
    : comment.author_name;
}

export default function ForumComment({
  comment,
  depth = 0,
  isAdmin = false,
  language,
  onReply,
  onDelete,
  t,
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyAnonymous, setReplyAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const authorName = displayAuthor(comment, t);
  const createdAt = new Date(comment.created_at);
  const validCreatedAt = !Number.isNaN(createdAt.getTime());
  const timestamp = validCreatedAt
    ? createdAt.toLocaleString(language === "de" ? "de-CH" : "en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "";

  const handleReply = async (event) => {
    event.preventDefault();
    if (!replyText.trim() || submitting) return;

    setSubmitting(true);
    const created = await onReply(comment.id, replyText.trim(), replyAnonymous);
    setSubmitting(false);

    if (created) {
      setReplyText("");
      setReplyAnonymous(false);
      setReplyOpen(false);
    }
  };

  return (
    <article className="forum-comment-enter min-w-0">
      <div className="flex items-start gap-3">
        <ProfileAvatar
          src={comment.profile_picture}
          name={authorName}
          className="h-8 w-8"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-sm font-semibold text-slate-900">
              {authorName}
            </span>
            {timestamp && (
              <time
                dateTime={validCreatedAt ? createdAt.toISOString() : undefined}
                className="text-xs text-slate-500"
              >
                {timestamp}
              </time>
            )}
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
            {comment.content}
          </p>
          <div className="mt-1.5 flex items-center gap-4">
            <button
              type="button"
              onClick={() => setReplyOpen((open) => !open)}
              aria-expanded={replyOpen}
              className="border border-transparent text-xs font-semibold text-[#093388] hover:text-[#009EE0]"
            >
              {t("Reply")}
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => onDelete(comment.id)}
                className="border border-transparent text-xs font-medium text-red-600 hover:text-red-800"
              >
                {t("Remove comment")}
              </button>
            )}
          </div>

          {replyOpen && (
            <form onSubmit={handleReply} className="mt-3 space-y-2">
              <p className="text-xs text-slate-500">
                {t("Replying to {name}", { name: authorName })}
              </p>
              <textarea
                autoFocus
                rows={2}
                maxLength={2000}
                value={replyText}
                onChange={(event) => setReplyText(event.target.value)}
                aria-label={t("Write a reply")}
                placeholder={t("Write a reply")}
                className="w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#009EE0] focus:ring-2 focus:ring-[#009EE0]/20"
                required
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={replyAnonymous}
                    onChange={(event) => setReplyAnonymous(event.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-[#093388] focus:ring-[#009EE0]"
                  />
                  {t("Reply anonymously")}
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setReplyOpen(false);
                      setReplyText("");
                    }}
                    disabled={submitting}
                    className="rounded-md border border-transparent px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                  >
                    {t("Cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !replyText.trim()}
                    className="rounded-md border border-[#082a6b] bg-[#093388] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#082a6b] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t("Send reply")}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>

      {comment.replies?.length > 0 && (
        <div
          className={`mt-3 space-y-3 ${depth < 3 ? "border-l border-sky-100 pl-3 sm:pl-4" : ""}`}
        >
          {comment.replies.map((reply) => (
            <div key={reply.id}>
              <ForumComment
                comment={reply}
                depth={depth + 1}
                isAdmin={isAdmin}
                language={language}
                onReply={onReply}
                onDelete={onDelete}
                t={t}
              />
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
