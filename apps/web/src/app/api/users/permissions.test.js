import { beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({
  auth: vi.fn(),
  sql: vi.fn(),
  mutate: vi.fn(),
  hash: vi.fn(),
}));
vi.mock("../../../auth.js", () => ({ auth: f.auth }));
vi.mock("../utils/sql.js", () => ({ default: f.sql }));
vi.mock("../utils/accountManagement.js", () => ({ mutateAccount: f.mutate }));
vi.mock("argon2", () => ({ hash: f.hash }));
import { POST as role } from "../user-roles/update/route.js";
import { POST as details } from "./update/route.js";
import { POST as password } from "./reset-password/route.js";
import { POST as remove } from "./delete/route.js";
const id = "11111111-1111-4111-8111-111111111111";
const request = (body) =>
  new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify({ userId: id, ...body }),
  });
beforeEach(() => {
  vi.resetAllMocks();
  f.auth.mockResolvedValue({ user: { id } });
  f.sql.mockResolvedValue([{ designation: "spectator" }]);
  f.mutate.mockResolvedValue([{ user_id: id }]);
  f.hash.mockResolvedValue("hashed");
});
describe("account permissions", () => {
  it.each(["admin", "member", "spectator"])(
    "spectators cannot change their own or others' roles to %s",
    async (designation) => {
      expect((await role(request({ designation }))).status).toBe(403);
      expect(f.mutate).not.toHaveBeenCalled();
    },
  );
  it("denies a role injected through account details", async () => {
    expect(
      (
        await details(
          request({
            name: "Name",
            email: "test@example.org",
            designation: "admin",
          }),
        )
      ).status,
    ).toBe(403);
    expect(f.mutate).not.toHaveBeenCalled();
  });
  it("allows managed account details and password changes", async () => {
    expect(
      (await details(request({ name: "Name", email: "test@example.org" })))
        .status,
    ).toBe(200);
    expect((await password(request({ newPassword: "secret" }))).status).toBe(
      200,
    );
    expect(f.mutate).toHaveBeenLastCalledWith(id, id, "password", "hashed");
  });
  it("honors SQL refusal for protected accounts and last administrator", async () => {
    f.mutate.mockResolvedValue([]);
    for (const [handler, body] of [
      [details, { name: "N", email: "a@b.org" }],
      [password, { newPassword: "secret" }],
      [remove, { confirm: true }],
    ])
      expect((await handler(request(body))).status).toBe(409);
    f.sql.mockResolvedValue([{ designation: "admin" }]);
    expect((await role(request({ designation: "member" }))).status).toBe(409);
  });
  it("allows only admin role promotion", async () => {
    f.sql.mockResolvedValue([{ designation: "admin" }]);
    expect((await role(request({ designation: "admin" }))).status).toBe(200);
  });
  it.each([role, details, password, remove])(
    "blocks members and anonymous direct API calls",
    async (handler) => {
      f.sql.mockResolvedValue([{ designation: "member" }]);
      expect((await handler(request({}))).status).toBe(403);
      f.auth.mockResolvedValue(null);
      expect((await handler(request({}))).status).toBe(401);
      expect(f.mutate).not.toHaveBeenCalled();
    },
  );
});
