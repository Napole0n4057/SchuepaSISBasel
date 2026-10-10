import sql from "../../../app/api/utils/sql.js";
import { auth } from "../../../auth.js";
import {
  MAX_PROFILE_PICTURE_BYTES,
  getProfilePictureObject,
  profilePictureContentTypeFromKey,
  profilePictureObjectKeyFromReference,
} from "../../../app/api/utils/profilePictureStorage.js";

export async function GET(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const reference = new URL(request.url).searchParams.get("ref");
    const key = profilePictureObjectKeyFromReference(reference);
    if (!key) return Response.json({ error: "Profile picture not found" }, { status: 404 });

    const references = await sql`
      SELECT 1
      FROM user_settings
      WHERE profile_picture = ${reference}
      LIMIT 1
    `;
    if (references.length === 0) {
      return Response.json({ error: "Profile picture not found" }, { status: 404 });
    }

    const object = await getProfilePictureObject(key);
    if (!object.Body) return Response.json({ error: "Profile picture not found" }, { status: 404 });
    if (object.ContentLength > MAX_PROFILE_PICTURE_BYTES) {
      return Response.json({ error: "Profile picture not found" }, { status: 404 });
    }
    const image = await object.Body.transformToByteArray();
    if (image.byteLength > MAX_PROFILE_PICTURE_BYTES) {
      return Response.json({ error: "Profile picture not found" }, { status: 404 });
    }
    const contentType = profilePictureContentTypeFromKey(key);
    if (!contentType) return Response.json({ error: "Profile picture not found" }, { status: 404 });

    return new Response(image, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(image.byteLength),
        "Cache-Control": "private, max-age=86400, immutable",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-site",
      },
    });
  } catch (error) {
    if (error?.name === "NoSuchKey" || error?.$metadata?.httpStatusCode === 404) {
      return Response.json({ error: "Profile picture not found" }, { status: 404 });
    }
    console.error("GET /api/profile-picture failed");
    return Response.json({ error: "Unable to load profile picture" }, { status: 500 });
  }
}
