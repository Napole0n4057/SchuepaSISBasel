import { STUDENT_CLASS_NAMES, nextStudentClass } from "./studentClasses.js";
export const STUDENT_CLASS_ROLLOVERS = Object.freeze([
  { academicYear: "2027-2028", effectiveOn: "2027-08-16" },
  { academicYear: "2028-2029", effectiveOn: "2028-08-14" },
  { academicYear: "2029-2030", effectiveOn: "2029-08-13" },
  { academicYear: "2030-2031", effectiveOn: "2030-08-12" },
  { academicYear: "2031-2032", effectiveOn: "2031-08-11" },
  { academicYear: "2032-2033", effectiveOn: "2032-08-09" },
]);

export function baselCalendarDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function dueStudentClassRollovers(today, schedule = STUDENT_CLASS_ROLLOVERS) {
  return schedule.filter(({ effectiveOn }) => effectiveOn <= today);
}

export async function processDueStudentClassRollovers(sql, today) {
  const processed = [];
  const progression = JSON.stringify(
    STUDENT_CLASS_NAMES.map((class_name) => ({
      class_name,
      next_class: nextStudentClass(class_name),
    })),
  );
  for (const rollover of dueStudentClassRollovers(today)) {
    const result = await sql`
      WITH rollover_claim AS (
        INSERT INTO student_class_rollovers (academic_year, effective_on)
        VALUES (${rollover.academicYear}, ${rollover.effectiveOn}::date)
        ON CONFLICT (academic_year) DO NOTHING RETURNING academic_year
      ), progression AS (
        SELECT * FROM jsonb_to_recordset(${progression}::jsonb) AS p(class_name text, next_class text)
      ), promoted AS (
        UPDATE student_classes sc
        SET class_name = COALESCE(p.next_class, sc.class_name),
            review_required = (p.next_class IS NULL), updated_at = NOW()
        FROM progression p
        WHERE sc.class_name = p.class_name
          AND EXISTS (SELECT 1 FROM rollover_claim)
          AND EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = sc.user_id AND user_roles.designation = 'member')
        RETURNING p.next_class
      )
      SELECT EXISTS (SELECT 1 FROM rollover_claim) AS processed,
        COUNT(*) FILTER (WHERE next_class IS NOT NULL)::integer AS promoted_count,
        COUNT(*) FILTER (WHERE next_class IS NULL)::integer AS review_count
      FROM promoted
    `;

    if (result[0]?.processed)
      processed.push({
        ...rollover,
        promotedCount: Number(result[0].promoted_count || 0),
        reviewCount: Number(result[0].review_count || 0),
      });
  }
  return processed;
}
