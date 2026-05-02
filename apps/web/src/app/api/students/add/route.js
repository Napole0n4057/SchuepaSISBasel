import { auth } from "@/auth";
import sql from "@/app/api/utils/sql";
import { addStudent } from "@/app/api/utils/studentStore";
import { hash } from "argon2";

export async function POST(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUserRole = await sql`
      SELECT designation
      FROM user_roles
      WHERE user_id = ${session.user.id}
      LIMIT 1
    `;

    if (
      currentUserRole.length === 0 ||
      currentUserRole[0].designation !== "admin"
    ) {
      return Response.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return Response.json(
        { error: "Missing email or password" },
        { status: 400 },
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const passwordHash = await hash(password);

    await addStudent({
      email: normalizedEmail,
      passwordHash,
      createdAt: new Date().toISOString(),
    });

    return Response.json({ success: true });
  } catch (err) {
    console.error("POST /api/students/add error", err);
    return Response.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
