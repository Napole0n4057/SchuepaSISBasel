import * as React from "react";

export default function ProfileAvatar({ src, name, className = "" }) {
  const [failedSource, setFailedSource] = React.useState(null);

  const hasImage = Boolean(src) && failedSource !== src;
  const label = name ? `${name} profile picture` : "Profile picture";

  return (
    <span
      role="img"
      aria-label={label}
      className={`relative inline-flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-300 bg-gray-200 ${className}`}
    >
      {hasImage ? (
        <img
          src={src}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setFailedSource(src)}
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
