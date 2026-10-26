import { describe, expect, it } from "vitest";
import {
  STUDENT_CLASS_NAMES,
  STUDENT_TRACKS,
  nextStudentClass,
  isOptionalStudentClass,
  needsGraduationReview,
} from "./studentClasses.js";
describe("school classes", () => {
  it("has exactly the twelve required names", () => {
    expect(STUDENT_CLASS_NAMES).toEqual([
      "S1",
      "S2",
      "G1",
      "G2",
      "G3",
      "G4",
      "Pre-IB 1",
      "Pre-IB 2",
      "Pre-IB 3",
      "IBDP 1",
      "IBDP 2",
      "IBDP 3",
    ]);
    expect(new Set(STUDENT_CLASS_NAMES).size).toBe(12);
  });
  it.each(Object.entries(STUDENT_TRACKS))(
    "progresses %s independently",
    (_, classes) => {
      expect(classes.map(nextStudentClass)).toEqual([
        ...classes.slice(1),
        null,
      ]);
      expect(classes.map(needsGraduationReview)).toEqual([
        false,
        false,
        false,
        false,
        false,
        true,
      ]);
    },
  );
  it("accepts unassigned accounts and rejects legacy/unknown names", () => {
    expect(isOptionalStudentClass(null)).toBe(true);
    for (const name of ["Gym 1", "Int 6", "", "IB 1"])
      expect(isOptionalStudentClass(name)).toBe(false);
    expect(nextStudentClass(null)).toBeNull();
  });
});
