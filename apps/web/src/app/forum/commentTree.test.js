import { describe, expect, it } from "vitest";
import { buildCommentTree } from "./commentTree.js";

describe("buildCommentTree", () => {
  it("nests replies and replies to replies under their parent", () => {
    const tree = buildCommentTree([
      { id: "root", parent_comment_id: null },
      { id: "reply", parent_comment_id: "root" },
      { id: "nested", parent_comment_id: "reply" },
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0].replies[0].id).toBe("reply");
    expect(tree[0].replies[0].replies[0].id).toBe("nested");
  });

  it("keeps comments with missing parents visible as top-level rows", () => {
    const tree = buildCommentTree([
      { id: "orphan", parent_comment_id: "missing-parent" },
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("orphan");
  });
});
