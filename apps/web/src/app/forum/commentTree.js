export function buildCommentTree(comments = []) {
  const nodes = new Map(
    comments.map((comment) => [comment.id, { ...comment, replies: [] }]),
  );
  const roots = [];

  for (const comment of comments) {
    const node = nodes.get(comment.id);
    const parent = comment.parent_comment_id
      ? nodes.get(comment.parent_comment_id)
      : null;

    if (parent && parent.id !== node.id) {
      parent.replies.push(node);
    } else {
      // Keep comments visible if legacy or inconsistent data has no parent row.
      roots.push(node);
    }
  }

  return roots;
}
