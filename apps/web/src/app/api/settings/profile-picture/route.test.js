// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({
  auth: vi.fn(),
  sql: vi.fn(),
  put: vi.fn(),
  remove: vi.fn(),
  inspect: vi.fn(),
  makeKey: vi.fn(),
  keyFromReference: vi.fn(),
  referenceForKey: vi.fn(),
}));

vi.mock("../../../../auth.js", () => ({ auth: fixtures.auth }));
vi.mock("../../../../app/api/utils/sql.js", () => ({ default: fixtures.sql }));
vi.mock("../../../../app/api/utils/profilePictureStorage.js", () => ({
  MAX_PROFILE_PICTURE_BYTES: 1024 * 1024,
  createProfilePictureObjectKey: fixtures.makeKey,
  deleteProfilePictureObject: fixtures.remove,
  inspectProfilePictureImage: fixtures.inspect,
  profilePictureObjectKeyFromReference: fixtures.keyFromReference,
  profilePictureReferenceForKey: fixtures.referenceForKey,
  putProfilePictureObject: fixtures.put,
}));

import { DELETE, POST } from "./route.js";

const newKey = `profile-pictures/${"a".repeat(64)}.png`;
const oldKey = `profile-pictures/${"b".repeat(64)}.jpg`;

function sqlText(strings) {
  return strings.join("?");
}

function uploadRequest(bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47])) {
  const boundary = "----profile-picture-test-boundary";
  const encoder = new TextEncoder();
  const prefix = encoder.encode(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="avatar.png"\r\nContent-Type: image/png\r\n\r\n`,
  );
  const suffix = encoder.encode(`\r\n--${boundary}--\r\n`);
  const body = new Uint8Array(prefix.length + bytes.length + suffix.length);
  body.set(prefix);
  body.set(bytes, prefix.length);
  body.set(suffix, prefix.length + bytes.length);
  return new Request("http://localhost/api/settings/profile-picture", {
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body,
  });
}

describe("profile picture settings API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fixtures.auth.mockResolvedValue({ user: { id: "signed-in-user" } });
    fixtures.inspect.mockReturnValue({ extension: "png", contentType: "image/png" });
    fixtures.makeKey.mockReturnValue(newKey);
    fixtures.referenceForKey.mockImplementation((key) => `r2:${key}`);
    fixtures.keyFromReference.mockImplementation((reference) =>
      typeof reference === "string" && reference.startsWith("r2:")
        ? reference.slice(3)
        : null,
    );
    fixtures.put.mockResolvedValue(undefined);
    fixtures.remove.mockResolvedValue(undefined);
    fixtures.sql.mockImplementation(async (strings) => {
      const text = sqlText(strings);
      if (text.includes("SELECT profile_picture")) return [{ profile_picture: null }];
      if (text.includes("INSERT INTO user_settings")) {
        return [{ profile_picture: `r2:${newKey}` }];
      }
      if (text.includes("reference_count")) return [{ reference_count: 0 }];
      return [];
    });
  });

  it("requires a signed-in account for uploads", async () => {
    fixtures.auth.mockResolvedValue(null);

    const response = await POST(uploadRequest());

    expect(response.status).toBe(401);
    expect(fixtures.put).not.toHaveBeenCalled();
  });

  it("rejects content that is not an actual supported image", async () => {
    fixtures.inspect.mockReturnValue(null);

    const response = await POST(uploadRequest(new Uint8Array([1, 2, 3, 4])));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Only valid JPEG, PNG, or WebP images are allowed");
    expect(fixtures.put).not.toHaveBeenCalled();
    expect(fixtures.sql).not.toHaveBeenCalled();
  });

  it("rejects files above the one-megabyte limit", async () => {
    const response = await POST(uploadRequest(new Uint8Array(1024 * 1024 + 1)));

    expect(response.status).toBe(413);
    expect(fixtures.put).not.toHaveBeenCalled();
    expect(fixtures.sql).not.toHaveBeenCalled();
  });

  it("stores the uploaded image for the signed-in account only", async () => {
    const response = await POST(uploadRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.profile_picture).toBe(`r2:${newKey}`);
    expect(fixtures.put).toHaveBeenCalledWith(
      newKey,
      expect.any(Uint8Array),
      "image/png",
    );
    expect(fixtures.sql.mock.calls[0][1]).toBe("signed-in-user");
    expect(fixtures.sql.mock.calls[1][1]).toBe("signed-in-user");
    expect(fixtures.sql.mock.calls[1][2]).toBe(`r2:${newKey}`);
  });

  it("cleans up an old owned object only after the new reference is saved", async () => {
    const oldReference = `r2:${oldKey}`;
    fixtures.sql.mockImplementation(async (strings) => {
      const text = sqlText(strings);
      if (text.includes("SELECT profile_picture")) return [{ profile_picture: oldReference }];
      if (text.includes("INSERT INTO user_settings")) return [{ profile_picture: `r2:${newKey}` }];
      if (text.includes("reference_count")) return [{ reference_count: 0 }];
      return [];
    });

    const response = await POST(uploadRequest());

    expect(response.status).toBe(200);
    expect(fixtures.remove).toHaveBeenCalledTimes(1);
    expect(fixtures.remove).toHaveBeenCalledWith(oldKey);
  });

  it("keeps an old object that is still referenced by another setting", async () => {
    const oldReference = `r2:${oldKey}`;
    fixtures.sql.mockImplementation(async (strings) => {
      const text = sqlText(strings);
      if (text.includes("SELECT profile_picture")) return [{ profile_picture: oldReference }];
      if (text.includes("INSERT INTO user_settings")) return [{ profile_picture: `r2:${newKey}` }];
      if (text.includes("reference_count")) return [{ reference_count: 1 }];
      return [];
    });

    const response = await POST(uploadRequest());

    expect(response.status).toBe(200);
    expect(fixtures.remove).not.toHaveBeenCalled();
  });

  it("removes the setting for only the authenticated user and cleans up its old object", async () => {
    fixtures.sql.mockImplementation(async (strings) => {
      const text = sqlText(strings);
      if (text.includes("SELECT profile_picture")) return [{ profile_picture: `r2:${oldKey}` }];
      if (text.includes("INSERT INTO user_settings")) return [{ profile_picture: null }];
      if (text.includes("reference_count")) return [{ reference_count: 0 }];
      return [];
    });

    const response = await DELETE();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.profile_picture).toBeNull();
    expect(fixtures.sql.mock.calls[0][1]).toBe("signed-in-user");
    expect(fixtures.remove).toHaveBeenCalledWith(oldKey);
  });
});
