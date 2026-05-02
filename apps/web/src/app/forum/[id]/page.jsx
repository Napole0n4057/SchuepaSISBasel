import { useEffect, useState } from "react";
import { useParams } from "react-router";
import useUser from "@/utils/useUser";

export default function ForumPostPage() {
  const { data: user, loading: userLoading } = useUser();
  const { id } = useParams();

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [newComment, setNewComment] = useState("");
  const [commentAnonymous, setCommentAnonymous] = useState(false);

  useEffect(() => {
    if (!userLoading && user && id) {
      fetchUserRole();
      fetchPost();
      fetchComments();
    }
  }, [user, userLoading, id]);

  const fetchUserRole = async () => {
    try {
      const res = await fetch("/api/user-roles/get");
      const data = await res.json();
      setUserRole(data.role);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPost = async () => {
    try {
      const res = await fetch(`/api/forum/posts/get?post_id=${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load post");
      setPost(data.post);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError("Fehler beim Laden / Error loading post");
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const res = await fetch(`/api/forum/comments/list?post_id=${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load comments");
      setComments(data.comments || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      setError(null);
      setSuccess(null);

      const res = await fetch("/api/forum/comments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post_id: id,
          content: newComment,
          is_anonymous: commentAnonymous,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create comment");
      }

      setNewComment("");
      setSuccess("Kommentar erstellt / Comment created");
      fetchComments();
    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  };

  const handleDeleteComment = async (commentId) => {
    const confirmed = window.confirm(
      "Diesen Kommentar löschen? / Delete this comment?",
    );
    if (!confirmed) return;

    try {
      setError(null);
      setSuccess(null);

      const res = await fetch("/api/forum/comments/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment_id: commentId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete comment");
      }

      setSuccess("Kommentar gelöscht / Comment removed");
      fetchComments();
    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  };

  const handleDeletePost = async () => {
    const confirmed = window.confirm(
      "Diesen Beitrag löschen? / Delete this post?",
    );
    if (!confirmed) return;

    try {
      setError(null);
      setSuccess(null);

      const res = await fetch("/api/forum/posts/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: id }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete post");
      }

      window.location.href = "/forum";
    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  };

  if (userLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 font-['Helvetica_Neue',Helvetica,Arial,sans-serif]">
        <p className="text-lg text-gray-600">Lädt... / Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 font-['Helvetica_Neue',Helvetica,Arial,sans-serif]">
        <div className="text-center">
          <p className="mb-4 text-lg text-gray-600">
            Bitte melden Sie sich an / Please sign in
          </p>
          <a
            href="/account/signin"
            className="text-gray-900 hover:text-gray-700 font-medium"
          >
            Zur Anmeldung / Go to Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-['Helvetica_Neue',Helvetica,Arial,sans-serif]">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Forum Beitrag / Forum Post
            </h1>
            <a href="/forum" className="text-sm text-gray-600 hover:text-gray-900">
              ← Zurück zum Forum / Back to Forum
            </a>
          </div>
          {userRole?.designation === "admin" && (
            <button
              onClick={handleDeletePost}
              className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              Beitrag entfernen / Remove
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-md bg-green-50 border border-green-200 p-4 text-sm text-green-600">
            {success}
          </div>
        )}

        {post && (
          <div className="mb-8 rounded-lg bg-white p-6 shadow-md border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {post.title}
            </h2>
            <div className="flex items-center gap-3 mb-4 text-sm text-gray-600">
              <div className="h-8 w-8 rounded-full bg-gray-200 border border-gray-300" />
              <span>{post.author_name}</span>
              <span>•</span>
              <span>{new Date(post.created_at).toLocaleDateString()}</span>
            </div>
            <p className="text-gray-700 whitespace-pre-wrap">{post.content}</p>
          </div>
        )}

        <div className="mb-6 rounded-lg bg-white p-6 shadow-md border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            Kommentar schreiben / Write a Comment
          </h3>
          <form onSubmit={handleCreateComment} className="space-y-4">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              required
            />
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={commentAnonymous}
                onChange={(e) => setCommentAnonymous(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
              />
              <span className="text-sm font-semibold text-gray-900">
                Anonym kommentieren / Comment anonymously
              </span>
            </label>
            <button
              type="submit"
              className="w-full rounded-md bg-gray-900 px-6 py-3 text-base font-medium text-white hover:bg-gray-800"
            >
              Kommentar senden / Post Comment
            </button>
          </form>
        </div>

        <div className="space-y-4">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="rounded-lg bg-white p-6 shadow-md border border-gray-200"
            >
              <div className="flex items-center gap-3 mb-3 text-sm text-gray-600">
                <div className="h-8 w-8 rounded-full bg-gray-200 border border-gray-300" />
                <span>{comment.author_name}</span>
                <span>•</span>
                <span>{new Date(comment.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-gray-700 whitespace-pre-wrap">
                {comment.content}
              </p>
              {userRole?.designation === "admin" && (
                <div className="mt-4">
                  <button
                    onClick={() => handleDeleteComment(comment.id)}
                    className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                  >
                    Kommentar entfernen / Remove
                  </button>
                </div>
              )}
            </div>
          ))}

          {comments.length === 0 && (
            <div className="rounded-lg bg-white p-12 shadow-md border border-gray-200 text-center">
              <p className="text-gray-500">Keine Kommentare / No comments yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
