import { beforeEach, describe, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({
  auth: vi.fn(),
  sql: vi.fn(),
  addStudent: vi.fn(),
  hash: vi.fn(),
}));

vi.mock("../../../auth.js", () => ({ auth: fixtures.auth }));
vi.mock("../../../app/api/utils/sql.js", () => ({ default: fixtures.sql }));
vi.mock("../../../app/api/utils/studentStore.js", () => ({ addStudent: fixtures.addStudent }));
vi.mock("argon2", () => ({ hash: fixtures.hash }));

import { POST as createUser } from "../users/create/route.js";
import { POST as bulkCreateUsers } from "../users/bulk-create/route.js";

const studentId = "11111111-1111-4111-8111-111111111111";

function post(body, path) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  fixtures.auth.mockResolvedValue({ user: { id: "admin" } });
  fixtures.sql.transaction = vi.fn(async (build) =>
    Promise.all(build(fixtures.sql)),
  );
  fixtures.hash.mockResolvedValue("argon-hash");
  fixtures.addStudent.mockResolvedValue(undefined);
  fixtures.sql.mockImplementation(async (strings) => {
    const query = strings.join(" ").replace(/\s+/g, " ");
    if (query.includes("LOCK TABLE")) return [];
    if (query.includes("SELECT designation")) return [{ designation: "admin" }];
    if (query.includes("SELECT id FROM auth_users")) return [];
    if (query.includes("WITH new_user")) return [{ id: studentId, email: "one@example.org" }];
    throw new Error(`Unexpected SQL: ${query}`);
  });
});

describe("account creation with optional class", () => {
  it.each([
    null,
    ...[
      "S1",
      "S2",
      "G1",
      "G2",
      "G3",
      "G4",
      "Pre-IB 1",
      "Pre-IB 2",
      "Pre-IB 3",
      "IBDP 1",
      "IBDP 2",
      "IBDP 3",
    ],
  ])("creates an account with class %s", async (class_name) => {
    const response = await createUser(post({ email: "one@example.org", password: "secret", class_name }, "/api/users/create"));
    expect(response.status).toBe(200);
    expect(fixtures.sql.mock.calls.at(-1).slice(1)).toContain(class_name);
  });

  it("allows class to be omitted and rejects legacy and unknown class inputs", async () => {
    expect(
      (
        await createUser(
          post(
            { email: "one@example.org", password: "secret" },
            "/api/users/create",
          ),
        )
      ).status,
    ).toBe(200);
    for (const value of [
      { class_name: "Gym 4" },
      { programme: "Gym", year: 4 },
    ]) {
      expect(
        (
          await createUser(
            post(
              { email: "one@example.org", password: "secret", ...value },
              "/api/users/create",
            ),
          )
        ).status,
      ).toBe(400);
    }
  });
  it("creates bulk accounts without a class", async () => {
    const data = await (
      await bulkCreateUsers(post({ users: [{ email: "one@example.org", password: "secret" }] }, "/api/users/bulk-create"))).json();
    expect(data.summary.created).toBe(1);
  });
  it.each(["member", "spectator"])(
    "lets spectators create %s accounts without a class",
    async (designation) => {
      const implementation = fixtures.sql.getMockImplementation();
      fixtures.sql.mockImplementation((strings, ...values) =>
        strings.join(" ").includes("SELECT designation")
          ? Promise.resolve([{ designation: "spectator" }])
          : implementation(strings, ...values),
      );
      expect(
        (
          await createUser(
            post(
              { email: "one@example.org", password: "secret", designation },
              "/api/users/create",
            ),
          )
        ).status).toBe(200);
    },
  );
  it("blocks a spectator from requesting admin on single and bulk creation", async () => {
    fixtures.sql.mockResolvedValue([{ designation: "spectator" }]);
    expect(
      (
        await createUser(
          post(
            {
              email: "one@example.org",
              password: "secret",
              designation: "admin",
            },
            "/api/users/create",
          ),
        )
      ).status,
    ).toBe(403);
    const data = await (
      await bulkCreateUsers(
        post(
          {
            users: [
              {
                email: "one@example.org",
                password: "secret",
                designation: "admin",
              },
            ],
          },
          "/api/users/bulk-create",
        ),
      )
    ).json();
    expect(data.summary.errors).toBe(1);
    expect(fixtures.hash).not.toHaveBeenCalled();
  });
});
