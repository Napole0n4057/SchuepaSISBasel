import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route.js";

const mockDb = vi.hoisted(() => ({
  session: { user: { id: "admin-user" } },
  role: "admin",
  adminCount: 2,
  userExists: true,
  transactionCalls: [],
}));

vi.mock("../../../../auth.js", () => ({
  auth: vi.fn(async () => mockDb.session),
}));

vi.mock("../../../../app/api/utils/sql.js", () => {
  const sql = vi.fn(async (strings, ...values) => {
    const query = (
      typeof strings === "string" ? strings : strings.join(" ")
    ).replace(/\s+/g, " ");

    if (query.includes("SELECT designation")) {
      return mockDb.role ? [{ designation: mockDb.role }] : [];
    }
    if (query.includes("COUNT(*)::int AS admin_count")) {
      return [{ admin_count: mockDb.adminCount }];
    }
    if (query.includes("SELECT id FROM auth_users")) {
      return mockDb.userExists ? [{ id: values[0] }] : [];
    }

    throw new Error(`Unexpected SQL in test: ${query}`);
  });

  sql.transaction = vi.fn(async (callback) => {
    const txn = (strings, ...values) => {
      const query = (
        typeof strings === "string" ? strings : strings.join(" ")
      ).replace(/\s+/g, " ");
      mockDb.transactionCalls.push({ query, values });
      if (query.includes("DELETE FROM auth_users")) {
        return Promise.resolve(
          mockDb.adminCount > 1 ? [{ id: targetUserId }] : []);
      }
      return Promise.resolve([]);
    };
    return Promise.all(callback(txn));
  });

  return { default: sql };
});

const targetUserId = "11111111-1111-4111-8111-111111111111";

async function deleteUser(body) {
  const request = new Request("http://localhost/api/users/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const response = await POST(request);
  return { response, data: await response.json() };
}

beforeEach(() => {
  mockDb.session = { user: { id: "admin-user" } };
  mockDb.role = "admin";
  mockDb.adminCount = 2;
  mockDb.userExists = true;
  mockDb.transactionCalls = [];
});

describe("POST /api/users/delete", () => {
  it("requires admin access and explicit confirmation", async () => {
    mockDb.session = null;
    const unauthenticated = await deleteUser({ userId: targetUserId, confirm: true });
    expect(unauthenticated.response.status).toBe(401);

    mockDb.session = { user: { id: "member-user" } };
    mockDb.role = "member";
    const forbidden = await deleteUser({ userId: targetUserId, confirm: true });
    expect(forbidden.response.status).toBe(403);

    mockDb.session = { user: { id: "admin-user" } };
    mockDb.role = "admin";
    const missingConfirmation = await deleteUser({ userId: targetUserId, confirm: false });
    expect(missingConfirmation.response.status).toBe(400);
    expect(missingConfirmation.data.error).toBe("Confirmation required");
  });

  it("prevents deleting the last remaining admin account", async () => {
    mockDb.adminCount = 1;
    const response = await deleteUser({ userId: targetUserId, confirm: true });
    expect(response.response.status).toBe(409);
    expect(response.data.error).toContain("last administrator");
    expect(mockDb.transactionCalls[0].query).toContain("LOCK TABLE user_roles");
  });

  it("removes account records without touching forum, blog or vote content tables", async () => {
    const response = await deleteUser({ userId: targetUserId, confirm: true });
    expect(response.response.status).toBe(200);
    expect(response.data.success).toBe(true);
    expect(mockDb.transactionCalls.length).toBeGreaterThan(0);

    const allQueries = mockDb.transactionCalls.map(({ query }) => query).join(" ");
    expect(allQueries).toContain("DELETE FROM auth_users");
    expect(allQueries).toContain("DELETE FROM user_roles");
    expect(allQueries).not.toContain("DELETE FROM forum_posts");
    expect(allQueries).not.toContain("DELETE FROM forum_comments");
    expect(allQueries).not.toContain("DELETE FROM forum_votes");
    expect(allQueries).not.toContain("DELETE FROM blog_posts");
    expect(allQueries).not.toContain("DELETE FROM user_votes");
  });
});
