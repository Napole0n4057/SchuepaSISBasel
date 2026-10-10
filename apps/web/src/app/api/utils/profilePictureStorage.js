import { randomBytes } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export const MAX_PROFILE_PICTURE_BYTES = 1024 * 1024;
export const PROFILE_PICTURE_REFERENCE_PREFIX = "r2:";

const MAX_PROFILE_PICTURE_DIMENSION = 12000;
const MAX_PROFILE_PICTURE_PIXELS = 40_000_000;
const TYPE_BY_EXTENSION = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};
const OBJECT_KEY_PATTERN = /^profile-pictures\/[a-f0-9]{64}\.(jpg|png|webp)$/;

let client;

function dimensionsAreSafe(width, height) {
  return (
    Number.isInteger(width) &&
    Number.isInteger(height) &&
    width > 0 &&
    height > 0 &&
    width <= MAX_PROFILE_PICTURE_DIMENSION &&
    height <= MAX_PROFILE_PICTURE_DIMENSION &&
    width * height <= MAX_PROFILE_PICTURE_PIXELS
  );
}

function jpegDimensions(bytes) {
  if (bytes.length < 12 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  const startOfFrameMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce,
    0xcf,
  ]);
  let offset = 2;
  let frameSize = null;

  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;

    if (marker === 0xd9) return null;
    if (marker === 0xda) {
      if (!frameSize || offset + 1 >= bytes.length) return null;
      const scanLength = (bytes[offset] << 8) | bytes[offset + 1];
      const scanStart = offset + scanLength;
      if (scanLength < 6 || scanStart >= bytes.length - 1) return null;
      for (let index = bytes.length - 2; index >= scanStart; index -= 1) {
        if (bytes[index] === 0xff && bytes[index + 1] === 0xd9) return frameSize;
      }
      return null;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    if (offset + 1 >= bytes.length) return null;

    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;

    if (startOfFrameMarkers.has(marker)) {
      if (segmentLength < 7) return null;
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      frameSize = { width, height };
    }

    offset += segmentLength;
  }

  return null;
}

function inspectWebp(bytes) {
  if (
    bytes.length < 25 ||
    String.fromCharCode(...bytes.subarray(0, 4)) !== "RIFF" ||
    String.fromCharCode(...bytes.subarray(8, 12)) !== "WEBP"
  ) {
    return null;
  }

  const declaredLength =
    bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24);
  if (declaredLength + 8 > bytes.length) return null;

  const chunkType = String.fromCharCode(...bytes.subarray(12, 16));
  const chunkLength = bytes[16] | (bytes[17] << 8) | (bytes[18] << 16) | (bytes[19] << 24);
  if (20 + chunkLength > bytes.length) return null;

  let width;
  let height;
  if (chunkType === "VP8X" && chunkLength >= 10) {
    width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
    height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
  } else if (chunkType === "VP8 " && chunkLength >= 10) {
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;
    width = ((bytes[26] | (bytes[27] << 8)) & 0x3fff);
    height = ((bytes[28] | (bytes[29] << 8)) & 0x3fff);
  } else if (chunkType === "VP8L" && chunkLength >= 5 && bytes[20] === 0x2f) {
    width = 1 + bytes[21] + ((bytes[22] & 0x3f) << 8);
    height = 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10);
  } else {
    return null;
  }

  return dimensionsAreSafe(width, height) ? { width, height } : null;
}

function inspectPng(bytes) {
  const hasSignature =
    bytes.length >= 57 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;
  if (!hasSignature) return null;

  let offset = 8;
  let width = 0;
  let height = 0;
  let hasHeader = false;
  let hasImageData = false;

  while (offset + 12 <= bytes.length) {
    const chunkLength =
      bytes[offset] * 0x1000000 +
      (bytes[offset + 1] << 16) +
      (bytes[offset + 2] << 8) +
      bytes[offset + 3];
    const chunkType = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    const chunkEnd = offset + 12 + chunkLength;
    if (chunkEnd > bytes.length) return null;

    if (!hasHeader) {
      if (chunkType !== "IHDR" || chunkLength !== 13) return null;
      width = bytes[offset + 8] * 0x1000000 + (bytes[offset + 9] << 16) + (bytes[offset + 10] << 8) + bytes[offset + 11];
      height = bytes[offset + 12] * 0x1000000 + (bytes[offset + 13] << 16) + (bytes[offset + 14] << 8) + bytes[offset + 15];
      hasHeader = true;
    } else if (chunkType === "IDAT" && chunkLength > 0) {
      hasImageData = true;
    } else if (chunkType === "IEND") {
      if (chunkLength !== 0 || !hasImageData || chunkEnd !== bytes.length) return null;
      return dimensionsAreSafe(width, height) ? { width, height } : null;
    }

    offset = chunkEnd;
  }

  return null;
}

