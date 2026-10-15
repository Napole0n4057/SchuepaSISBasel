import { beforeEach, describe, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({
  auth: vi.fn(),
  role: "admin",
  students: [],
  updated: [],
  queries: [],
}));

vi.mock("../../../auth.js", () => ({ auth: fixtures.auth }));
vi.mock("../../../app/api/utils/sql.js", () => ({
  default: vi.fn(async (strings, ...values) => {
    const query = strings.join(" ").replace(/\s+/g, " ");
    fixtures.queries.push({ query, values });
    if (query.includes("SELECT designation")) {
      return fixtures.role ? [{ designation: fixtures.role }] : [];
    }
    if (query.includes("LEFT JOIN student_classes")) return fixtures.students;
    if (query.includes("INSERT INTO student_classes")) return fixtures.updated;
    throw new Error(`Unexpected SQL: ${query}`);
  }),
}));

import { GET } from "./list/route.js";
import { POST } from "./update/route.js";

const studentId = "11111111-1111-4111-8111-111111111111";

async function update(body) {
  return POST(new Request("http://localhost/api/student-classes/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  fixtures.queries = [];
  fixtures.auth.mockResolvedValue({ user: { id: "manager" } });
  fixtures.role = "admin";
  fixtures.students = [{ user_id: studentId, email: "learner@example.org", programme: null, year: null }];
  fixtures.updated = [{ user_id: studentId, programme: "Gym", year: 2 }];
});

describe("student class permissions", () => {
  it.each(["admin", "spectator"])("allows %s to list student accounts", async (role) => {
    fixtures.role = role;
    const response = await GET();
    expect(response.status).toBe(200);
    expect((await response.json()).students).toHaveLength(1);
    expect(fixtures.queries[1].query).toContain("ur.designation = 'member'");
  });

  it.each(["admin", "spectator"])("allows %s to update only a student class", async (role) => {
    fixtures.role = role;
    const response = await update({ userId: studentId, programme: "Gym", year: 2 });
    expect(response.status).toBe(200);
    const updateQuery = fixtures.queries[1].query;
    expect(updateQuery).toContain("INSERT INTO student_classes");
    expect(updateQuery).toContain("designation = 'member'");
    expect(updateQuery).not.toContain("UPDATE user_roles");
    expect(updateQuery).not.toContain("designation = EXCLUDED");
  });

  it("denies student accounts and unauthenticated visitors", async () => {
    fixtures.role = "member";
    expect((await GET()).status).toBe(403);
    expect((await update({ userId: studentId, programme: "Gym", year: 2 })).status).toBe(403);

    fixtures.auth.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await update({ userId: studentId, programme: "Gym", year: 2 })).status).toBe(401);
  });

  it("rejects invalid classes and does not update admin or spectator accounts", async () => {
    expect((await update({ userId: studentId, programme: "Other", year: 2 })).status).toBe(400);
    expect((await update({ userId: studentId, programme: "Gym", year: 7 })).status).toBe(400);

    fixtures.updated = [];
    const response = await update({ userId: studentId, programme: "Int", year: 1 });
    expect(response.status).toBe(404);
    expect(fixtures.queries.at(-1).query).toContain("designation = 'member'");
  });
});
