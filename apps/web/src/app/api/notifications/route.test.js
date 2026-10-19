import { beforeEach, describe, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({ auth: vi.fn(), sql: vi.fn(), visible: vi.fn() }));
vi.mock("../../../auth.js", () => ({ auth: fixtures.auth }));
vi.mock("../utils/sql.js", () => ({ default: fixtures.sql }));
vi.mock("../utils/voteAccess.js", () => ({ getVisibleVotes: fixtures.visible }));
import { GET } from "./route.js";

beforeEach(() => {
  vi.resetAllMocks();
  fixtures.auth.mockResolvedValue({ user: { id: "member" } });
  fixtures.sql.mockResolvedValue([{ forum: "2026-10-19T08:00:00", blog: null }]);
});

describe("notification visibility", () => {
  it("requires authentication", async () => {
    fixtures.auth.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(fixtures.visible).not.toHaveBeenCalled();
    expect(fixtures.sql).not.toHaveBeenCalled();
  });

  it("uses the shared access filter and excludes completed votes", async () => {
    fixtures.visible.mockResolvedValue([
      { status: "active", created_at: "2026-10-18T08:00:00" },
      { status: "past", created_at: "2026-10-19T08:00:00" },
    ]);
    const response = await GET();
    expect((await response.json()).latest).toEqual({
      votes: "2026-10-18T08:00:00.000Z", forum: "2026-10-19T08:00:00", blog: null,
    });
    expect(fixtures.visible).toHaveBeenCalledWith("member");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("has no vote notification when the user has no visible active votes", async () => {
    fixtures.visible.mockResolvedValue([]);
    expect((await (await GET()).json()).latest.votes).toBeNull();
  });

  it("handles Date objects returned by the PostgreSQL driver", async () => {
    fixtures.visible.mockResolvedValue([{ status: "active", created_at: new Date("2026-10-19T08:00:00Z") }]);
    fixtures.sql.mockResolvedValue([{ forum: null, blog: new Date("2026-10-19T07:00:00Z") }]);
    expect((await (await GET()).json()).latest).toEqual({
      votes: "2026-10-19T08:00:00.000Z", forum: null, blog: "2026-10-19T07:00:00.000Z",
    });
  });
});
