import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { hash } from "argon2";
import { addStudent } from "@/app/api/utils/studentStore";

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
    const { users } = body;

    if (!Array.isArray(users) || users.length === 0) {
      return Response.json(
        { error: "Missing or invalid users array" },
        { status: 400 },
      );
    }

    const results = {
      created: [],
      skipped: [],
      errors: [],
    };

    for (const userData of users) {
      const { email, password } = userData;

      if (!email || !password) {
        results.errors.push({
          email: email || "unknown",
          reason: "Missing email or password",
        });
        continue;
      }

      const normalizedEmail = email.toLowerCase().trim();

      try {
        // Check if user already exists
        const existingUser = await sql`
          SELECT id FROM auth_users WHERE email = ${normalizedEmail}
        `;

        if (existingUser.length > 0) {
          results.skipped.push({
            email: normalizedEmail,
            reason: "User already exists",
          });
          continue;
        }

        // Hash the password
        const hashedPassword = await hash(password);

        // Create user in auth_users
        const newUser = await sql`
          INSERT INTO auth_users (email, name, "emailVerified")
          VALUES (${normalizedEmail}, ${normalizedEmail}, NOW())
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

        // Store in text file (local) for teacher requirement
        await addStudent({
          email: normalizedEmail,
          passwordHash: hashedPassword,
          createdAt: new Date().toISOString(),
        });

        results.created.push({ email: normalizedEmail });
      } catch (err) {
        console.error(`Error creating user ${normalizedEmail}:`, err);
        results.errors.push({
          email: normalizedEmail,
          reason: err.message || "Unknown error",
        });
      }
    }

    return Response.json({
      success: true,
      summary: {
        total: users.length,
        created: results.created.length,
        skipped: results.skipped.length,
        errors: results.errors.length,
      },
      results,
    });
  } catch (err) {
    console.error("POST /api/users/bulk-create error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
