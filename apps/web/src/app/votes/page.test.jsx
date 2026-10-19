import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { STUDENT_CLASS_NAMES } from "@/studentClasses";

const fixtures = vi.hoisted(() => ({ role: "member", user: { id: "member" }, votes: [], markSeen: vi.fn() }));
vi.mock("@/utils/useUser", () => ({ default: () => ({ data: fixtures.user, loading: false }) }));
vi.mock("@/i18n", () => ({
  useLanguage: () => ({ language: "en", t: (key) => key }), messageKeyFromError: (message) => message,
}));
vi.mock("@/components/SectionNotifications", () => ({
  useSectionNotifications: () => ({ markSeen: fixtures.markSeen }), NotificationDot: () => null,
}));
vi.mock("recharts", () => ({
  ResponsiveContainer: () => null, PieChart: () => null, Pie: () => null, Cell: () => null, Tooltip: () => null,
}));
import VotesPage from "./page";

beforeEach(() => {
  fixtures.user = { id: "member" };
  fixtures.role = "member";
  fixtures.markSeen.mockClear();
  fixtures.votes = [{
    id: "past", title: "Completed class vote", status: "past", is_active: true, class_names: ["Int 6"],
    created_at: "2026-10-18T08:00:00", ends_at: "2026-10-18T09:00:00", options: [
      { id: "yes", option_text: "Yes", vote_count: "3" }, { id: "no", option_text: "No", vote_count: "1" },
    ],
  }];
  vi.stubGlobal("fetch", vi.fn(async (url) => {
    if (url === "/api/user-roles/get") return Response.json({ role: { designation: fixtures.role } });
    if (url === "/api/votes/list") return Response.json({ votes: fixtures.votes });
    throw new Error(`Unexpected request: ${url}`);
  }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("voting page history and class selection", () => {
  it("keeps completed votes in the existing history/results layout without voting controls", async () => {
    render(<VotesPage />);
    await screen.findByText("No active votes");
    fireEvent.click(screen.getByRole("button", { name: /^View past votes/ }));
    await screen.findByText("Completed class vote");
    fireEvent.click(screen.getByRole("button", { name: "View results" }));
    await screen.findByRole("heading", { name: "Completed class vote" });
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Yes/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^No/ })).toBeNull();
    expect(fetch.mock.calls.every(([url]) => url !== "/api/votes/cast")).toBe(true);
    expect(fixtures.markSeen).toHaveBeenCalledWith("votes", fixtures.votes);
  });

  it("uses the same twelve class choices in the filter and creation form", async () => {
    fixtures.role = "admin";
    render(<VotesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Create vote" }));
    const classes = screen.getByRole("group", { name: "Classes (optional)" });
    const names = within(classes).getAllByRole("button").slice(1).map((button) => button.textContent);
    expect(names).toEqual(STUDENT_CLASS_NAMES);
    const filter = screen.getByRole("combobox");
    expect(within(filter).getAllByRole("option").slice(1).map((option) => option.value)).toEqual(STUDENT_CLASS_NAMES);
  });

  it("moves an open vote to history at the deadline while the page remains open", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-10-19T08:00:00Z");
    vi.setSystemTime(now);
    fixtures.votes = [{ ...fixtures.votes[0], id: "active", title: "Ending now", status: "active", ends_at: "2026-10-19T08:00:01Z" }];
    render(<VotesPage />);
    await act(async () => {});
    expect(screen.getByRole("button", { name: /^Yes/ })).toBeEnabled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1001); });
    expect(screen.getByText("No active votes")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^View past votes/ }));
    expect(screen.getByText("Ending now")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Yes/ })).toBeNull();
  });

  it("keeps spectators' active ballot controls disabled", async () => {
    fixtures.role = "spectator";
    fixtures.votes = [{ ...fixtures.votes[0], status: "active", ends_at: null }];
    render(<VotesPage />);
    expect(await screen.findByRole("button", { name: /^Yes/ })).toBeDisabled();
  });

  it("shows the sign-in prompt for signed-out visitors", async () => {
    fixtures.user = null;
    render(<VotesPage />);
    await waitFor(() => expect(screen.getByText("Please sign in")).toBeInTheDocument());
    expect(fetch).not.toHaveBeenCalled();
  });
});
