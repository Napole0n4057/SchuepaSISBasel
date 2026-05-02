import { useState, useEffect } from "react";
import useUser from "@/utils/useUser";

export default function SettingsPage() {
  const { data: user, loading: userLoading } = useUser();
  const [profilePicture, setProfilePicture] = useState("");
  const [defaultAnonymous, setDefaultAnonymous] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (!userLoading && user) {
      fetchSettings();
      extractDisplayName();
    }
  }, [user, userLoading]);

  const extractDisplayName = () => {
    if (!user?.email) return;

    const localPart = user.email.split("@")[0];
    const name = localPart
      .replace(/[._-]/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");

    setDisplayName(name);
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings/get");
      const data = await res.json();

      if (data.settings) {
        setProfilePicture(data.settings.profile_picture || "");
        setDefaultAnonymous(data.settings.default_anonymous || false);
      }

      setLoading(false);
    } catch (err) {
      console.error(err);
      setError("Fehler beim Laden der Einstellungen / Error loading settings");
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();

    try {
      setError(null);
      setSuccess(null);

      const res = await fetch("/api/settings/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_picture: profilePicture,
          default_anonymous: defaultAnonymous,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to update settings");
      }

      setSuccess("Einstellungen gespeichert / Settings saved");
    } catch (err) {
      console.error(err);
      setError("Fehler beim Speichern / Error saving settings");
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
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Einstellungen / Settings
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
          <form onSubmit={handleSave} className="space-y-6">
            {/* Display Name (read-only) */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Anzeigename / Display Name
              </label>
              <div className="rounded-md border border-gray-300 bg-gray-50 px-4 py-2 text-gray-600">
                {displayName}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Automatisch aus Ihrer E-Mail generiert / Auto-generated from
                your email
              </p>
            </div>

            {/* Profile Picture URL */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Profilbild URL / Profile Picture URL
              </label>
              <input
                type="url"
                value={profilePicture}
                onChange={(e) => setProfilePicture(e.target.value)}
                placeholder="https://example.com/picture.jpg"
                className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
              {profilePicture && (
                <div className="mt-3">
                  <img
                    src={profilePicture}
                    alt="Profile Preview"
                    className="h-24 w-24 rounded-full object-cover border-2 border-gray-200"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                </div>
              )}
            </div>

            {/* Default Anonymous */}
            <div>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={defaultAnonymous}
                  onChange={(e) => setDefaultAnonymous(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                />
                <span className="text-sm font-semibold text-gray-900">
                  Standardmäßig anonym posten / Post anonymously by default
                </span>
              </label>
              <p className="mt-1 ml-7 text-xs text-gray-500">
                Sie können dies für jeden Beitrag ändern / You can change this
                for each post
              </p>
            </div>

            <button
              type="submit"
              className="w-full rounded-md bg-gray-900 px-6 py-3 text-base font-medium text-white hover:bg-gray-800"
            >
              Speichern / Save
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
