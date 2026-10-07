import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import ProfileAvatar from "./ProfileAvatar.jsx";

const roots = [];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function render(component) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push({ container, root });
  act(() => root.render(component));
  return container;
}

afterEach(() => {
  for (const { container, root } of roots.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
});

describe("ProfileAvatar", () => {
  it("shows the fallback when there is no picture", () => {
    const container = render(<ProfileAvatar name="Alex Example" />);

    expect(container.querySelector("[data-testid=profile-avatar-fallback]")).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
  });

  it("shows a supplied profile picture", () => {
    const container = render(
      <ProfileAvatar src="https://example.test/avatar.png" name="Alex Example" />,
    );

    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "https://example.test/avatar.png",
    );
  });

  it("uses the anonymous fallback without rendering an image", () => {
    const container = render(<ProfileAvatar src={null} name="Anonymous" />);

    expect(
      container.querySelector('[role="img"][aria-label="Anonymous profile picture"]'),
    ).toBeTruthy();
    expect(container.querySelector("[data-testid=profile-avatar-fallback]")).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
  });

  it("falls back when an image URL fails to load", () => {
    const container = render(
      <ProfileAvatar src="https://example.test/broken.png" name="Alex Example" />,
    );

    act(() => {
      container.querySelector("img").dispatchEvent(new Event("error"));
    });

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[data-testid=profile-avatar-fallback]")).toBeTruthy();
  });
});
