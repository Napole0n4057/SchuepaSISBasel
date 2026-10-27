import { beforeEach, describe, expect, it, vi } from "vitest";

const f = vi.hoisted(() => ({ auth: vi.fn(), sql: vi.fn(), role: "member", row: null }));
vi.mock("../../../auth.js", () => ({ auth: f.auth }));
vi.mock("../utils/sql.js", () => ({ default: f.sql }));
import { GET as listPosts } from "./posts/list/route.js";
import { GET as getPost } from "./posts/get/route.js";
import { GET as listComments } from "./comments/list/route.js";
import { POST as createPost } from "./posts/create/route.js";
import { POST as createComment } from "./comments/create/route.js";

const id = "11111111-1111-4111-8111-111111111111";
const viewerId = "22222222-2222-4222-8222-222222222222";
const readRoutes = [["post list", listPosts, "posts"], ["post detail", getPost, "post"], ["comments and replies", listComments, "comments"]];
const writeRoutes = [["post", createPost, "post"], ["comment", createComment, "comment"]];
const readRequest = () => new Request(`http://localhost/?post_id=${id}&role=admin`, {
  headers: { "X-Role": "admin" },
});
const writeRequest = () => new Request("http://localhost/", {
  method: "POST",
  body: JSON.stringify({ title: "Title", content: "Content", post_id: id,
    is_anonymous: true, role: "admin", user_id: "spoofed-author" }),
});
function record(data, key) { return Array.isArray(data[key]) ? data[key][0] : data[key]; }
function expectPrivate(row) {
  expect(row.author_name).toBe("Anonymous");
  expect(row.profile_picture).toBeNull();
  for (const field of ["user_id", "account_name", "author_email", "moderation_author_name"])
    expect(row).not.toHaveProperty(field);
  expect(JSON.stringify(row)).not.toMatch(/Max Muster|max@example|secret-author|private-avatar/);
}

beforeEach(() => {
  vi.resetAllMocks();
  f.role = "member";
  // An elevated session role cannot override the current database role.
  f.auth.mockResolvedValue({ user: { id: viewerId, role: "admin", designation: "admin" } });
  f.row = { id, user_id: "secret-author", is_anonymous: true, content: "Content",
    account_name: "Max Muster", author_email: "max@example.test",
    profile_picture: "https://example.test/private-avatar.png", parent_comment_id: id };
  f.sql.mockImplementation(async (strings, ...values) => {
    const query = strings.join(" ").replace(/\s+/g, " ");
    if (query.includes("SELECT designation")) {
      expect(values).toEqual([viewerId]);
      return f.role === null ? [] : [{ designation: f.role }];
    }
    if (query.includes("INSERT INTO forum_")) {
      expect(values).toContain(viewerId);
      expect(values).not.toContain("spoofed-author");
      return [{ ...f.row, user_id: viewerId }];
    }
    if (query.includes("FROM auth_users"))
      return [{ account_name: f.row.account_name, author_email: f.row.author_email }];
    if (query.includes("SELECT id FROM forum_posts")) return [{ id }];
    return [{ ...f.row }];
  });
});

describe.each(readRoutes)("anonymous author privacy: %s", (_, handler, key) => {
  it.each(["admin", "spectator"])("reveals the actual author to database role %s", async (role) => {
    f.role = role;
    const response = await handler(readRequest());
    const row = record(await response.json(), key);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(row.author_name).toBe("Anonymous");
    expect(row.moderation_author_name).toBe("Max Muster");
    expect(row.profile_picture).toBeNull();
    expect(row).not.toHaveProperty("user_id");
    expect(row).not.toHaveProperty("author_email");
  });
  it.each(["member", null, "unknown"])("withholds author identifiers from role %s despite spoofed inputs", async (role) => {
    f.role = role;
    const response = await handler(readRequest());
    expect(response.status).toBe(200);
    expectPrivate(record(await response.json(), key));
  });
  it("rejects unauthenticated requests before querying content", async () => {
    f.auth.mockResolvedValue(null);
    expect((await handler(readRequest())).status).toBe(401);
    expect(f.sql).not.toHaveBeenCalled();
  });
  it.each(["admin", "spectator", "member"])("preserves identified author responses for %s", async (role) => {
    f.role = role;
    f.row.is_anonymous = false;
    const row = record(await (await handler(readRequest())).json(), key);
    expect(row.author_name).toBe("Max Muster");
    expect(row.user_id).toBe("secret-author");
    expect(row.profile_picture).toBe(f.row.profile_picture);
    expect(row).not.toHaveProperty("moderation_author_name");
  });
  it("reports missing historical author information without inventing an identity", async () => {
    f.role = "spectator";
    f.row.account_name = null;
    f.row.author_email = null;
    f.row.user_id = null;
    const row = record(await (await handler(readRequest())).json(), key);
    expect(row.moderation_author_name).toBeNull();
  });
});

describe.each(writeRoutes)("anonymous %s creation responses", (_, handler, key) => {
  it("preserves anonymous publishing and strips author identifiers for members", async () => {
    const response = await handler(writeRequest());
    expect(response.status).toBe(200);
    expectPrivate((await response.json())[key]);
  });
  it("lets admins identify the author immediately", async () => {
    f.role = "admin";
    const response = await handler(writeRequest());
    expect(response.status).toBe(200);
    expect((await response.json())[key].moderation_author_name).toBe("Max Muster");
  });
  it.each(["spectator", null, "unknown"])("preserves publishing restrictions for %s", async (role) => {
    f.role = role;
    expect((await handler(writeRequest())).status).toBe(403);
    expect(f.sql).toHaveBeenCalledTimes(1);
  });
});
