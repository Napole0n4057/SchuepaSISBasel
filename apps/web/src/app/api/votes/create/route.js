import { randomUUID } from "node:crypto";
import sql from "../../../../app/api/utils/sql.js";
import { auth } from "../../../../auth.js";

const ALLOWED_CLASSES = new Set([
  "S1",
  "S2",
  "G1",
  "G2",
  "G3",
  "G4",
  "Pre-IB 1",
  "Pre-IB 2",
  "IBDP 1",
  "IBDP 2",
  "IB 1",
  "IB 2",
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseEndAt(value) {
  if (value === undefined || value === null || value === "") {
    return { value: null };
  }

  if (typeof value !== "string" || !value.trim()) {
    return { error: "ends_at must be a valid date and time" };
  }

  const input = value.trim();
  const parts = input.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|([+-])(\d{2}):?(\d{2}))$/i,
  );
  if (!parts) {
    return { error: "ends_at must be an ISO date and time with a timezone" };
  }

  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const hour = parts[4] === undefined ? null : Number(parts[4]);
  const minute = parts[5] === undefined ? null : Number(parts[5]);
  const second = parts[6] === undefined ? 0 : Number(parts[6]);
  const daysPerMonth = [
    31,
    year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysPerMonth[month - 1] ||
    (hour !== null && hour > 23) ||
    (minute !== null && minute > 59) ||
    second > 59
  ) {
    return { error: "ends_at must be a valid ISO date and time" };
  }

  if (parts[9]) {
    const offsetHour = Number(parts[10]);
    const offsetMinute = Number(parts[11]);
    if (
      offsetHour > 14 ||
      offsetMinute > 59 ||
      (offsetHour === 14 && offsetMinute !== 0)
    ) {
      return { error: "ends_at must be a valid ISO date and time" };
    }
  }

  const endDate = new Date(input);

  if (!Number.isFinite(endDate.getTime())) {
    return { error: "ends_at must be a valid date and time" };
  }

  if (endDate.getTime() <= Date.now()) {
    return { error: "ends_at must be in the future" };
  }

  // Store the instant as UTC wall time because votes.ends_at is timestamp without time zone.
  return { value: endDate.toISOString().slice(0, -1) };
}

export async function POST(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const userRole = await sql`
      SELECT designation FROM user_roles WHERE user_id = ${session.user.id}
    `;

    if (userRole.length === 0 || userRole[0].designation !== "admin") {
      return Response.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 },
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Request body must be valid JSON" }, { status: 400 });
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ error: "Request body must be a JSON object" }, { status: 400 });
    }

    const { title, description, options, admin_only, ends_at } = body;
    const suppliedClasses = body.class_names ?? [];

    if (typeof title !== "string" || !title.trim()) {
      return Response.json(
        { error: "A title is required" },
        { status: 400 },
      );
    }

    if (
      !Array.isArray(options) ||
      options.length < 2 ||
      options.some((option) => typeof option !== "string" || !option.trim())
    ) {
      return Response.json(
        { error: "At least 2 non-empty options are required" },
        { status: 400 },
      );
    }

    if (description !== undefined && description !== null && typeof description !== "string") {
      return Response.json({ error: "description must be a string" }, { status: 400 });
    }

    if (!Array.isArray(suppliedClasses)) {
      return Response.json({ error: "class_names must be an array" }, { status: 400 });
    }

    const invalidClass = suppliedClasses.find(
      (className) => typeof className !== "string" || !ALLOWED_CLASSES.has(className),
    );
    if (invalidClass !== undefined) {
      return Response.json(
        { error: "class_names contains an unsupported class" },
        { status: 400 },
      );
    }

    const classNames = [...new Set(suppliedClasses)];
    const endAt = parseEndAt(ends_at);
    if (endAt.error) {
      return Response.json({ error: endAt.error }, { status: 400 });
    }

    const voteId = randomUUID();
    const cleanOptions = options.map((option) => option.trim());
    const transactionResults = await sql.transaction((txn) => [
      txn`
        INSERT INTO votes (id, title, description, created_by, admin_only, ends_at, is_active)
        VALUES (
          ${voteId},
          ${title.trim()},
          ${description?.trim() || null},
          ${session.user.id},
          ${admin_only === true},
          ${endAt.value},
          true
        )
        RETURNING *
      `,
      ...cleanOptions.map(
        (option) => txn`
          INSERT INTO vote_options (vote_id, option_text)
          VALUES (${voteId}, ${option})
          RETURNING *
        `,
      ),
      ...classNames.map(
        (className) => txn`
          INSERT INTO vote_classes (vote_id, class_name)
          VALUES (${voteId}, ${className})
          RETURNING *
        `,
      ),
    ]);

    const createdOptions = transactionResults
      .slice(1, cleanOptions.length + 1)
      .flat();

    return Response.json({
      vote: transactionResults[0][0],
      options: createdOptions,
      class_names: classNames,
    });
  } catch (err) {
    console.error("POST /api/votes/create error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
