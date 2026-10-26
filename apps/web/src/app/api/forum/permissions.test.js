import { beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ auth: vi.fn(), sql: vi.fn() }));
vi.mock("../../../auth.js", () => ({ auth: f.auth }));
vi.mock("../utils/sql.js", () => ({ default: f.sql }));
import { POST as post } from "./posts/create/route.js";
import { POST as comment } from "./comments/create/route.js";
import { POST as deletePost } from "./posts/delete/route.js";
import { POST as deleteComment } from "./comments/delete/route.js";
import { POST as editPost } from "./posts/update/route.js";
import { POST as editComment } from "./comments/update/route.js";
import { POST as editBlog } from "../blog/update/route.js";
import { POST as deleteBlog } from "../blog/delete/route.js";
import { POST as createBlog } from "../blog/create/route.js";
const id = "11111111-1111-4111-8111-111111111111";
const request = () =>
  new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify({
      id,
      post_id: id,
      comment_id: id,
      title: "Edited",
      content: "Moderated content",
    }),
  });
beforeEach(() => {
  vi.resetAllMocks();
  f.auth.mockResolvedValue({ user: { id } });
  f.sql.mockImplementation(async (q) => {
    const query = typeof q === "string" ? q : q.join(" ");
    if (query.includes("SELECT designation"))
      return [{ designation: "spectator" }];
    if (query.includes("SELECT id FROM forum_posts")) return [{ id }];
    if (query.includes("SELECT post_id")) return [{ post_id: id }];
    if (query.includes("crosses_posts")) return [{ crosses_posts: false }];
    return [{ id, content: "Moderated content" }];
  });
  f.sql.transaction = vi.fn(async (build) => Promise.all(build(f.sql)));
});
describe("spectator moderation and read-only participation", () => {
  it.each([post, comment, createBlog])(
    "blocks direct content publishing",
    async (handler) => {
      expect((await handler(request())).status).toBe(403);
      expect(f.sql).toHaveBeenCalledTimes(1);
    },
  );
  it.each([
    editPost,
    editComment,
    editBlog,
    deleteBlog,
    deletePost,
    deleteComment,
  ])("allows spectator moderation", async (handler) => {
    expect((await handler(request())).status).toBe(200);
  });
  it.each([
    editPost,
    editComment,
    editBlog,
    deleteBlog,
    deletePost,
    deleteComment,
  ])("blocks member moderation and anonymous calls", async (handler) => {
    f.sql.mockResolvedValue([{ designation: "member" }]);
    expect((await handler(request())).status).toBe(403);
    f.auth.mockResolvedValue(null);
    expect((await handler(request())).status).toBe(401);
  });
  it("preserves member forum posting", async () => {
    f.sql
      .mockResolvedValueOnce([{ designation: "member" }])
      .mockResolvedValueOnce([{ id }]);
    expect((await post(request())).status).toBe(200);
  });
});
