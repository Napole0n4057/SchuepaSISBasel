import { useEffect, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import { messageKeyFromError } from "@/i18n";
import ProfileAvatar from "@/components/ProfileAvatar";
import ForumComment from "@/components/ForumComment";
import { buildCommentTree } from "@/app/forum/commentTree.js";

const MAX_COMMENT_LENGTH = 2000;

function collectCommentIds(comment, ids = new Set()) {
  ids.add(comment.id);
  for (const reply of comment.replies || []) {
    collectCommentIds(reply, ids);
  }
  return ids;
}

export default function ForumComments({
  postId,
  initialCount = 0,
  user,
  profilePicture,
  isAdmin = false,
  language,
  showDivider = true,
  onCountChange,
  t,
}) {
  const [comments, setComments] = useState([]);
  const [count, setCount] = useState(Number(initialCount) || 0);
  const countRef = useRef(Number(initialCount) || 0);
  const submitLock = useRef(false);
  const mutationVersion = useRef(0);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [newComment, setNewComment] = useState("");
  const [commentAnonymous, setCommentAnonymous] = useState(false);

  useEffect(() => {
    const initial = Number(initialCount) || 0;
    countRef.current = initial;
    setCount(initial);
  }, [initialCount]);

  const fetchComments = async ({ silent = false } = {}) => {
    const requestVersion = mutationVersion.current;
    if (!silent) setLoading(true);
    try {
      const response = await fetch(
        `/api/forum/comments/list?post_id=${encodeURIComponent(postId)}`,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Error loading comments");
      if (requestVersion !== mutationVersion.current) return false;
      setComments(data.comments || []);
      const actualCount = (data.comments || []).length;
      countRef.current = actualCount;
      setCount(actualCount);
      onCountChange?.(actualCount);
      setLoaded(true);
      return true;
    } catch (fetchError) {
      console.error(fetchError);
      if (!silent) setError("Error loading comments");
      return false;
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const toggleComments = () => {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen && !loaded) void fetchComments();
  };

  const createComment = async (parentCommentId, content, isAnonymous) => {
    if (submitLock.current) return false;
    submitLock.current = true;
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/forum/comments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post_id: postId,
          ...(parentCommentId ? { parent_comment_id: parentCommentId } : {}),
          content,
          is_anonymous: isAnonymous,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to create comment");
      }

      // Render the server-confirmed parent link immediately; then reconcile in
      // the background so a temporary list-read failure cannot hide a reply.
      mutationVersion.current += 1;
      setComments((previous) => [...previous, data.comment]);
      setLoaded(true);
      const nextCount = countRef.current + 1;
      countRef.current = nextCount;
      setCount(nextCount);
      onCountChange?.(nextCount);
      void fetchComments({ silent: true });
      return true;
    } catch (createError) {
      console.error(createError);
      setError(messageKeyFromError(createError.message, "Failed to create comment"));
      return false;
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  const handleCreateTopLevelComment = async (event) => {
    event.preventDefault();
    const content = newComment.trim();
    if (!content || submitting) return;

    const created = await createComment(null, content, commentAnonymous);
    if (created) setNewComment("");
  };

  const handleCreateReply = (parentCommentId, content, isAnonymous) =>
    createComment(parentCommentId, content, isAnonymous);

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm(t("Delete this comment and its replies?"))) return;

    const tree = buildCommentTree(comments);
    const findComment = (nodes) => {
      for (const node of nodes) {
        if (node.id === commentId) return node;
        const nested = findComment(node.replies || []);
        if (nested) return nested;
      }
      return null;
    };
    const target = findComment(tree);
    const removedIds = target ? collectCommentIds(target) : new Set([commentId]);

    setError(null);
    try {
      const response = await fetch("/api/forum/comments/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment_id: commentId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to delete comment");

      mutationVersion.current += 1;
      setComments((previous) =>
        previous.filter((comment) => !removedIds.has(comment.id)),
      );
      const nextCount = Math.max(0, countRef.current - removedIds.size);
      countRef.current = nextCount;
      setCount(nextCount);
      onCountChange?.(nextCount);
      void fetchComments({ silent: true });
    } catch (deleteError) {
      console.error(deleteError);
      setError(messageKeyFromError(deleteError.message, "Failed to delete comment"));
    }
  };

  const commentTree = buildCommentTree(comments);
  const currentName = user?.name || user?.email || t("Name");

  return (
    <section className="min-w-0" aria-label={t("Comments: {count}", { count })}>
      <div
        className={`flex items-center pt-2 ${showDivider ? "border-t border-slate-100" : ""}`}
      >
        <button
          type="button"
          onClick={toggleComments}
          aria-expanded={open}
          aria-label={t("Comments: {count}", { count })}
          className="inline-flex min-h-9 items-center gap-2 rounded-md border border-transparent px-2 text-sm font-medium text-slate-600 transition-colors hover:bg-sky-50 hover:text-[#093388]"
        >
          <MessageCircle aria-hidden="true" size={18} strokeWidth={1.8} />
          <span>{count}</span>
        </button>
      </div>

      {open && (
        <div className="forum-comment-enter mt-2 min-w-0 border-t border-slate-100">
          {error && (
            <div
              role="alert"
              className="mx-1 mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {t(error)}
            </div>
          )}

          <form
            onSubmit={handleCreateTopLevelComment}
            className="flex min-w-0 items-start gap-2 border-b border-slate-100 px-1 py-3 sm:gap-3"
          >
            <ProfileAvatar
              src={profilePicture}
              name={currentName}
              className="mt-1 h-8 w-8"
            />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-end gap-2">
                <textarea
                  value={newComment}
                  onChange={(event) => setNewComment(event.target.value)}
                  rows={1}
                  maxLength={MAX_COMMENT_LENGTH}
                  aria-label={t("Add a comment...")}
                  placeholder={t("Add a comment...")}
                  className="min-h-10 min-w-0 flex-1 resize-y rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-[#009EE0] focus:bg-white focus:ring-2 focus:ring-[#009EE0]/20"
                  required
                />
                <button
                  type="submit"
                  disabled={submitting || !newComment.trim()}
                  className="min-h-10 shrink-0 rounded-md border border-[#082a6b] bg-[#093388] px-3 text-sm font-semibold text-white transition hover:bg-[#082a6b] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t("Send")}
                </button>
              </div>
              <label className="mt-2 inline-flex items-center gap-2 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={commentAnonymous}
                  onChange={(event) => setCommentAnonymous(event.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-[#093388] focus:ring-[#009EE0]"
                />
                {t("Comment anonymously")}
              </label>
            </div>
          </form>

          {loading ? (
            <p className="px-1 py-4 text-sm text-slate-500">{t("Loading...")}</p>
          ) : commentTree.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {commentTree.map((comment) => (
                <div key={comment.id} className="py-3 first:pt-4 last:pb-4">
                  <ForumComment
                    comment={comment}
                    isAdmin={isAdmin}
                    language={language}
                    onReply={handleCreateReply}
                    onDelete={handleDeleteComment}
                    t={t}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="px-1 py-4 text-sm text-slate-500">
              {t("No comments yet")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
