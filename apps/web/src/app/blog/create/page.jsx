import { useState, useEffect } from "react";
import useUser from "@/utils/useUser";

export default function CreateBlogPage() {
  const { data: user, loading: userLoading } = useUser();
  const [userRole, setUserRole] = useState(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (!userLoading && user) {
      fetchUserRole();
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim() || !content.trim()) {
      setError("Titel und Inhalt erforderlich / Title and content required");
      return;
    }

    try {
      setError(null);
      setSuccess(null);

      const res = await fetch("/api/blog/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });

      if (!res.ok) {
        throw new Error("Failed to create blog post");
      }

      setSuccess("Blog-Beitrag erstellt! / Blog post created!");
      setTitle("");
      setContent("");

      setTimeout(() => {
        window.location.href = "/";
      }, 1500);
    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  };

  if (userLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 font-['Helvetica_Neue',Helvetica,Arial,sans-serif]">
        <p className="text-lg text-gray-600">Lädt... / Loading...</p>
      </div>
    );
  }

  if (!user || userRole?.designation !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 font-['Helvetica_Neue',Helvetica,Arial,sans-serif]">
        <div className="text-center">
          <p className="mb-4 text-lg text-gray-600">
            Zugriff verweigert - Nur für Administratoren / Access denied - Admin
            only
          </p>
          <a href="/" className="text-gray-900 hover:text-gray-700 font-medium">
            ← Zurück zur Startseite / Back to Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-['Helvetica_Neue',Helvetica,Arial,sans-serif]">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Blog-Beitrag erstellen / Create Blog Post
          </h1>
          <a href="/" className="text-sm text-gray-600 hover:text-gray-900">
            ← Zurück zur Startseite / Back to Home
          </a>
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

        <div className="rounded-lg bg-white p-6 shadow-md border border-gray-200">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Titel / Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Inhalt / Content *
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={12}
                className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-md bg-gray-900 px-6 py-3 text-base font-medium text-white hover:bg-gray-800"
            >
              Veröffentlichen / Publish
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
