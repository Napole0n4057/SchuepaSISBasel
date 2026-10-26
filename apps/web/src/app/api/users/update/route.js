import { auth } from "../../../../auth.js";
import { getRole } from "../../utils/permissions.js";
import { mutateAccount } from "../../utils/accountManagement.js";
import { isValidUserId } from "../../../../studentClasses.js";

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    const role = await getRole(session.user.id);
    if (!["admin", "spectator"].includes(role))
      return Response.json({ error: "Forbidden" }, { status: 403 });
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
    if (!body || !isValidUserId(body.userId))
      return Response.json({ error: "Valid userId required" }, { status: 400 });
    if (
      typeof body.name !== "string" ||
      typeof body.email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())
    )
      return Response.json(
        { error: "Valid name and email are required" },
        { status: 400 },
      );
    if (Object.hasOwn(body, "designation") || Object.hasOwn(body, "role"))
      return Response.json(
        { error: "Use administrator role management" },
        { status: 403 },
      );
    const result = await mutateAccount(
      session.user.id,
      body.userId,
      "details",
      body.name.trim(),
      body.email.trim().toLowerCase(),
    );
    if (!result.length)
      return Response.json(
        { error: "Account unavailable, protected, or last administrator" },
        { status: 409 },
      );
    return Response.json({ success: true, user: result[0] });
  } catch (err) {
    if (err?.code === "23505")
      return Response.json({ error: "Email already in use" }, { status: 409 });
    console.error("Account details failed", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
