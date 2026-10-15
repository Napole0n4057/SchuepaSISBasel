export const STUDENT_PROGRAMMES = Object.freeze(["Gym", "Int"]);

export function isValidStudentClass(programme, year) {
  return (
    STUDENT_PROGRAMMES.includes(programme) &&
    Number.isInteger(year) &&
    year >= 1 &&
    year <= 6
  );
}

export function isValidUserId(userId) {
  return typeof userId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
}
