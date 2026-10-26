import { accountMutation } from "../../utils/permissions.js";
import sql from "../../../../app/api/utils/sql.js";
import { auth } from "../../../../auth.js";
import { hash } from "argon2";
import { isOptionalStudentClass } from "../../../../studentClasses.js";

export async function POST(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check account-management permission
    const currentUserRole = await sql`
      SELECT designation
      FROM user_roles
      WHERE user_id = ${session.user.id}
      LIMIT 1
    `;

    if (
      currentUserRole.length === 0 ||
      !["admin", "spectator"].includes(currentUserRole[0].designation)
    ) {
      return Response.json(
        { error: "Forbidden - Admin or Spectator access required" },
        { status: 403 },
      );
    }

    const body = (await request.json()) || {};
    const { email, password, class_name = null, designation = "member" } = body;
    const providedName = typeof body.name === "string" ? body.name.trim() : "";

    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
      return Response.json(
        { error: "Missing email or password" },
        { status: 400 },
      );
    }

    if (!isOptionalStudentClass(class_name) ||
      body.programme != null ||
      body.year != null
    ) {
      return Response.json(
        {
          error:
            "A valid class name or null is required; legacy programme/year needs manual mapping",
        },
        { status: 400 },
      );
    }

    if (
      !["admin", "member", "spectator"].includes(designation) ||
      (designation === "admin" && currentUserRole[0].designation !== "admin")) {
      return Response.json(
        { error: "Forbidden role assignment" },
        { status: 403 },
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await sql`
      SELECT id FROM auth_users WHERE LOWER(email) = ${normalizedEmail}
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

    const newUser = await accountMutation(
      (tx) => tx`
      WITH new_user AS (
        INSERT INTO auth_users (email, name, "emailVerified")
        SELECT ${normalizedEmail}, ${resolvedName}, NOW()
        WHERE EXISTS (SELECT 1 FROM user_roles actor WHERE actor.user_id = ${session.user.id}
          AND (actor.designation = 'admin' OR (actor.designation = 'spectator' AND ${designation} IN ('member', 'spectator'))))
        AND NOT EXISTS (SELECT 1 FROM auth_users existing WHERE LOWER(existing.email) = ${normalizedEmail})
        RETURNING id, email
      ), new_account AS (
        INSERT INTO auth_accounts ("userId", type, provider, "providerAccountId", password)
        SELECT id, 'credentials', 'credentials', email, ${hashedPassword}
        FROM new_user
        RETURNING id
      ), new_role AS (
        INSERT INTO user_roles (user_id, email, designation)
        SELECT id, email, ${designation}
        FROM new_user
        RETURNING id
      ), new_class AS (
        INSERT INTO student_classes (user_id, class_name)
        SELECT id, ${class_name}
        FROM new_user
        RETURNING user_id
      )
      SELECT id, email FROM new_user
    `,
    );
    if (!newUser.length)
      return Response.json({ error: "Forbidden" }, { status: 403 });

    const userId = newUser[0].id;

    return Response.json({
      success: true,
      user: { id: userId, email: normalizedEmail, name: resolvedName },
    });
  } catch (err) {
    console.error("POST /api/users/create error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
