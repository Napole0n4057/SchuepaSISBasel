import { beforeEach, describe, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({
  auth: vi.fn(),
  sql: vi.fn(),
  getObject: vi.fn(),
  keyFromReference: vi.fn(),
  contentTypeFromKey: vi.fn(),
}));

vi.mock("../../../auth.js", () => ({ auth: fixtures.auth }));
vi.mock("../../api/utils/sql.js", () => ({ default: fixtures.sql }));
vi.mock("../../api/utils/profilePictureStorage.js", () => ({
  MAX_PROFILE_PICTURE_BYTES: 1024 * 1024,
  getProfilePictureObject: fixtures.getObject,
  profilePictureContentTypeFromKey: fixtures.contentTypeFromKey,
  profilePictureObjectKeyFromReference: fixtures.keyFromReference,
}));

import { GET } from "./route.js";

const reference = `r2:profile-pictures/${"c".repeat(64)}.webp`;
const key = reference.slice(3);

describe("private profile picture delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fixtures.auth.mockResolvedValue({ user: { id: "viewer" } });
    fixtures.sql.mockResolvedValue([{ exists: 1 }]);
    fixtures.keyFromReference.mockReturnValue(key);
    fixtures.contentTypeFromKey.mockReturnValue("image/webp");
    fixtures.getObject.mockResolvedValue({
      Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) },
    });
  });

  it("requires authentication before serving an image", async () => {
    fixtures.auth.mockResolvedValue(null);
    const response = await GET(new Request(`http://localhost/api/profile-picture?ref=${encodeURIComponent(reference)}`));

    expect(response.status).toBe(401);
    expect(fixtures.sql).not.toHaveBeenCalled();
    expect(fixtures.getObject).not.toHaveBeenCalled();
  });

  it("only serves an object while its reference exists in user settings", async () => {
    fixtures.sql.mockResolvedValue([]);
    const response = await GET(new Request(`http://localhost/api/profile-picture?ref=${encodeURIComponent(reference)}`));

    expect(response.status).toBe(404);
    expect(fixtures.getObject).not.toHaveBeenCalled();
  });

  it("streams the private image with safe caching and content headers", async () => {
    const response = await GET(new Request(`http://localhost/api/profile-picture?ref=${encodeURIComponent(reference)}`));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("cache-control")).toBe("private, max-age=86400, immutable");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.arrayBuffer()).toEqual(new Uint8Array([1, 2, 3]).buffer);
    expect(fixtures.getObject).toHaveBeenCalledWith(key);
  });
});
