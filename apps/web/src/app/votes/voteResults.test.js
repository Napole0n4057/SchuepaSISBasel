import { describe, expect, it } from "vitest";
import {
  calculateVoteResults,
  formatSwissDeadline,
  matchesVoteClass,
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
    expect(matchesVoteClass({ class_names: [] }, "G2")).toBe(true);
    expect(matchesVoteClass({ class_names: ["G2", "IB 1"] }, "G2")).toBe(true);
    expect(matchesVoteClass({ class_names: ["G2", "IB 1"] }, "IB 1")).toBe(true);
    expect(matchesVoteClass({ class_names: ["G2", "IB 1"] }, "S1")).toBe(false);
    expect(matchesVoteClass({ class_names: ["G2"] }, "")).toBe(true);
  });

  it("formats a UTC wall-time deadline as Swiss local time in either language", () => {
    const deadline = "2026-10-09T16:05:00.000Z";

    expect(formatSwissDeadline(deadline, "en")).toBe("9 Oct 2026, 18:05");
    expect(formatSwissDeadline(deadline, "de")).toContain("18:05");
  });
});
