import { useState, useEffect } from "react";
import useUser from "@/utils/useUser";
import ProfileAvatar from "@/components/ProfileAvatar";
import { messageKeyFromError, useLanguage } from "@/i18n";

export default function ForumPage() {
  const { data: user, loading: userLoading } = useUser();
  const { language, t } = useLanguage();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [userSettings, setUserSettings] = useState(null);
  const [userRole, setUserRole] = useState(null);

  // Create post state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [postAnonymous, setPostAnonymous] = useState(false);

  useEffect(() => {
    if (!userLoading && user) {
      fetchUserRole();
      fetchSettings();
      fetchPosts();
    }
  }, [user, userLoading]);

  const fetchUserRole = async () => {
    try {
      const res = await fetch("/api/user-roles/get");
      const data = await res.json();
      setUserRole(data.role);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings/get");
      const data = await res.json();
      setUserSettings(data.settings);
      setPostAnonymous(data.settings?.default_anonymous || false);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPosts = async () => {
    try {
      const res = await fetch("/api/forum/posts/list");
      const data = await res.json();
      setPosts(data.posts || []);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError("Error loading posts");
      setLoading(false);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();

    if (!newTitle.trim() || !newContent.trim()) {
      setError("Title and content are required");
      return;
    }

    try {
      setError(null);
      setSuccess(null);

      const res = await fetch("/api/forum/posts/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          content: newContent,
          is_anonymous: postAnonymous,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create post");
      }

      setSuccess("Post created");
      setShowCreateForm(false);
      setNewTitle("");
      setNewContent("");
      setPostAnonymous(userSettings?.default_anonymous || false);
      fetchPosts();
    } catch (err) {
      console.error(err);
      setError(messageKeyFromError(err.message, "Failed to create post"));
    }
  };

  const handleVote = async (postId, voteType) => {
    try {
      const res = await fetch("/api/forum/posts/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: postId, vote_type: voteType }),
      });

      if (!res.ok) {
        throw new Error("Failed to vote");
      }

      fetchPosts();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeletePost = async (postId) => {
    const confirmed = window.confirm(
      t("Delete this post?"),
    );
    if (!confirmed) return;

    try {
      setError(null);
      setSuccess(null);

      const res = await fetch("/api/forum/posts/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: postId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete post");
      }

      setSuccess("Post removed");
      fetchPosts();
    } catch (err) {
      console.error(err);
      setError(messageKeyFromError(err.message, "Failed to delete post"));
    }
  };

  if (userLoading || loading) {
    return (
      <div className="app-page flex min-h-screen items-center justify-center bg-gray-50 font-['Helvetica_Neue',Helvetica,Arial,sans-serif]">
        <p className="text-lg text-gray-600">{t("Loading...")}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app-page flex min-h-screen items-center justify-center bg-gray-50 font-['Helvetica_Neue',Helvetica,Arial,sans-serif]">
        <div className="text-center">
          <p className="mb-4 text-lg text-gray-600">
            {t("Please sign in")}
          </p>
          <a
            href="/account/signin"
            className="text-gray-900 hover:text-gray-700 font-medium"
          >
            {t("Go to sign in")}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="app-page min-h-screen bg-gray-50 font-['Helvetica_Neue',Helvetica,Arial,sans-serif]">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {t("Community Forum")}
            </h1>
            <a href="/" className="text-sm text-gray-600 hover:text-gray-900">
              {t("Back to home")}
            </a>
          </div>

          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            {showCreateForm
              ? t("Cancel")
              : t("Create a post")}
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-600">
            {t(error)}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-md bg-green-50 border border-green-200 p-4 text-sm text-green-600">
            {t(success)}
          </div>
        )}

        {/* Create Post Form */}
        {showCreateForm && (
          <div className="mb-8 rounded-lg bg-white p-6 shadow-md border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {t("New post")}
            </h2>
            <form onSubmit={handleCreatePost} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  {t("Title *")}
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  {t("Content *")}
                </label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  rows={6}
                  className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  required
                />
              </div>

              <div>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={postAnonymous}
                    onChange={(e) => setPostAnonymous(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                  />
                  <span className="text-sm font-semibold text-gray-900">
                    {t("Post anonymously")}
                  </span>
                </label>
              </div>

              <button
                type="submit"
                className="w-full rounded-md bg-gray-900 px-6 py-3 text-base font-medium text-white hover:bg-gray-800"
              >
                {t("Create a post")}
              </button>
            </form>
          </div>
        )}

        {/* Posts List */}
        <div className="space-y-4">
          {posts.map((post) => (
            <div
              key={post.id}
              className="rounded-lg bg-white p-6 shadow-md border border-gray-200"
            >
              <div className="mb-4">
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {post.title}
                </h3>
                <div className="flex items-center gap-3 mb-3">
                  <ProfileAvatar
                    src={post.profile_picture}
                    name={post.author_name === "Anonymous" ? t("Anonymous") : post.author_name}
                    className="h-8 w-8"
                  />
                  <div className="text-sm text-gray-600">
                    {post.author_name === "Anonymous" ? t("Anonymous") : post.author_name}
                    <span className="mx-2">•</span>
                    {new Date(post.created_at).toLocaleDateString(language === "de" ? "de-CH" : "en-GB")}
                  </div>
                </div>
                <p className="text-gray-700 whitespace-pre-wrap">
                  {post.content}
                </p>
              </div>

              <div className="flex items-center gap-4 border-t border-gray-200 pt-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleVote(post.id, 1)}
                    className="text-gray-600 hover:text-green-600"
                  >
                    ▲
                  </button>
                  <span className="text-sm font-semibold text-gray-900">
                    {parseInt(post.upvotes) - parseInt(post.downvotes)}
                  </span>
                  <button
                    onClick={() => handleVote(post.id, -1)}
                    className="text-gray-600 hover:text-red-600"
                  >
                    ▼
                  </button>
                </div>
                <a
                  href={`/forum/${post.id}`}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  {t("Comments: {count}", { count: post.comment_count })}
                </a>
                {userRole?.designation === "admin" && (
                  <button
                    onClick={() => handleDeletePost(post.id)}
                    className="ml-auto rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                  >
                    {t("Remove post")}
                  </button>
                )}
              </div>
            </div>
          ))}

          {posts.length === 0 && (
            <div className="rounded-lg bg-white p-12 shadow-md border border-gray-200 text-center">
              <p className="text-gray-500">{t("No posts yet")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
