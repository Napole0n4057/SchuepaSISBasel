import { getToken } from "@auth/core/jwt";

export async function GET(request) {
  try {
    const secureCookie = process.env.AUTH_URL
      ? process.env.AUTH_URL.startsWith("https")
      : false;
    const token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      secureCookie,
    });

    if (!token) {
      return Response.json(null);
    }

    return Response.json({
      user: {
        id: token.sub,
        email: token.email,
        name: token.name,
        image: token.picture,
      },
      expires: token.exp ? token.exp.toString() : null,
    });
  } catch (err) {
    console.error("GET /api/auth/session error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
