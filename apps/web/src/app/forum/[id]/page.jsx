import { useEffect, useState } from "react";
import { useParams } from "react-router";
import useUser from "@/utils/useUser";
import ProfileAvatar from "@/components/ProfileAvatar";
import ForumComments from "@/components/ForumComments";
import { messageKeyFromError, useLanguage } from "@/i18n";

export default function ForumPostPage() {
  const { data: user, loading: userLoading } = useUser();
  const { language, t } = useLanguage();
  const { id } = useParams();

  const [post, setPost] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [profilePicture, setProfilePicture] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userLoading && user && id) {
      fetchUserRole();
      fetchPost();
      fetchProfilePicture();
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

  const fetchProfilePicture = async () => {
    try {
      const res = await fetch("/api/settings/get");
      const data = await res.json();
      setProfilePicture(data.settings?.profile_picture || null);
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
      setError("Error loading post");
      setLoading(false);
    }
  };

  const handleDeletePost = async () => {
    const confirmed = window.confirm(
      t("Delete this post?"),
    );
    if (!confirmed) return;

    try {
      setError(null);

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
              {t("Forum post")}
            </h1>
            <a href="/forum" className="text-sm text-gray-600 hover:text-gray-900">
              {t("Back to forum")}
            </a>
          </div>
          {userRole?.designation === "admin" && (
            <button
              onClick={handleDeletePost}
              className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              {t("Remove post")}
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-600">
            {t(error)}
          </div>
        )}

        {post && (
          <div className="mb-8 rounded-lg bg-white p-6 shadow-md border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {post.title}
            </h2>
            <div className="flex items-center gap-3 mb-4 text-sm text-gray-600">
              <ProfileAvatar
                src={post.profile_picture}
                name={post.author_name === "Anonymous" ? t("Anonymous") : post.author_name}
                className="h-8 w-8"
              />
              <span>{post.author_name === "Anonymous" ? t("Anonymous") : post.author_name}</span>
              <span>•</span>
              <span>{new Date(post.created_at).toLocaleDateString(language === "de" ? "de-CH" : "en-GB")}</span>
            </div>
            <p className="text-gray-700 whitespace-pre-wrap">{post.content}</p>
            <ForumComments
              postId={id}
              initialCount={post.comment_count}
              user={user}
              profilePicture={profilePicture}
              isAdmin={userRole?.designation === "admin"}
              language={language}
              onCountChange={(count) =>
                setPost((currentPost) =>
                  currentPost ? { ...currentPost, comment_count: count } : currentPost,
                )
              }
              t={t}
            />
          </div>
        )}
      </div>
    </div>
  );
}
