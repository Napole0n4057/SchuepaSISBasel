import { describe, expect, it } from "vitest";
import { withForumAuthor } from "./forumAuthor.js";

describe("withForumAuthor", () => {
  it("uses the Auth.js account name and keeps the picture for identified authors", () => {
    const result = withForumAuthor({
      id: "post-1",
      user_id: "user-1",
      is_anonymous: false,
      account_name: "Alex Example",
      author_email: "alex@example.test",
      profile_picture: "https://example.test/avatar.png",
    });

    expect(result.author_name).toBe("Alex Example");
    expect(result.profile_picture).toBe("https://example.test/avatar.png");
    expect(result.user_id).toBe("user-1");
    expect(result).not.toHaveProperty("author_email");
    expect(result).not.toHaveProperty("account_name");
  });

  it("falls back to the existing email-derived name when the account has no name", () => {
    const result = withForumAuthor({
      id: "post-2",
      is_anonymous: false,
      account_name: "  ",
      author_email: "alex.example@example.test",
      profile_picture: null,
    });

    expect(result.author_name).toBe("Alex Example");
    expect(result.profile_picture).toBeNull();
    expect(result).not.toHaveProperty("author_email");
  });

  it("does not expose anonymous author identity or picture fields", () => {
    const result = withForumAuthor({
      id: "comment-1",
      user_id: "secret-user-id",
      is_anonymous: true,
      account_name: "Alex Example",
      author_email: "alex@example.test",
      profile_picture: "https://example.test/avatar.png",
    });

    expect(result.author_name).toBe("Anonymous");
    expect(result.profile_picture).toBeNull();
    expect(result).not.toHaveProperty("author_email");
    expect(result).not.toHaveProperty("account_name");
    expect(result).not.toHaveProperty("user_id");
  });
});
