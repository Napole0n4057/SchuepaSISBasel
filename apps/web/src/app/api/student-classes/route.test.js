import { beforeEach, expect, it, vi } from "vitest";

const f = vi.hoisted(() => ({
  auth: vi.fn(), sql: vi.fn(), mutate: vi.fn() }));

vi.mock("../../../auth.js", () => ({ auth: f.auth }));
vi.mock("../utils/sql.js", () => ({
  default: f.sql }));
vi.mock("../utils/accountManagement.js", () => ({ mutateAccount: f.mutate }));

import { GET } from "./list/route.js";
import { POST } from "./update/route.js";

const id = "11111111-1111-4111-8111-111111111111";
const post = (body) =>
  POST(new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify(body),
  }));
beforeEach(() => {
  vi.resetAllMocks();
  f.auth.mockResolvedValue({ user: { id } });
  f.sql.mockResolvedValue([{ designation: "spectator" }]);
  f.mutate.mockResolvedValue([{ user_id: id, class_name: null }]);
});
it.each([null, "G3", "IBDP 2"])(
  "allows canonical class assignment or clearing: %s", async (class_name) => {
    expect((await post({ userId: id, class_name })).status).toBe(200);
    expect(f.mutate).toHaveBeenCalledWith(id, id, "class", class_name);
  });

  it("rejects legacy class values without rewriting them", async () => {
  expect((await post({ userId: id, programme: "Gym", year: 4 })).status).toBe(
    400,
  );
    expect((await post({ userId: id, class_name: "Gym 4" })).status).toBe(400);
    expect(f.mutate).not.toHaveBeenCalled();
  });

  it("requires a manager and sign in", async () => {
  f.sql.mockResolvedValue([{ designation: "member" }]);
    expect((await GET()).status).toBe(403);
    expect((await post({ userId: id })).status).toBe(403);
  f.auth.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await post({ userId: id })).status).toBe(401);
  });

  it("lists all manageable roles and excludes admins for spectators in SQL", async () => {
  f.sql
    .mockResolvedValueOnce([{ designation: "spectator" }])
    .mockResolvedValueOnce([]);
  expect((await GET()).status).toBe(200);
  const query = f.sql.mock.calls[1][0].join("?");
    expect(query).toContain("ur.designation IN ('admin', 'member', 'spectator')");
  expect(query).toContain("actor.designation = 'admin'");
  });
