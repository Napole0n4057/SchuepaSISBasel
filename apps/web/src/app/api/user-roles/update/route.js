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
      return Response.json(
        { error: "Invalid JSON" },
        { status: 400 },
      );
    }

    if (!body || !isValidUserId(body.userId))
      return Response.json(
        { error: "Valid userId required" },
        { status: 400 });
    if (!["admin", "member", "spectator"].includes(body.designation))
      return Response.json({ error: "Invalid designation" }, { status: 400 });
    if (role !== "admin")
      return Response.json({ error: "Admin access required" }, { status: 403 });
    const result = await mutateAccount(
      session.user.id,
      body.userId,
      "role",
      body.designation,
    );
    if (!result.length)
      return Response.json({ error: "Account unavailable, protected, or last administrator" },
        { status: 409 },
      );
    return Response.json({ success: true, user: result[0] });
  } catch (err) {
    if (err?.code === "23505")
      return Response.json({ error: "Email already in use" }, { status: 409 });
    console.error("Account role failed", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
