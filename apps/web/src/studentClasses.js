export const STUDENT_PROGRAMMES = Object.freeze(["Gym", "Int"]);
export const STUDENT_YEARS = Object.freeze([1, 2, 3, 4, 5, 6]);
export const STUDENT_CLASS_NAMES = Object.freeze(
  STUDENT_PROGRAMMES.flatMap((programme) =>
    STUDENT_YEARS.map((year) => `${programme} ${year}`),
  ),
);

export function isValidStudentClass(programme, year) {
  return (
    STUDENT_PROGRAMMES.includes(programme) &&
    Number.isInteger(year) &&
    STUDENT_YEARS.includes(year)
  );
}

export function isValidUserId(userId) {
  return typeof userId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
}
