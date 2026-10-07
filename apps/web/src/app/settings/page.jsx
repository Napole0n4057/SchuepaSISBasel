import { useState, useEffect, useRef } from "react";
import useUser from "@/utils/useUser";
import ProfileAvatar from "@/components/ProfileAvatar";
import { extractNameFromEmail } from "@/app/api/utils/nameHelper.js";

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxImageSize = 5 * 1024 * 1024;

export default function SettingsPage() {
  const { data: user, loading: userLoading } = useUser();
  const [profilePicture, setProfilePicture] = useState("");
  const [selectedImagePreview, setSelectedImagePreview] = useState("");
  const [removeProfilePicture, setRemoveProfilePicture] = useState(false);
  const [defaultAnonymous, setDefaultAnonymous] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const fileInputRef = useRef(null);
  const displayName =
    (typeof user?.name === "string" && user.name.trim()) ||
    extractNameFromEmail(user?.email);
  const displayedProfilePicture =
    selectedImagePreview || (removeProfilePicture ? "" : profilePicture);

  useEffect(() => {
    if (!userLoading && user) {
      fetchSettings();
    }
  }, [user, userLoading]);

  useEffect(() => {
    if (!selectedImagePreview) return undefined;
    return () => URL.revokeObjectURL(selectedImagePreview);
  }, [selectedImagePreview]);

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
          default_anonymous: defaultAnonymous,
          ...(removeProfilePicture ? { profile_picture: null } : {}),
        }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          data?.error || `Unable to save settings (HTTP ${res.status})`,
        );
      }

      setSuccess(
        selectedImagePreview
          ? "Einstellungen gespeichert. Das ausgewählte Bild ist nur eine Vorschau und wurde nicht dauerhaft gespeichert."
          : "Einstellungen gespeichert / Settings saved",
      );
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Unable to save settings");
    }
  };

  const handleImageSelection = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!allowedImageTypes.has(file.type)) {
      setError("Bitte wählen Sie eine JPG-, PNG- oder WebP-Bilddatei aus.");
      return;
    }

    if (file.size > maxImageSize) {
      setError("Das Bild darf höchstens 5 MB groß sein.");
      return;
    }

    setSelectedImagePreview(URL.createObjectURL(file));
    setRemoveProfilePicture(false);
    setError(null);
    setSuccess(null);
  };

  const handleRemoveProfilePicture = () => {
    setSelectedImagePreview("");
    setRemoveProfilePicture(true);
    setError(null);
    setSuccess(null);
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
            {/* Account name (read-only) */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Anzeigename / Display Name
              </label>
              <div className="rounded-md border border-gray-300 bg-gray-50 px-4 py-2 text-gray-600">
                {displayName}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Aus Ihrem angemeldeten Konto / From your signed-in account
              </p>
            </div>

            {/* Profile picture upload preview */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Profilbild / Profile picture
              </label>
              <div className="flex flex-wrap items-center gap-4">
                <ProfileAvatar
                  src={displayedProfilePicture}
                  name={displayName}
                  className="h-20 w-20"
                />
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageSelection}
                    className="sr-only"
                    aria-label="Profilbild auswählen / Choose profile picture"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
                  >
                    {displayedProfilePicture
                      ? "Profilbild ändern / Change profile picture"
                      : "Profilbild hochladen / Upload profile picture"}
                  </button>
                  {displayedProfilePicture && (
                    <button
                      type="button"
                      onClick={handleRemoveProfilePicture}
                      className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Profilbild entfernen / Remove picture
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                JPG, PNG oder WebP, maximal 5 MB. Ausgewählte Bilder werden
                derzeit nur als Vorschau angezeigt und noch nicht dauerhaft
                gespeichert.
              </p>
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
