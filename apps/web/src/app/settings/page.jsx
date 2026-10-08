import { useState, useEffect, useRef } from "react";
import useUser from "@/utils/useUser";
import ProfileAvatar from "@/components/ProfileAvatar";
import { extractNameFromEmail } from "@/app/api/utils/nameHelper.js";
import { messageKeyFromError, useLanguage } from "@/i18n";

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxImageSize = 5 * 1024 * 1024;

export default function SettingsPage() {
  const { data: user, loading: userLoading } = useUser();
  const { language, setLanguage, t } = useLanguage();
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
      setError("Could not load settings");
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
        throw new Error(data?.error || "Unable to save settings");
      }

      setSuccess(
        selectedImagePreview
          ? "The selected image is only a preview and has not been stored permanently."
          : "Settings saved",
      );
    } catch (err) {
      console.error(err);
      setError(messageKeyFromError(err instanceof Error ? err.message : "", "Could not save settings"));
    }
  };

  const handleImageSelection = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!allowedImageTypes.has(file.type)) {
      setError("Choose a JPG, PNG, or WebP image.");
      return;
    }

    if (file.size > maxImageSize) {
      setError("The image must be 5 MB or smaller.");
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
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {t("Settings")}
          </h1>
          <a href="/" className="text-sm text-gray-600 hover:text-gray-900">
            {t("Back to home")}
          </a>
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

        <div className="rounded-lg bg-white p-6 shadow-md border border-gray-200">
          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <label htmlFor="language" className="mb-2 block text-sm font-semibold text-gray-900">
                {t("Language")}
              </label>
              <select
                id="language"
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              >
                <option value="de">Deutsch</option>
                <option value="en">English</option>
              </select>
            </div>

            {/* Account name (read-only) */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                {t("Display name")}
              </label>
              <div className="rounded-md border border-gray-300 bg-gray-50 px-4 py-2 text-gray-600">
                {displayName}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {t("From your signed-in account")}
              </p>
            </div>

            {/* Profile picture upload preview */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                {t("Profile picture")}
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
                    aria-label={t("Choose profile picture")}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
                  >
                    {displayedProfilePicture
                      ? t("Change profile picture")
                      : t("Upload profile picture")}
                  </button>
                  {displayedProfilePicture && (
                    <button
                      type="button"
                      onClick={handleRemoveProfilePicture}
                      className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      {t("Remove picture")}
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {t("JPG, PNG or WebP, maximum 5 MB. Selected images are only previewed and are not stored permanently yet.")}
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
                  {t("Default anonymity")}
                </span>
              </label>
              <p className="mt-1 ml-7 text-xs text-gray-500">
                {t("You can change this for each post")}
              </p>
            </div>

            <button
              type="submit"
              className="w-full rounded-md bg-gray-900 px-6 py-3 text-base font-medium text-white hover:bg-gray-800"
            >
              {t("Save")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
