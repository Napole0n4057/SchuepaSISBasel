import { describe, expect, it } from "vitest";
import {
  MAX_PROFILE_PICTURE_BYTES,
  createProfilePictureObjectKey,
  inspectProfilePictureImage,
  profilePictureObjectKeyFromReference,
  profilePictureReferenceForKey,
} from "./profilePictureStorage.js";

function pngBytes() {
  const bytes = new Uint8Array(58);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0, 0, 0, 13], 8);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  bytes.set([0, 0, 0, 1], 16);
  bytes.set([0, 0, 0, 1], 20);
  bytes.set([0, 0, 0, 1], 33);
  bytes.set([0x49, 0x44, 0x41, 0x54], 37);
  bytes[41] = 0x78;
  bytes.set([0, 0, 0, 0], 42);
  bytes.set([0, 0, 0, 0], 46);
  bytes.set([0x49, 0x45, 0x4e, 0x44], 50);
  return bytes;
}

function jpegBytes() {
  const bytes = new Uint8Array(30);
  bytes.set([0xff, 0xd8], 0);
  bytes.set([0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00], 2);
  bytes.set([0xff, 0xda], 15);
  bytes.set([0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00], 17);
  bytes.set([0x00, 0xff, 0xd9], 27);
  return bytes;
}

function webpBytes() {
  const bytes = new Uint8Array(26);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0);
  bytes.set([18, 0, 0, 0], 4);
  bytes.set([0x57, 0x45, 0x42, 0x50], 8);
  bytes.set([0x56, 0x50, 0x38, 0x4c], 12);
  bytes.set([5, 0, 0, 0], 16);
  bytes.set([0x2f, 0, 0, 0, 0], 20);
  return bytes;
}

describe("profilePictureStorage", () => {
  it.each([
    ["JPEG", jpegBytes(), "jpg", "image/jpeg"],
    ["PNG", pngBytes(), "png", "image/png"],
    ["WebP", webpBytes(), "webp", "image/webp"],
  ])("recognizes a valid %s from its bytes", (_name, bytes, extension, contentType) => {
    expect(inspectProfilePictureImage(bytes)).toEqual({ extension, contentType });
  });

  it("rejects bytes that only claim to be an image", () => {
    expect(
      inspectProfilePictureImage(new Uint8Array([0, 1, 2, 3, 4, 5])),
    ).toBeNull();
  });

  it("rejects files larger than one megabyte", () => {
    expect(inspectProfilePictureImage(new Uint8Array(MAX_PROFILE_PICTURE_BYTES + 1))).toBeNull();
  });

  it("creates unpredictable object keys and only parses the expected key shape", () => {
    const first = createProfilePictureObjectKey("png");
    const second = createProfilePictureObjectKey("png");
    expect(first).not.toBe(second);
    expect(profilePictureObjectKeyFromReference(profilePictureReferenceForKey(first))).toBe(first);
    expect(profilePictureObjectKeyFromReference("r2:other-users/image.png")).toBeNull();
  });
});
