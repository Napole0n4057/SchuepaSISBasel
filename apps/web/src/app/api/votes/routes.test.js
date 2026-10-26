import { beforeEach, describe, expect, it, vi } from "vitest";
import { STUDENT_CLASS_NAMES } from "../../../studentClasses.js";

const fixtures = vi.hoisted(() => ({ auth: vi.fn(), sql: vi.fn(), visible: vi.fn() }));
vi.mock("../../../auth.js", () => ({ auth: fixtures.auth }));
vi.mock("../utils/sql.js", () => ({ default: fixtures.sql }));
vi.mock("../utils/voteAccess.js", async (original) => ({
  ...(await original()), getVisibleVotes: fixtures.visible,
}));

import { POST as create } from "./create/route.js";
import { POST as cast } from "./cast/route.js";
import { GET as list } from "./list/route.js";

const userId = "11111111-1111-4111-8111-111111111111";
const voteId = "22222222-2222-4222-8222-222222222222";
const optionId = "33333333-3333-4333-8333-333333333333";
const activeVote = { id: voteId, status: "active", is_active: true, admin_only: false, class_names: ["G3"] };

function post(body) {
  return new Request("http://localhost/api/votes", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  fixtures.auth.mockResolvedValue({ user: { id: userId } });
  fixtures.visible.mockResolvedValue([activeVote]);
  fixtures.sql.mockImplementation(async (strings) => {
    const query = typeof strings === "string" ? strings : strings.join(" ");
    if (query.includes("SELECT designation")) return [{ designation: "admin" }];
    if (query.includes("INSERT INTO user_votes")) return [{ vote_id: voteId, option_id: optionId }];
    if (query.includes("COUNT(uv.id)")) return [{ id: optionId, vote_count: "4" }];
    if (query.includes("SELECT option_id")) return [];
    if (query.includes("SELECT id FROM vote_options")) return [{ id: optionId }];
    throw new Error(`Unexpected query: ${query}`);
  });
  fixtures.sql.transaction = vi.fn(async (build) => {
    const queries = [];
    const txn = (strings, ...values) => { queries.push({ query: strings.join(" "), values }); return []; };
    build(txn);
    fixtures.transactionQueries = queries;
    return [[{ id: voteId }], [{ id: optionId }], [{ id: "other-option" }]];
  });
});

