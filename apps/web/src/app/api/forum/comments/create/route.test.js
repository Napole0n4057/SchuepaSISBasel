import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route.js";
import { buildCommentTree } from "@/app/forum/commentTree.js";

const mockDb = vi.hoisted(() => ({
  session: { user: { id: "authenticated-user" } },
  posts: new Set(["11111111-1111-4111-8111-111111111111"]),
  comments: new Map(),
  nextId: 1,
  missingParentColumn: false,
}));

vi.mock("../../../../../auth.js", () => ({
  auth: vi.fn(async () => mockDb.session),
}));

vi.mock("../../../../../app/api/utils/sql.js", () => ({
  default: vi.fn(async (strings, ...values) => {
    const query = strings.join(" ").replace(/\s+/g, " ");

    if (query.includes("FROM forum_posts")) {
      return mockDb.posts.has(values[0]) ? [{ id: values[0] }] : [];
    }

    if (query.includes("SELECT id FROM forum_comments")) {
      const parent = mockDb.comments.get(values[0]);
      return parent?.post_id === values[1] ? [{ id: parent.id }] : [];
    }

    if (query.includes("INSERT INTO forum_comments")) {
      if (mockDb.missingParentColumn) {
        const error = new Error('column "parent_comment_id" of relation "forum_comments" does not exist');
        error.code = "42703";
        throw error;
      }
      const id = `00000000-0000-4000-8000-${String(mockDb.nextId++).padStart(12, "0")}`;
      const [post_id, user_id, parent_comment_id, content, is_anonymous] = values;
      const inserted = {
        id,
        post_id,
        user_id,
        parent_comment_id,
        content,
        is_anonymous,
        created_at: "2026-10-08T10:00:00.000Z",
      };
      mockDb.comments.set(id, inserted);
      return [inserted];
    }

    if (query.includes("FROM forum_comments fc")) {
      const comment = mockDb.comments.get(values[0]);
      if (!comment) return [];
      return [{
        ...comment,
        account_name: "Private Student Name",
        author_email: "private@student.example",
        profile_picture: "https://example.test/private-avatar.png",
      }];
    }

    throw new Error(`Unexpected SQL in test: ${query}`);
  }),
}));

const postId = "11111111-1111-4111-8111-111111111111";
const otherPostId = "22222222-2222-4222-8222-222222222222";

async function createComment(body) {
  const request = new Request("http://localhost/api/forum/comments/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const response = await POST(request);
  return { response, data: await response.json() };
}

beforeEach(() => {
  mockDb.session = { user: { id: "authenticated-user" } };
  mockDb.posts = new Set([postId, otherPostId]);
  mockDb.comments.clear();
  mockDb.nextId = 1;
  mockDb.missingParentColumn = false;
});

describe("POST /api/forum/comments/create", () => {
  it("persists a three-level thread with each reply attached to the clicked comment", async () => {
    const { data: rootResult } = await createComment({
      post_id: postId,
      content: "Comment A",
      user_id: "attacker-supplied-id",
    });
    const { data: replyResult } = await createComment({
      post_id: postId,
      parent_comment_id: rootResult.comment.id,
      content: "Reply B",
    });
    const { data: nestedResult } = await createComment({
      post_id: postId,
      parent_comment_id: replyResult.comment.id,
      content: "Reply C",
    });

    expect(mockDb.comments.get(rootResult.comment.id).user_id).toBe("authenticated-user");
    expect(mockDb.comments.get(replyResult.comment.id).parent_comment_id).toBe(rootResult.comment.id);
    expect(mockDb.comments.get(nestedResult.comment.id).parent_comment_id).toBe(replyResult.comment.id);

    const tree = buildCommentTree([...mockDb.comments.values()]);
    expect(tree[0].content).toBe("Comment A");
    expect(tree[0].replies[0].content).toBe("Reply B");
    expect(tree[0].replies[0].replies[0].content).toBe("Reply C");
  });

  it("anonymizes each anonymous comment independently in the create response", async () => {
    const { data: root } = await createComment({
      post_id: postId,
      content: "Named parent",
    });
    const { response, data } = await createComment({
      post_id: postId,
      parent_comment_id: root.comment.id,
      content: "Anonymous reply",
      is_anonymous: true,
    });

    expect(response.status).toBe(200);
    expect(data.comment.author_name).toBe("Anonymous");
    expect(data.comment.profile_picture).toBeNull();
    expect(data.comment).not.toHaveProperty("user_id");
    expect(data.comment).not.toHaveProperty("author_email");
    expect(data.comment).not.toHaveProperty("account_name");
    expect(data.comment.parent_comment_id).toBe(root.comment.id);
    expect(root.comment.author_name).toBe("Private Student Name");
  });

  it("rejects cross-post parents, malformed IDs, and excessive text", async () => {
    const { data: parent } = await createComment({
      post_id: postId,
      content: "Parent",
    });
    const crossPost = await createComment({
      post_id: otherPostId,
      parent_comment_id: parent.comment.id,
      content: "Wrong post",
    });
    const malformed = await createComment({
      post_id: "not-a-uuid",
      content: "Invalid post ID",
    });
    const invalidParent = await createComment({
      post_id: postId,
      parent_comment_id: "not-a-uuid",
      content: "Invalid parent ID",
    });
    const tooLong = await createComment({
      post_id: postId,
      content: "x".repeat(2001),
    });
    const oversizedRequest = await POST(new Request(
      "http://localhost/api/forum/comments/create",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: `{"post_id":"${postId}","content":"${"x".repeat(17000)}"}`,
      },
    ));

    expect(crossPost.response.status).toBe(404);
    expect(malformed.response.status).toBe(400);
    expect(invalidParent.response.status).toBe(400);
    expect(tooLong.response.status).toBe(400);
    expect(oversizedRequest.status).toBe(413);
    expect(mockDb.comments.size).toBe(1);
  });

  it("rejects malformed JSON without querying the database", async () => {
    const request = new Request("http://localhost/api/forum/comments/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ malformed",
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(mockDb.comments.size).toBe(0);
  });

  it("rejects requests without an authenticated session", async () => {
    mockDb.session = null;
    const { response } = await createComment({ post_id: postId, content: "No session" });
    expect(response.status).toBe(401);
  });

  it("returns a clear temporary-unavailable response when the replies migration is missing", async () => {
    mockDb.missingParentColumn = true;
    const { response, data } = await createComment({
      post_id: postId,
      content: "Top-level comments also use the replies column",
    });

    expect(response.status).toBe(503);
    expect(data.error).toContain("apply the forum replies database update");
    expect(mockDb.comments.size).toBe(0);
  });
});
