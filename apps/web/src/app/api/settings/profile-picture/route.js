import sql from "../../../../app/api/utils/sql.js";
import { auth } from "../../../../auth.js";
import {
  MAX_PROFILE_PICTURE_BYTES,
  createProfilePictureObjectKey,
  deleteProfilePictureObject,
  inspectProfilePictureImage,
  profilePictureObjectKeyFromReference,
  profilePictureReferenceForKey,
  putProfilePictureObject,
} from "../../../../app/api/utils/profilePictureStorage.js";

const MAX_MULTIPART_BYTES = MAX_PROFILE_PICTURE_BYTES + 64 * 1024;

class UploadTooLargeError extends Error {
  constructor() {
    super("upload_too_large");
    this.code = "UPLOAD_TOO_LARGE";
  }
}

function tooLargeResponse() {
  return Response.json({ error: "Image upload request is too large" }, { status: 413 });
}

async function parseUploadForm(request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return { error: "Request must be multipart form data", status: 400 };
  }

  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader !== null) {
    if (!/^\d+$/.test(contentLengthHeader)) {
      return { error: "Invalid content length", status: 400 };
    }
    if (Number(contentLengthHeader) > MAX_MULTIPART_BYTES) {
      return { error: "Image upload request is too large", status: 413 };
    }
  }

  if (!request.body) return { error: "Request body is required", status: 400 };

  let requestBytes = 0;
  const boundedBody = request.body.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        requestBytes += chunk.byteLength;
        if (requestBytes > MAX_MULTIPART_BYTES) throw new UploadTooLargeError();
        controller.enqueue(chunk);
      },
    }),
  );

  try {
    const boundedRequest = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: boundedBody,
      duplex: "half",
    });
    return { formData: await boundedRequest.formData() };
  } catch (error) {
    if (error?.code === "UPLOAD_TOO_LARGE") {
      return { error: "Image upload request is too large", status: 413 };
    }
    return { error: "Request body must contain a valid image upload", status: 400 };
  }
}

async function cleanupUnreferencedPicture(reference) {
  const key = profilePictureObjectKeyFromReference(reference);
  if (!key) return;

  try {
    const references = await sql`
      SELECT COUNT(*)::int AS reference_count
      FROM user_settings
      WHERE profile_picture = ${reference}
    `;
    if (Number(references[0]?.reference_count || 0) > 0) return;
    await deleteProfilePictureObject(key);
  } catch {
    // The new database reference is already saved; a failed cleanup only leaves
    // an unreachable private object and must not undo that successful change.
    console.warn("Profile picture object cleanup failed");
  }
}

export async function POST(request) {
  let uploadedKey = null;
  let uploaded = false;

  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const parsed = await parseUploadForm(request);
    if (parsed.error) {
      return Response.json({ error: parsed.error }, { status: parsed.status });
    }

    const keys = Array.from(parsed.formData.keys());
    const image = parsed.formData.get("file");
    if (keys.length !== 1 || keys[0] !== "file" || !image || typeof image.arrayBuffer !== "function") {
      return Response.json({ error: "Upload exactly one image file" }, { status: 400 });
    }
    if (image.size === 0) {
      return Response.json({ error: "Image file cannot be empty" }, { status: 400 });
    }
    if (image.size > MAX_PROFILE_PICTURE_BYTES) return tooLargeResponse();

    const imageBytes = new Uint8Array(await image.arrayBuffer());
    const imageInfo = inspectProfilePictureImage(imageBytes);
    if (!imageInfo) {
      return Response.json(
        { error: "Only valid JPEG, PNG, or WebP images are allowed" },
        { status: 400 },
      );
    }

    const currentSettings = await sql`
      SELECT profile_picture
      FROM user_settings
      WHERE user_id = ${userId}
      LIMIT 1
    `;
    const previousReference = currentSettings[0]?.profile_picture || null;
    uploadedKey = createProfilePictureObjectKey(imageInfo.extension);
    const nextReference = profilePictureReferenceForKey(uploadedKey);

    await putProfilePictureObject(uploadedKey, imageBytes, imageInfo.contentType);
    uploaded = true;

    const savedSettings = await sql`
      INSERT INTO user_settings (user_id, profile_picture, default_anonymous)
      VALUES (${userId}, ${nextReference}, false)
      ON CONFLICT (user_id)
      DO UPDATE SET profile_picture = EXCLUDED.profile_picture
      RETURNING profile_picture
    `;
    if (!savedSettings[0]) throw new Error("Profile picture setting was not saved");

    if (previousReference && previousReference !== nextReference) {
      await cleanupUnreferencedPicture(previousReference);
    }

    return Response.json({ profile_picture: savedSettings[0].profile_picture });
  } catch {
    if (uploaded && uploadedKey) {
      try {
        await deleteProfilePictureObject(uploadedKey);
      } catch {
        console.warn("Unreferenced profile picture cleanup failed");
      }
    }
    console.error("POST /api/settings/profile-picture failed");
    return Response.json({ error: "Unable to upload profile picture" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const currentSettings = await sql`
      SELECT profile_picture
      FROM user_settings
      WHERE user_id = ${userId}
      LIMIT 1
    `;
    const previousReference = currentSettings[0]?.profile_picture || null;

    const savedSettings = await sql`
      INSERT INTO user_settings (user_id, profile_picture, default_anonymous)
      VALUES (${userId}, NULL, false)
      ON CONFLICT (user_id)
      DO UPDATE SET profile_picture = NULL
      RETURNING profile_picture
    `;

    if (previousReference) await cleanupUnreferencedPicture(previousReference);
    return Response.json({ profile_picture: savedSettings[0]?.profile_picture || null });
  } catch {
    console.error("DELETE /api/settings/profile-picture failed");
    return Response.json({ error: "Unable to remove profile picture" }, { status: 500 });
  }
}
