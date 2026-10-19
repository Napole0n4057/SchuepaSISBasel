import { createContext, useCallback, useContext, useEffect, useState } from "react";
import useUser from "@/utils/useUser";
import { useLanguage } from "@/i18n";
import {
  contentTime,
  latestContentTime,
  NOTIFICATION_SECTIONS,
  notificationStorageKey,
  readSectionSeen,
} from "@/utils/sectionNotifications";

const NotificationContext = createContext({ unread: {}, markSeen: () => {} });

export function SectionNotificationProvider({ children }) {
  const { data: user } = useUser();
  const userId = user?.id;
  const [state, setState] = useState({ userId: null, seen: {}, latest: {} });

  useEffect(() => {
    setState({ userId, seen: userId ? readSectionSeen(userId) : {}, latest: {} });
    if (!userId) return undefined;
    const controller = new AbortController();
    let inFlight = false;
    const refresh = async () => {
      if (document.visibilityState === "hidden" || inFlight) return;
      inFlight = true;
      try {
        const response = await fetch("/api/notifications", { signal: controller.signal, cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (!controller.signal.aborted) {
          setState((current) => ({ ...current, latest: data.latest || {} }));
        }
      } catch {
        // Notification failures must not interrupt navigation or content.
      } finally {
        inFlight = false;
      }
    };
    const syncSeen = (event) => {
      if (event.key === notificationStorageKey(userId)) {
        setState((current) => ({ ...current, seen: readSectionSeen(userId) }));
      }
    };
    refresh();
    const interval = window.setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", syncSeen);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", syncSeen);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [userId]);

  const markSeen = useCallback((section, items) => {
    if (!userId) return;
    const latest = latestContentTime(items);
    if (!latest) return;
    setState((current) => {
      if (current.userId !== userId) return current;
      const stored = readSectionSeen(userId);
      const seen = Object.fromEntries(NOTIFICATION_SECTIONS.map((name) => [
        name, Math.max(stored[name] || 0, current.seen[name] || 0),
      ]));
      seen[section] = Math.max(seen[section] || 0, latest);
      try {
        window.localStorage.setItem(notificationStorageKey(userId), JSON.stringify(seen));
      } catch {
        // Keep per-session state when browser storage is unavailable.
      }
      return { ...current, seen };
    });
  }, [userId]);

  const unread = Object.fromEntries(NOTIFICATION_SECTIONS.map((section) => [
    section,
    !!userId && state.userId === userId && contentTime(state.latest[section]) > (state.seen[section] || 0),
  ]));

  return <NotificationContext.Provider value={{ unread, markSeen }}>{children}</NotificationContext.Provider>;
}

export function useSectionNotifications() {
  return useContext(NotificationContext);
}

export function NotificationDot({ section }) {
  const { unread } = useSectionNotifications();
  const { t } = useLanguage();
  if (!unread[section]) return null;
  return (
    <span className="ml-2 inline-flex align-middle" role="img" aria-label={t("New content")}>
      <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-[#093388]" />
    </span>
  );
}
