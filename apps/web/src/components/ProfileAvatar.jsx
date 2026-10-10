import * as React from "react";
import { useLanguage } from "@/i18n";

export default function ProfileAvatar({ src, name, className = "" }) {
  const { t } = useLanguage();
  const [failedSource, setFailedSource] = React.useState(null);

  const imageSource =
    typeof src === "string" && src.startsWith("r2:")
      ? `/api/profile-picture?ref=${encodeURIComponent(src)}`
      : src;
  const hasImage = Boolean(imageSource) && failedSource !== imageSource;
  const accessibleName = name === "Anonymous" ? t("Anonymous") : name;
  const label = accessibleName
    ? t("Profile picture for {name}", { name: accessibleName })
    : t("Profile picture");

  return (
    <span
      role="img"
      aria-label={label}
      className={`relative inline-flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-300 bg-gray-200 ${className}`}
    >
      {hasImage ? (
        <img
          src={imageSource}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setFailedSource(imageSource)}
        />
      ) : (
        <svg
          data-testid="profile-avatar-fallback"
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          className="h-1/2 w-1/2 text-gray-500"
        >
          <circle
            cx="12"
            cy="8"
            r="4"
            stroke="currentColor"
            strokeWidth="1.7"
          />
          <path
            d="M4 21a8 8 0 0 1 16 0"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      )}
    </span>
  );
}
