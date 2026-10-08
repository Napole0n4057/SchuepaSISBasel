import React, { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import ForumComments from "./ForumComments.jsx";

const postId = "post-1";
const roots = [];
let comments = [];
let id = 0;
let submittedBodies = [];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function translate(key, values = {}) {
  return key.replace(/\{([^}]+)\}/g, (_, name) => String(values[name] ?? ""));
}

function installCommentApi() {
  vi.stubGlobal("fetch", vi.fn(async (url, options = {}) => {
    if (String(url).includes("/api/forum/comments/list")) {
      return Response.json({ comments: structuredClone(comments) });
    }

    if (String(url).includes("/api/forum/comments/create")) {
      const body = JSON.parse(options.body);
      submittedBodies.push(body);
      const created = {
        id: `comment-${++id}`,
        post_id: body.post_id,
        parent_comment_id: body.parent_comment_id || null,
        content: body.content,
        is_anonymous: body.is_anonymous,
        author_name: body.is_anonymous ? "Anonymous" : `Student ${id}`,
        profile_picture: null,
        created_at: "2026-10-08T10:00:00.000Z",
      };
      comments.push(created);
      return Response.json({ comment: created });
    }

    throw new Error(`Unexpected request: ${url}`);
  }));
}

function renderComments(props = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push({ container, root });
  act(() => {
    root.render(
      <ForumComments
        postId={postId}
        initialCount={0}
        user={{ id: "signed-in-user", name: "Current Student" }}
        profilePicture={null}
        isAdmin={false}
        language="en"
        onCountChange={vi.fn()}
        t={translate}
        {...props}
      />,
    );
  });
  return container;
}

async function click(element) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function typeInto(element, value) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(element),
      "value",
    ).set;
    setter.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function waitForElement(getElement) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    let result;
    await act(async () => {
      result = getElement();
      if (!result) await new Promise((resolve) => setTimeout(resolve, 0));
    });
    if (result) return result;
  }
  throw new Error("Expected UI element did not appear");
}

function buttonByText(container, label, index = 0) {
  return [...container.querySelectorAll("button")]
    .filter((button) => button.textContent.trim() === label)[index];
}

function commentArticle(container, content) {
  const paragraph = [...container.querySelectorAll("p")].find(
    (element) => element.textContent === content,
  );
  return paragraph?.closest("article");
}

afterEach(() => {
  for (const { container, root } of roots.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
  vi.unstubAllGlobals();
  comments = [];
  submittedBodies = [];
  id = 0;
});

describe("ForumComments", () => {
  it("opens and closes the compact comments section and creates a top-level comment", async () => {
    installCommentApi();
    const container = renderComments();

    await click(container.querySelector('button[aria-label="Comments: 0"]'));
    expect(container.querySelector('button[aria-label="Comments: 0"]'))
      .toHaveAttribute("aria-expanded", "true");

    const input = await waitForElement(() =>
      container.querySelector('textarea[placeholder="Add a comment..."]'),
    );
    expect(input.closest("form").className).toContain("min-w-0");
    expect(input.className).toContain("min-w-0");
    expect(buttonByText(container, "Send").className).toContain("shrink-0");

    await typeInto(input, "Comment A");
    await click(buttonByText(container, "Send"));
    await waitForElement(() => commentArticle(container, "Comment A"));

    expect(submittedBodies[0]).toMatchObject({ post_id: postId, content: "Comment A" });
    expect(submittedBodies[0]).not.toHaveProperty("parent_comment_id");
    expect(container.querySelector('button[aria-label="Comments: 1"]'))
      .toBeInTheDocument();
    expect(container.querySelector('button[aria-label="Comments: 1"]').className)
      .toContain("border-transparent");
    expect(buttonByText(container, "Reply").className)
      .toContain("border-transparent");
    expect([...container.querySelectorAll("button")].some((button) =>
      /upvote|downvote/i.test(button.textContent),
    )).toBe(false);

    await click(container.querySelector('button[aria-label="Comments: 1"]'));
    expect(container.querySelector('textarea[placeholder="Add a comment..."]'))
      .toBeNull();
  });

  it("submits a reply to a reply with that reply's ID as the parent", async () => {
    installCommentApi();
    const container = renderComments();
    await click(container.querySelector('button[aria-label="Comments: 0"]'));

    const topInput = await waitForElement(() =>
      container.querySelector('textarea[placeholder="Add a comment..."]'),
    );
    await typeInto(topInput, "Comment A");
    await click(buttonByText(container, "Send"));
    await waitForElement(() => commentArticle(container, "Comment A"));

    await click(buttonByText(container, "Reply"));
    expect(buttonByText(container, "Cancel").className)
      .toContain("border-transparent");
    const firstReplyInput = await waitForElement(() =>
      container.querySelector('textarea[placeholder="Write a reply"]'),
    );
    await typeInto(firstReplyInput, "Reply B");
    await click(buttonByText(container, "Send reply"));
    await waitForElement(() => commentArticle(container, "Reply B"));

    const replyBArticle = commentArticle(container, "Reply B");
    await click(buttonByText(replyBArticle, "Reply"));
    expect(replyBArticle.textContent).toContain("Replying to Student 2");
    const nestedReplyInput = replyBArticle.querySelector(
      'textarea[placeholder="Write a reply"]',
    );
    await typeInto(nestedReplyInput, "Reply C");
    await click(buttonByText(replyBArticle, "Send reply"));
    await waitForElement(() => commentArticle(container, "Reply C"));

    expect(submittedBodies[2].parent_comment_id).toBe(comments[1].id);
    expect(comments[2].parent_comment_id).toBe(comments[1].id);
    expect(container.querySelector('button[aria-label="Comments: 3"]'))
      .toBeInTheDocument();
    expect(commentArticle(container, "Reply C").parentElement.closest("article"))
      .toBe(replyBArticle);
  });

  it("anonymizes top-level comments and replies independently", async () => {
    installCommentApi();
    const container = renderComments();
    await click(container.querySelector('button[aria-label="Comments: 0"]'));

    const anonymousCommentCheckbox = await waitForElement(() =>
      [...container.querySelectorAll("label")].find((label) =>
        label.textContent.includes("Comment anonymously"),
      )?.querySelector("input[type=checkbox]"),
    );
    await click(anonymousCommentCheckbox);
    await typeInto(
      container.querySelector('textarea[placeholder="Add a comment..."]'),
      "Anonymous A",
    );
    await click(buttonByText(container, "Send"));
    await waitForElement(() => commentArticle(container, "Anonymous A"));

    await click(buttonByText(container, "Reply"));
    const anonymousReplyCheckbox = await waitForElement(() =>
      [...container.querySelectorAll("label")].find((label) =>
        label.textContent.includes("Reply anonymously"),
      )?.querySelector("input[type=checkbox]"),
    );
    await click(anonymousReplyCheckbox);
    await typeInto(
      container.querySelector('textarea[placeholder="Write a reply"]'),
      "Anonymous B",
    );
    await click(buttonByText(container, "Send reply"));
    await waitForElement(() => commentArticle(container, "Anonymous B"));

    expect(submittedBodies[0].is_anonymous).toBe(true);
    expect(submittedBodies[1]).toMatchObject({
      parent_comment_id: comments[0].id,
      is_anonymous: true,
    });
    expect(comments[0].author_name).toBe("Anonymous");
    expect(comments[1].author_name).toBe("Anonymous");
  });
});
