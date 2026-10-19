import { describe, expect, it } from "vitest";
import {
  calculateVoteResults,
  formatSwissDeadline,
  matchesVoteClass,
  voteHasEnded,
} from "./voteResults";

describe("vote result and class helpers", () => {
  it("calculates totals, percentages, and a single winner from option counts", () => {
    const results = calculateVoteResults([
      { id: "yes", option_text: "Yes", vote_count: "4" },
      { id: "no", option_text: "No", vote_count: "6" },
    ]);

    expect(results.totalVotes).toBe(10);
    expect(results.options.map((option) => option.percentage)).toEqual([40, 60]);
    expect(results.winner.id).toBe("no");
    expect(results.tied).toBe(false);
  });

  it("reports a tie without choosing an arbitrary winner", () => {
    const results = calculateVoteResults([
      { id: "first", vote_count: "3" },
      { id: "second", vote_count: "3" },
      { id: "third", vote_count: "1" },
    ]);

    expect(results.totalVotes).toBe(7);
    expect(results.tied).toBe(true);
    expect(results.winner).toBeNull();
  });

  it("returns an empty-results summary when nobody voted", () => {
    const results = calculateVoteResults([
      { id: "first", vote_count: "0" },
      { id: "second", vote_count: 0 },
    ]);

    expect(results.totalVotes).toBe(0);
    expect(results.options.map((option) => option.percentage)).toEqual([0, 0]);
    expect(results.tied).toBe(false);
    expect(results.winner).toBeNull();
  });

  it("keeps school-wide votes in every class filter and matches each assigned class", () => {
    expect(matchesVoteClass({ class_names: [] }, "Gym 2")).toBe(true);
    expect(matchesVoteClass({ class_names: ["Gym 2", "Int 1"] }, "Gym 2")).toBe(true);
    expect(matchesVoteClass({ class_names: ["Gym 2", "Int 1"] }, "Int 1")).toBe(true);
    expect(matchesVoteClass({ class_names: ["Gym 2", "Int 1"] }, "Gym 1")).toBe(false);
    expect(matchesVoteClass({ class_names: ["Gym 2"] }, "")).toBe(true);
  });

  it("moves votes to history at the exact deadline even with a stale active status", () => {
    const vote = { is_active: true, status: "active", ends_at: "2026-10-19T10:00:00" };
    const deadline = Date.parse("2026-10-19T10:00:00Z");
    expect(voteHasEnded(vote, deadline - 1)).toBe(false);
    expect(voteHasEnded(vote, deadline)).toBe(true);
    expect(voteHasEnded(vote, deadline + 1)).toBe(true);
    expect(voteHasEnded({ ...vote, ends_at: null }, deadline)).toBe(false);
    expect(voteHasEnded({ ...vote, is_active: false }, deadline - 1)).toBe(true);
    expect(voteHasEnded({ ...vote, is_active: null }, deadline - 1)).toBe(true);
  });

  it("formats a UTC wall-time deadline as Swiss local time in either language", () => {
    const deadline = "2026-10-09T16:05:00.000Z";

    expect(formatSwissDeadline(deadline, "en")).toBe("9 Oct 2026, 18:05");
    expect(formatSwissDeadline(deadline, "de")).toContain("18:05");
  });
});