describe("vote API permissions and history", () => {
  it("requires authentication for listing, details/results, creating and casting", async () => {
    fixtures.auth.mockResolvedValue(null);
    expect((await list()).status).toBe(401);
    expect((await cast(post({ vote_id: voteId, option_id: optionId }))).status).toBe(401);
    expect((await create(post({ title: "Vote", options: ["Yes", "No"] }))).status).toBe(401);
    expect(fixtures.sql).not.toHaveBeenCalled();
    expect(fixtures.visible).not.toHaveBeenCalled();
  });

  it.each(["member", "spectator"])("does not let %s create votes", async (designation) => {
    fixtures.sql.mockResolvedValue([{ designation }]);
    expect((await create(post({ title: "Vote", options: ["Yes", "No"] }))).status).toBe(403);
    expect(fixtures.sql.transaction).not.toHaveBeenCalled();
  });

  it.each(STUDENT_CLASS_NAMES)("accepts the shared class %s", async (className) => {
    const response = await create(post({ title: "Vote", options: ["Yes", "No"], class_names: [className, className] }));
    expect(response.status).toBe(200);
    expect((await response.json()).class_names).toEqual([className]);
    const classes = fixtures.transactionQueries.filter(({ query }) => query.includes("INSERT INTO vote_classes"));
    expect(classes).toHaveLength(1);
    expect(classes[0].values).toContain(className);
  });

  it.each([
    "Gym 1",
    "Gym 6",
    "Int 1",
    "Int 6", "IB 1", "Gym 7", "Int 0", null, 3])("rejects unsupported class %s on new votes", async (className) => {
    expect((await create(post({ title: "Vote", options: ["Yes", "No"], class_names: [className] }))).status).toBe(400);
    expect(fixtures.sql.transaction).not.toHaveBeenCalled();
  });

  it("preserves an empty audience as school-wide", async () => {
    const response = await create(post({ title: "Vote", options: ["Yes", "No"] }));
    expect((await response.json()).class_names).toEqual([]);
    expect(fixtures.transactionQueries.some(({ query }) => query.includes("INSERT INTO vote_classes"))).toBe(false);
  });

  it("never reads options, results or vote history for an inaccessible vote", async () => {
    fixtures.visible.mockResolvedValue([]);
    const data = await (await list()).json();
    expect(data).toEqual({ votes: [], active_votes: [], past_votes: [] });
    expect(fixtures.visible).toHaveBeenCalledWith(userId);
    expect(fixtures.sql).not.toHaveBeenCalled();
  });

  it("applies visibility to direct detail lookups and returns no results when forbidden", async () => {
    fixtures.visible.mockResolvedValue([]);
    const response = await list(
      new Request(`http://localhost/api/votes/list?vote_id=${voteId}`),
    );
    expect(response.status).toBe(404);
    expect(fixtures.visible).toHaveBeenCalledWith(userId, voteId);
    expect(fixtures.sql).not.toHaveBeenCalled();
  });

  it("returns completed class votes with results in past votes", async () => {
    fixtures.visible.mockResolvedValue([{ ...activeVote, status: "past" }]);
    const response = await list();
    const data = await response.json();
    expect(data.active_votes).toEqual([]);
    expect(data.past_votes[0].options[0].vote_count).toBe("4");
    expect(data.past_votes[0].user_voted_option_id).toBeNull();
    expect(
      fixtures.sql.mock.calls.some(([q]) =>
        q.join(" ").includes("SELECT option_id"),
      ),
    ).toBe(false);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("denies spectators even when they can see the vote", async () => {
    fixtures.sql.mockResolvedValue([{ designation: "spectator" }]);
    expect((await cast(post({ vote_id: voteId, option_id: optionId }))).status).toBe(403);
    expect(fixtures.visible).not.toHaveBeenCalled();
  });

  it.each([{ votes: [] }, { votes: [{ ...activeVote, status: "past" }] }])("rejects inaccessible or completed direct submissions", async ({ votes }) => {
    fixtures.visible.mockResolvedValue(votes);
    expect((await cast(post({ vote_id: voteId, option_id: optionId }))).status).toBe(404);
    expect(fixtures.visible).toHaveBeenCalledWith(userId, voteId);
    expect(fixtures.sql).toHaveBeenCalledTimes(1);
  });

  it("rejects a deadline or access change between the initial read and write", async () => {
    fixtures.sql.mockResolvedValueOnce([{ designation: "member" }])
      .mockResolvedValueOnce([{ id: optionId }]).mockResolvedValueOnce([]);
    expect((await cast(post({ vote_id: voteId, option_id: optionId }))).status).toBe(404);
  });

  it("rejects options belonging to a different vote", async () => {
    fixtures.sql.mockResolvedValueOnce([{ designation: "member" }]).mockResolvedValueOnce([]);
    expect((await cast(post({ vote_id: voteId, option_id: optionId }))).status).toBe(400);
    expect(fixtures.sql).toHaveBeenCalledTimes(2);
  });

  it("allows eligible members to cast or change a vote through a parameterised atomic write", async () => {
    fixtures.sql.mockResolvedValueOnce([{ designation: "member" }])
      .mockResolvedValueOnce([{ id: optionId }]).mockResolvedValueOnce([{ option_id: optionId }]);
    expect((await cast(post({ vote_id: voteId, option_id: optionId }))).status).toBe(200);
    const [query, parameters] = fixtures.sql.mock.calls.at(-1);
    expect(parameters).toEqual([userId, voteId, optionId]);
    expect(query).toContain("ON CONFLICT (vote_id, user_id)");
    expect(query).toContain("clock_timestamp()");
  });
});
