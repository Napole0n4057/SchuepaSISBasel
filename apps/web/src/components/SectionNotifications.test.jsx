import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LanguageProvider } from "@/i18n";
import { contentTime, notificationStorageKey } from "@/utils/sectionNotifications";
import { NotificationDot, SectionNotificationProvider, useSectionNotifications } from "./SectionNotifications";

const session = vi.hoisted(() => ({ user: { id: "alice" } }));
vi.mock("@/utils/useUser", () => ({ default: () => ({ data: session.user }) }));

const oldPost = "2026-10-18T08:00:00";
const newPost = "2026-10-19T08:00:00";
let latest;

function Navigation() {
  const { markSeen } = useSectionNotifications();
  return <>
    <a href="/votes">Votes<NotificationDot section="votes" /></a>
    <a href="/forum">Forum<NotificationDot section="forum" /></a>
    <a href="/">Blog<NotificationDot section="blog" /></a>
    <button onClick={() => markSeen("votes", [{ created_at: oldPost }])}>Visit votes</button>
    <button onClick={() => markSeen("forum", [{ created_at: oldPost }])}>Visit forum</button>
    <button onClick={() => markSeen("blog", [{ created_at: oldPost }])}>Visit blog</button>
  </>;
}

function App() {
  return <LanguageProvider><SectionNotificationProvider><Navigation /></SectionNotificationProvider></LanguageProvider>;
}

beforeEach(() => {
  window.localStorage.clear();
  session.user = { id: "alice" };
  latest = { votes: oldPost, forum: oldPost, blog: oldPost };
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ latest })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("navigation notification dots", () => {
  it("shows school-blue dots and clears each section only after a visit, persisting across reloads", async () => {
    const view = render(<App />);
    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(3));
    expect(screen.getAllByRole("img")[0].firstChild).toHaveClass("bg-[#093388]", "h-2", "w-2");
    fireEvent.click(screen.getByText("Visit votes"));
    expect(screen.getAllByRole("img")).toHaveLength(2);
    fireEvent.click(screen.getByText("Visit forum"));
    fireEvent.click(screen.getByText("Visit blog"));
    expect(screen.queryAllByRole("img")).toHaveLength(0);
    expect(JSON.parse(window.localStorage.getItem(notificationStorageKey("alice"))).votes).toBe(contentTime(oldPost));
    view.unmount();
    render(<App />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });

  it("does not mark newer content as read when only an older list was loaded", async () => {
    latest.votes = newPost;
    render(<App />);
    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(3));
    fireEvent.click(screen.getByText("Visit votes"));
    expect(screen.getAllByRole("img")).toHaveLength(3);
  });

  it("shows a dot again for new content on focus and synchronises visits from another tab", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(3));
    fireEvent.click(screen.getByText("Visit votes"));
    latest.votes = newPost;
    fireEvent.focus(window);
    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(3));
    window.localStorage.setItem(notificationStorageKey("alice"), JSON.stringify({ votes: contentTime(newPost) }));
    fireEvent(window, new StorageEvent("storage", { key: notificationStorageKey("alice") }));
    expect(screen.getAllByRole("img")).toHaveLength(2);
  });

  it("keeps read state separate between accounts and hides dots after logout", async () => {
    const view = render(<App />);
    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(3));
    fireEvent.click(screen.getByText("Visit votes"));
    session.user = { id: "bob" };
    view.rerender(<App />);
    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(3));
    session.user = null;
    view.rerender(<App />);
    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });

  it("handles unavailable or malformed browser storage and failed notification requests", async () => {
    window.localStorage.setItem(notificationStorageKey("alice"), "invalid-json");
    const view = render(<App />);
    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(3));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage disabled"); });
    fireEvent.click(screen.getByText("Visit votes"));
    expect(screen.getAllByRole("img")).toHaveLength(2);
    view.unmount();
    fetch.mockResolvedValue(Response.json({ error: "Unavailable" }, { status: 503 }));
    render(<App />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });

  it.each([["de", "Neue Inhalte"], ["en", "New content"]])("provides a %s accessible label on mobile and desktop", async (language, label) => {
    window.localStorage.setItem("schuepas.language", language);
    render(<App />);
    await waitFor(() => expect(screen.getAllByRole("img", { name: label })).toHaveLength(3));
  });
});
