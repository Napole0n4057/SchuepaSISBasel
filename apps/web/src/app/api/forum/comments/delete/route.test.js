import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route.js";

const mockDb = vi.hoisted(() => ({
  session: { user: { id: "admin-user" } },
  role: "admin",
  hasComment: true,
  crossesPosts: false,
  transactionCalls: [],
}));

vi.mock("../../../../../auth.js", () => ({
  auth: vi.fn(async () => mockDb.session),
}));

vi.mock("../../../../../app/api/utils/sql.js", () => {
  const sql = vi.fn(async (strings, ...values) => {
    const query = strings.join(" ").replace(/\s+/g, " ");

    if (query.includes("SELECT designation")) {
      return mockDb.role ? [{ designation: mockDb.role }] : [];
    }
    if (query.includes("SELECT post_id FROM forum_comments")) {
      return mockDb.hasComment ? [{ post_id: "11111111-1111-4111-8111-111111111111" }] : [];
    }
    if (query.includes("BOOL_OR(post_id")) {
      return [{ crosses_posts: mockDb.crossesPosts }];
    }

    throw new Error(`Unexpected SQL in test: ${query}`);
  });

  sql.transaction = vi.fn(async (callback) => {
    const txn = (strings, ...values) => {
      const query = strings.join(" ").replace(/\s+/g, " ");
      mockDb.transactionCalls.push({ query, values });
      if (query.includes("DELETE FROM forum_comments")) {
        return Promise.resolve(mockDb.hasComment ? [{ id: values[0] }] : []);
      }
      return Promise.resolve([]);
    };
    return Promise.all(callback(txn));
  });

  return { default: sql };
});

const commentId = "33333333-3333-4333-8333-333333333333";

async function deleteComment(body) {
  const request = new Request("http://localhost/api/forum/comments/delete", {
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
  mockDb.hasComment = true;
  mockDb.crossesPosts = false;
  mockDb.transactionCalls = [];
});

describe("POST /api/forum/comments/delete", () => {
  it("requires authentication and keeps deletion admin-only", async () => {
    mockDb.session = null;
    const unauthenticated = await deleteComment({ comment_id: commentId });
    expect(unauthenticated.response.status).toBe(401);

    mockDb.session = { user: { id: "member-user" } };
    mockDb.role = "member";
    const member = await deleteComment({ comment_id: commentId });
    expect(member.response.status).toBe(403);
    expect(mockDb.transactionCalls).toHaveLength(0);
  });

  it("validates comment IDs and rejects cross-post descendants", async () => {
    const invalid = await deleteComment({ comment_id: "'; DELETE FROM forum_posts; --" });
    expect(invalid.response.status).toBe(400);
    expect(mockDb.transactionCalls).toHaveLength(0);

    mockDb.crossesPosts = true;
    const crossPost = await deleteComment({ comment_id: commentId });
    expect(crossPost.response.status).toBe(409);
    expect(mockDb.transactionCalls).toHaveLength(0);
  });

  it("cleans legacy descendant comment reactions and deletes the comment tree within its post", async () => {
    const { response, data } = await deleteComment({ comment_id: commentId });

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockDb.transactionCalls).toHaveLength(2);
    expect(mockDb.transactionCalls[0].query).toContain("WITH RECURSIVE comment_tree");
    expect(mockDb.transactionCalls[0].query).toContain("child.post_id =");
    expect(mockDb.transactionCalls[0].query).toContain("DELETE FROM forum_votes");
    expect(mockDb.transactionCalls[1].query).toContain("DELETE FROM forum_comments");
    expect(mockDb.transactionCalls[1].query).toContain("id = AND post_id =");
  });
});
