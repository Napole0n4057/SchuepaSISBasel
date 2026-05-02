import sql from "@/app/api/utils/sql";

export async function POST(request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return Response.json(
        { error: "Missing or invalid email" },
        { status: 400 },
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    return Response.json({ allowed: true });
  } catch (err) {
    console.error("POST /api/allowed-emails/check error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