export function inspectProfilePictureImage(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  if (bytes.length === 0 || bytes.length > MAX_PROFILE_PICTURE_BYTES) return null;

  if (inspectPng(bytes)) {
    return { extension: "png", contentType: TYPE_BY_EXTENSION.png };
  }

  const jpegSize = jpegDimensions(bytes);
  if (jpegSize && dimensionsAreSafe(jpegSize.width, jpegSize.height)) {
    return { extension: "jpg", contentType: TYPE_BY_EXTENSION.jpg };
  }

  if (inspectWebp(bytes)) {
    return { extension: "webp", contentType: TYPE_BY_EXTENSION.webp };
  }

  return null;
}

export function createProfilePictureObjectKey(extension) {
  if (!Object.hasOwn(TYPE_BY_EXTENSION, extension)) {
    throw new Error("Unsupported profile picture type");
  }
  return `profile-pictures/${randomBytes(32).toString("hex")}.${extension}`;
}

export function profilePictureReferenceForKey(key) {
  if (!OBJECT_KEY_PATTERN.test(key)) throw new Error("Invalid profile picture object key");
  return `${PROFILE_PICTURE_REFERENCE_PREFIX}${key}`;
}

export function profilePictureObjectKeyFromReference(reference) {
  if (typeof reference !== "string" || !reference.startsWith(PROFILE_PICTURE_REFERENCE_PREFIX)) {
    return null;
  }
  const key = reference.slice(PROFILE_PICTURE_REFERENCE_PREFIX.length);
  return OBJECT_KEY_PATTERN.test(key) ? key : null;
}

export function profilePictureContentTypeFromKey(key) {
  const extension = key.split(".").at(-1);
  return TYPE_BY_EXTENSION[extension] || null;
}

function getR2Configuration() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME?.trim();
  const configuredEndpoint = process.env.R2_ENDPOINT?.trim();

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error("R2 storage is not configured");
  }

  const endpointValue = configuredEndpoint || `https://${accountId}.r2.cloudflarestorage.com`;
  const normalizedEndpoint = /^https?:\/\//i.test(endpointValue)
    ? endpointValue
    : `https://${endpointValue}`;
  let endpoint;
  try {
    endpoint = new URL(normalizedEndpoint);
  } catch {
    throw new Error("R2 storage is not configured");
  }
  if (endpoint.protocol !== "https:" || !endpoint.hostname) {
    throw new Error("R2 storage is not configured");
  }

  return {
    bucketName,
    endpoint: endpoint.toString().replace(/\/$/, ""),
    credentials: { accessKeyId, secretAccessKey },
  };
}

function getR2Client(configuration) {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: configuration.endpoint,
      forcePathStyle: true,
      credentials: configuration.credentials,
    });
  }
  return client;
}

export async function putProfilePictureObject(key, body, contentType) {
  const configuration = getR2Configuration();
  await getR2Client(configuration).send(
    new PutObjectCommand({
      Bucket: configuration.bucketName,
      Key: key,
      Body: body,
      ContentLength: body.byteLength,
      ContentType: contentType,
      CacheControl: "private, max-age=31536000, immutable",
    }),
  );
}

export async function getProfilePictureObject(key) {
  const configuration = getR2Configuration();
  return getR2Client(configuration).send(
    new GetObjectCommand({ Bucket: configuration.bucketName, Key: key }),
  );
}

export async function deleteProfilePictureObject(key) {
  const configuration = getR2Configuration();
  await getR2Client(configuration).send(
    new DeleteObjectCommand({ Bucket: configuration.bucketName, Key: key }),
  );
}
