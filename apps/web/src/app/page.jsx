import { useState, useEffect } from "react";
import useUser from "@/utils/useUser";

export default function HomePage() {
  const { data: user, loading: userLoading } = useUser();
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [blogPosts, setBlogPosts] = useState([]);
  const [checkedFirstVisit, setCheckedFirstVisit] = useState(false);

  useEffect(() => {
    if (!userLoading && user) {
      fetchUserRole();
      fetchBlogPosts();
    } else if (!userLoading && !user) {
      setLoading(false);
    }
  }, [user, userLoading]);

  useEffect(() => {
    if (userLoading) return;
    if (user) {
      setCheckedFirstVisit(true);
      return;
    }

    if (typeof window === "undefined") return;
    const firstVisitKey = "sis_first_visit";
    const hasVisited = window.localStorage.getItem(firstVisitKey);

    if (!hasVisited) {
      window.localStorage.setItem(firstVisitKey, "1");
      window.location.href = "/account/signup";
      return;
    }

    setCheckedFirstVisit(true);
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

  if (userLoading || loading || (!user && !checkedFirstVisit)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white font-['Helvetica_Neue',Helvetica,Arial,sans-serif]">
        <p className="text-lg text-gray-600">Lädt... / Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white font-['Helvetica_Neue',Helvetica,Arial,sans-serif]">
        <div className="text-center max-w-md">
          <a href="/" aria-label="Zur Startseite / Back to Home">
            <img
              src="/sis-student-parliament-logo.png"
              alt="SIS Basel Logo"
              className="mx-auto mb-8 h-32 w-auto"
            />
          </a>
          <h1 className="mb-4 text-3xl font-bold text-gray-900">Willkommen</h1>
          <p className="mb-8 text-lg text-gray-600">Welcome</p>
          <a
            href="/account/signin"
            className="inline-block rounded-md bg-gray-900 px-6 py-3 text-base font-medium text-white hover:bg-gray-800"
          >
            Anmelden / Sign In
          </a>
        </div>
      </div>
    );
  }

  const isAdminOrSpectator =
    userRole?.designation === "admin" || userRole?.designation === "spectator";

  return (
    <div className="min-h-screen bg-gray-50 font-['Helvetica_Neue',Helvetica,Arial,sans-serif]">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/" aria-label="Zur Startseite / Back to Home">
              <img
                src="/sis-student-parliament-logo.png"
                alt="SIS Basel Logo"
                className="h-16 w-auto"
              />
            </a>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                SIS Basel School Council
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Willkommen / Welcome, {user.email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/settings"
              className="rounded-md bg-white border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
            >
              Einstellungen / Settings
            </a>
            <a
              href="/account/logout"
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Abmelden / Logout
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
              Abstimmungen / Votes
            </h3>
            <p className="text-sm text-gray-600">
              Abstimmen und Ergebnisse sehen / Vote and view results
            </p>
          </a>

          <a
            href="/forum"
            className="rounded-lg bg-white p-6 shadow-md border border-gray-200 hover:border-gray-900 transition-colors"
          >
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Community Forum
            </h3>
            <p className="text-sm text-gray-600">
              Diskutieren und teilen / Discuss and share
            </p>
          </a>

          {isAdminOrSpectator && (
            <a
              href="/admin"
              className="rounded-lg bg-white p-6 shadow-md border border-gray-200 hover:border-gray-900 transition-colors"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Verwaltung / Admin
              </h3>
              <p className="text-sm text-gray-600">
                Benutzer und Rollen verwalten / Manage users and roles
              </p>
            </a>
          )}
        </div>

        {/* Official Blog Section */}
        <div className="rounded-lg bg-white p-6 shadow-md border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Offizieller Blog / Official Blog
            </h2>
            {userRole?.designation === "admin" && (
              <a
                href="/blog/create"
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
              >
                Beitrag erstellen / Create Post
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
                    <span>{post.author_name}</span>
                    <span>•</span>
                    <span>
                      {new Date(post.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-gray-700 line-clamp-3">{post.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              Keine Blogbeiträge / No blog posts yet
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
