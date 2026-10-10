import { useState, useEffect } from "react";
import useUser from "@/utils/useUser";
import ProfileAvatar from "@/components/ProfileAvatar";
import { useLanguage } from "@/i18n";

export default function HomePage() {
  const { data: user, loading: userLoading } = useUser();
  const { language, t } = useLanguage();
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [blogPosts, setBlogPosts] = useState([]);

  useEffect(() => {
    if (!userLoading && user) {
      fetchUserRole();
      fetchBlogPosts();
    } else if (!userLoading && !user) {
      setLoading(false);
    }
  }, [user, userLoading]);

  const fetchUserRole = async () => {
    try {
      const res = await fetch("/api/user-roles/get");
      const data = await res.json();
      setUserRole(data.role);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const fetchBlogPosts = async () => {
    try {
      const res = await fetch("/api/blog/list");
      const data = await res.json();
      setBlogPosts(data.posts || []);
    } catch (err) {
      console.error(err);
    }
  };

  if (userLoading || loading) {
    return (
      <div className="app-page flex min-h-screen items-center justify-center bg-white font-['Helvetica_Neue',Helvetica,Arial,sans-serif]">
        <p className="text-lg text-gray-600">{t("Loading...")}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app-page flex min-h-screen items-center justify-center bg-white font-['Helvetica_Neue',Helvetica,Arial,sans-serif]">
        <div className="text-center max-w-md">
          <a href="/" aria-label={t("Home")}>
            <img
              src="/sis-student-parliament-logo.png"
              alt={t("SIS Basel logo")}
              className="mx-auto mb-8 h-32 w-auto"
            />
          </a>
          <h1 className="mb-4 text-3xl font-bold text-gray-900">{t("Welcome")}</h1>
          <a
            href="/account/signin"
            className="inline-block rounded-md bg-gray-900 px-6 py-3 text-base font-medium text-white hover:bg-gray-800"
          >
            {t("Sign in")}
          </a>
          <p className="mt-4 text-sm text-gray-600">
            {t("Sign-in access requires a school-approved account")}
          </p>
        </div>
      </div>
    );
  }

  const isAdminOrSpectator =
    userRole?.designation === "admin" || userRole?.designation === "spectator";

  return (
    <div className="app-page min-h-screen bg-gray-50 font-['Helvetica_Neue',Helvetica,Arial,sans-serif]">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/" aria-label={t("Home")}>
              <img
                src="/sis-student-parliament-logo.png"
                alt={t("SIS Basel logo")}
                className="h-16 w-auto"
              />
            </a>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {t("SIS Basel School Council")}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {t("Welcome, {name}", { name: user.name || user.email })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/settings"
              className="rounded-md bg-white border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
            >
              {t("Settings")}
            </a>
            <a
              href="/account/logout"
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              {t("Log out")}
            </a>
          </div>
        </div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <a
            href="/votes"
            className="rounded-lg bg-white p-6 shadow-md border border-gray-200 hover:border-gray-900 transition-colors"
          >
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {t("Votes")}
            </h3>
            <p className="text-sm text-gray-600">
              {t("Vote and view results")}
            </p>
          </a>

          <a
            href="/forum"
            className="rounded-lg bg-white p-6 shadow-md border border-gray-200 hover:border-gray-900 transition-colors"
          >
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {t("Community Forum")}
            </h3>
            <p className="text-sm text-gray-600">
              {t("Discuss and share")}
            </p>
          </a>

          {isAdminOrSpectator && (
            <a
              href="/admin"
              className="rounded-lg bg-white p-6 shadow-md border border-gray-200 hover:border-gray-900 transition-colors"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {t("Administration")}
              </h3>
              <p className="text-sm text-gray-600">
                {t("Manage users and roles")}
              </p>
            </a>
          )}
        </div>

        {/* Official Blog Section */}
        <div className="rounded-lg bg-white p-6 shadow-md border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {t("Official Blog")}
            </h2>
            {userRole?.designation === "admin" && (
              <a
                href="/blog/create"
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
              >
                {t("Create post")}
              </a>
            )}
          </div>

          {blogPosts.length > 0 ? (
            <div className="space-y-6">
              {blogPosts.slice(0, 3).map((post) => (
                <div
                  key={post.id}
                  className="border-b border-gray-200 pb-6 last:border-0 last:pb-0"
                >
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {post.title}
                  </h3>
                  <div className="flex items-center gap-2 mb-3 text-sm text-gray-600">
                    <ProfileAvatar
                      src={post.profile_picture}
                      name={post.author_name}
                      className="h-7 w-7"
                    />
                    <span>{post.author_name}</span>
                    <span>•</span>
                    <span>
                      {new Date(post.created_at).toLocaleDateString(language === "de" ? "de-CH" : "en-GB")}
                    </span>
                  </div>
                  <p className="text-gray-700 line-clamp-3">{post.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              {t("No blog posts yet")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
