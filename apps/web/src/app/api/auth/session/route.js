import { getToken } from "@auth/core/jwt";
import sql from "../../../../app/api/utils/sql.js";

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

    let accountName = token.name;
    if (token.sub) {
      try {
        const rows = await sql`
          SELECT name
          FROM auth_users
          WHERE id = ${token.sub}
          LIMIT 1
        `;
        const storedName = rows[0]?.name;
        if (typeof storedName === "string" && storedName.trim()) {
          accountName = storedName.trim();
        }
      } catch (err) {
        console.error("Could not refresh the account display name", err);
      }
    }

    return Response.json({
      user: {
        id: token.sub,
        email: token.email,
        name: accountName,
        image: token.picture,
      },
      expires: token.exp ? token.exp.toString() : null,
    });
  } catch (err) {
    console.error("GET /api/auth/session error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
