import { accountMutation } from "../../utils/permissions.js";
import sql from "../../../../app/api/utils/sql.js";
import { auth } from "../../../../auth.js";
import { hash } from "argon2";
import { addStudent } from "../../../../app/api/utils/studentStore.js";
import { isOptionalStudentClass } from "../../../../studentClasses.js";

function deriveNameFromEmail(email) {
  const localPart = email.split("@")[0] || email;
  return localPart
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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
      const { email, password,
        class_name = null,
        designation = "member",
      } = userData;
      const providedName =
        typeof userData.name === "string" ? userData.name.trim() : "";

      if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
        results.errors.push({
          email: email || "unknown",
          reason: "Missing email or password",
        });
        continue;
      }

      if (!isOptionalStudentClass(class_name) ||
        userData.programme != null ||
        userData.year != null
      ) {
        results.errors.push({
          email,
          reason:
            "A valid class name or null is required; legacy programme/year needs manual mapping",
        });
        continue;
      }

      if (
        !["admin", "member", "spectator"].includes(designation) ||
        (designation === "admin" && currentUserRole[0].designation !== "admin")) {
        results.errors.push({
          email,
          reason: "Forbidden role assignment" });
        continue;
      }

      const normalizedEmail = email.toLowerCase().trim();

      try {
        // Check if user already exists
        const existingUser = await sql`
          SELECT id FROM auth_users WHERE LOWER(email) = ${normalizedEmail}
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

        const resolvedName =
          providedName.length > 0
            ? providedName
            : deriveNameFromEmail(normalizedEmail);

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
          SELECT id FROM new_user
        `,
        );
        if (!newUser.length) {
          results.errors.push({ email, reason: "Forbidden" });
          continue;
        }

        // Store in text file (local) for teacher requirement
        await addStudent({
          name: resolvedName,
          email: normalizedEmail,
          passwordHash: hashedPassword,
          createdAt: new Date().toISOString(),
        });

        results.created.push({ email: normalizedEmail, name: resolvedName });
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
