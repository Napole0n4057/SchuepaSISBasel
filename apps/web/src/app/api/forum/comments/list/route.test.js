import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route.js";

const mockDb = vi.hoisted(() => ({
  session: { user: { id: "viewer" } },
  rows: [],
  query: "",
}));

vi.mock("../../../../../auth.js", () => ({
  auth: vi.fn(async () => mockDb.session),
}));

vi.mock("../../../../../app/api/utils/sql.js", () => ({
  default: vi.fn(async (strings) => {
    mockDb.query = strings.join(" ").replace(/\s+/g, " ");
    return mockDb.rows;
  }),
}));

const postId = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  mockDb.session = { user: { id: "viewer" } };
  mockDb.rows = [{
    id: "33333333-3333-4333-8333-333333333333",
    post_id: postId,
    user_id: "private-user",
    parent_comment_id: "44444444-4444-4444-8444-444444444444",
    content: "Anonymous reply",
    is_anonymous: true,
    created_at: "2026-10-08T10:00:00.000Z",
    account_name: "Private Student Name",
    author_email: "private@student.example",
    profile_picture: "https://example.test/private-avatar.png",
  }];
  mockDb.query = "";
});

describe("GET /api/forum/comments/list", () => {
  it("returns threaded comments without fetching or exposing comment vote counts", async () => {
    const response = await GET(
      new Request(`http://localhost/api/forum/comments/list?post_id=${postId}`),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockDb.query).not.toContain("forum_votes");
    expect(mockDb.query).not.toContain("vote_type");
    expect(data.comments[0].parent_comment_id).toBe("44444444-4444-4444-8444-444444444444");
    expect(data.comments[0].author_name).toBe("Anonymous");
    expect(data.comments[0].profile_picture).toBeNull();
    expect(data.comments[0]).not.toHaveProperty("user_id");
    expect(data.comments[0]).not.toHaveProperty("author_email");
    expect(data.comments[0]).not.toHaveProperty("account_name");
    expect(data.comments[0]).not.toHaveProperty("upvotes");
    expect(data.comments[0]).not.toHaveProperty("downvotes");
  });
});
