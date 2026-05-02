import { useState } from "react";
import useUser from "@/utils/useUser";

export default function MakeAdminPage() {
  const { data: user, loading: userLoading } = useUser();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const handleMakeAdmin = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/make-first-admin", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to make admin");
      }

      setSuccess(true);
    } catch (err) {
      console.error(err);
      setError(err.message || "Fehler / Error");
    } finally {
      setLoading(false);
    }
  };

  if (userLoading) {
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
          <p className="mb-4 text-lg text-gray-600">
            Bitte melden Sie sich zuerst an / Please sign in first
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
    <div className="flex min-h-screen items-center justify-center bg-white p-4 font-['Helvetica_Neue',Helvetica,Arial,sans-serif]">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg border border-gray-200">
        <div className="mb-8 flex justify-center">
          <a href="/" aria-label="Zur Startseite / Back to Home">
            <img
              src="https://theinternationalschools.com/ch/wp-content/uploads/sites/7/2021/11/sis-basel-logo-the-international-schools-group-switzerland-TISG.png.webp"
              alt="SIS Basel Logo"
              className="h-24 w-auto mix-blend-multiply"
            />
          </a>
        </div>

        <h1 className="mb-2 text-center text-2xl font-bold text-gray-900">
          Zum Administrator machen
        </h1>
        <p className="mb-8 text-center text-lg text-gray-600">
          Make Yourself Admin
        </p>

        {!success && (
          <>
            <div className="mb-6 rounded-md bg-yellow-50 border border-yellow-200 p-4 text-sm text-yellow-800">
              <p className="font-semibold mb-2">
                Wichtiger Hinweis / Important Notice:
              </p>
              <p className="mb-2">
                Diese Seite macht Sie zum Administrator. Löschen Sie diese Seite
                und Route nach der Verwendung!
              </p>
              <p>
                This page will make you an admin. Delete this page and route
                after using it!
              </p>
              <p className="mt-2 text-xs">
                Route zu löschen / Route to delete:{" "}
                <code className="bg-yellow-100 px-1 rounded">
                  /apps/web/src/app/api/make-first-admin/route.js
                </code>
              </p>
            </div>

            <p className="mb-6 text-sm text-gray-600 text-center">
              Angemeldet als / Signed in as:{" "}
              <span className="font-semibold">{user.email}</span>
            </p>

            {error && (
              <div className="mb-6 rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              onClick={handleMakeAdmin}
              disabled={loading}
              className="w-full rounded-md bg-gray-900 px-4 py-3 text-base font-medium text-white transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-50"
            >
              {loading
                ? "Lädt... / Loading..."
                : "Zum Administrator machen / Make Me Admin"}
            </button>
          </>
        )}

        {success && (
          <div className="text-center">
            <div className="mb-6 rounded-md bg-green-50 border border-green-200 p-4 text-sm text-green-600">
              <p className="font-semibold mb-2">Erfolg / Success!</p>
              <p>Sie sind jetzt Administrator! / You are now an admin!</p>
            </div>
            <a
              href="/admin"
              className="inline-block rounded-md bg-gray-900 px-6 py-3 text-base font-medium text-white hover:bg-gray-800"
            >
              Zur Admin-Seite / Go to Admin Page
            </a>
            <p className="mt-4 text-xs text-gray-500">
              Vergessen Sie nicht, die /api/make-first-admin Route zu löschen!
              <br />
              Don't forget to delete the /api/make-first-admin route!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
