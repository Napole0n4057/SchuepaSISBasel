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
  fixtures.hash.mockResolvedValue("argon-hash");
  fixtures.addStudent.mockResolvedValue(undefined);
  fixtures.sql.mockImplementation(async (strings) => {
    const query = strings.join(" ").replace(/\s+/g, " ");
    if (query.includes("SELECT designation")) return [{ designation: "admin" }];
    if (query.includes("SELECT id FROM auth_users")) return [];
    if (query.includes("WITH new_user")) return [{ id: studentId, email: "one@example.org" }];
    throw new Error(`Unexpected SQL: ${query}`);
  });
});

describe("student account class requirements", () => {
  it("requires a valid programme and year for single account creation", async () => {
    const missing = await createUser(post({ email: "one@example.org", password: "secret" }, "/api/users/create"));
    expect(missing.status).toBe(400);
    expect(fixtures.hash).not.toHaveBeenCalled();

    const invalid = await createUser(post({ email: "one@example.org", password: "secret", programme: "Gym", year: 7 }, "/api/users/create"));
    expect(invalid.status).toBe(400);
    expect(fixtures.hash).not.toHaveBeenCalled();

    const valid = await createUser(post({ email: "one@example.org", password: "secret", programme: "Gym", year: 1 }, "/api/users/create"));
    expect(valid.status).toBe(200);
    expect(fixtures.sql.mock.calls.at(-1)[0].join(" ")).toContain("INSERT INTO student_classes");
  });

  it("rejects bulk rows without class and stores valid rows with their class", async () => {
    const missing = await bulkCreateUsers(post({ users: [{ email: "one@example.org", password: "secret" }] }, "/api/users/bulk-create"));
    const missingData = await missing.json();
    expect(missing.status).toBe(200);
    expect(missingData.summary.errors).toBe(1);
    expect(fixtures.hash).not.toHaveBeenCalled();

    const valid = await bulkCreateUsers(post({ users: [{
      email: "one@example.org", password: "secret", programme: "Int", year: 3,
    }] }, "/api/users/bulk-create"));
    const validData = await valid.json();
    expect(valid.status).toBe(200);
    expect(validData.summary.created).toBe(1);
    expect(fixtures.sql.mock.calls.at(-1)[0].join(" ")).toContain("INSERT INTO student_classes");
    expect(fixtures.addStudent).toHaveBeenCalledOnce();
  });
});
