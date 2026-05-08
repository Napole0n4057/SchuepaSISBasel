import sql from "../../../../app/api/utils/sql.js";
import { auth } from "../../../../auth.js";
import { hash } from "argon2";

export async function POST(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if current user is admin
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
    const providedName = typeof body.name === "string" ? body.name.trim() : "";

    if (!email || !password) {
      return Response.json(
        { error: "Missing email or password" },
        { status: 400 },
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await sql`
      SELECT id FROM auth_users WHERE email = ${normalizedEmail}
    `;

    if (existingUser.length > 0) {
      return Response.json({ error: "User already exists" }, { status: 400 });
    }

    // Hash the password
    const hashedPassword = await hash(password);

    const resolvedName =
      providedName.length > 0
        ? providedName
        : normalizedEmail.split("@")[0].replace(/[._-]+/g, " ").trim();

    // Create user in auth_users
    const newUser = await sql`
      INSERT INTO auth_users (email, name, "emailVerified")
      VALUES (${normalizedEmail}, ${resolvedName}, NOW())
      RETURNING id, email
    `;

    const userId = newUser[0].id;

    // Create credentials account
    await sql`
      INSERT INTO auth_accounts ("userId", type, provider, "providerAccountId", password)
      VALUES (${userId}, 'credentials', 'credentials', ${normalizedEmail}, ${hashedPassword})
    `;

    // Create user role (default to member)
    await sql`
      INSERT INTO user_roles (user_id, email, designation)
      VALUES (${userId.toString()}, ${normalizedEmail}, 'member')
    `;

    return Response.json({
      success: true,
      user: { id: userId, email: normalizedEmail, name: resolvedName },
    });
  } catch (err) {
    console.error("POST /api/users/create error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
