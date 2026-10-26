// Canonical names are also the API/storage identifiers. Parallel years never alias.
export const STUDENT_TRACKS = Object.freeze({
  Gymnasium: Object.freeze(["S1", "S2", "G1", "G2", "G3", "G4"]),
  International: Object.freeze([
    "Pre-IB 1",
    "Pre-IB 2",
    "Pre-IB 3",
    "IBDP 1",
    "IBDP 2",
    "IBDP 3",
  ]),
});
export const STUDENT_CLASS_NAMES = Object.freeze(
  Object.values(STUDENT_TRACKS).flat(),
);

export const isValidStudentClass = (name) => STUDENT_CLASS_NAMES.includes(name);
export const isOptionalStudentClass = (name) =>
  name === null || name === undefined || isValidStudentClass(name);
export function nextStudentClass(name) {
  for (const track of Object.values(STUDENT_TRACKS)) {
    const index = track.indexOf(name);
    if (index !== -1) return track[index + 1] ?? null;
  }
  return null;
}
export const needsGraduationReview = (name) =>
  isValidStudentClass(name) && nextStudentClass(name) === null;
export function isValidUserId(userId) {
  return (
    typeof userId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)
  );
}
