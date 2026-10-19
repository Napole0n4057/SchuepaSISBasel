export const NOTIFICATION_SECTIONS = ["votes", "forum", "blog"];

export function contentTime(value) {
  if (!value) return 0;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : 0;
  const raw = String(value).replace(" ", "T");
  // Existing content timestamps are stored as UTC without a timezone.
  const time = Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw) ? raw : `${raw}Z`);
  return Number.isFinite(time) ? time : 0;
}

export function latestContentTime(items = []) {
  return items.reduce((latest, item) => Math.max(latest, contentTime(item.created_at)), 0);
}

export function notificationStorageKey(userId) {
  return `sis:section-seen:${userId}`;
}

export function readSectionSeen(userId) {
  try {
    const stored = JSON.parse(window.localStorage.getItem(notificationStorageKey(userId)) || "{}");
    return Object.fromEntries(NOTIFICATION_SECTIONS.map((section) => [
      section,
      Number.isFinite(stored?.[section]) && stored[section] > 0 ? stored[section] : 0,
    ]));
  } catch {
    return {};
  }
}
