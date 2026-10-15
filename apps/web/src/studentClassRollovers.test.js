import { describe, expect, it, vi } from "vitest";
import {
  baselCalendarDate,
  dueStudentClassRollovers,
  nextStudentYear,
  processDueStudentClassRollovers,
  STUDENT_CLASS_ROLLOVERS,
} from "./studentClassRollovers.js";

describe("Basel school-year rollover dates", () => {
  it("uses the official 2027 first school day and only triggers on or after it", () => {
    expect(STUDENT_CLASS_ROLLOVERS[0]).toEqual({
      academicYear: "2027-2028",
      effectiveOn: "2027-08-16",
    });
    expect(dueStudentClassRollovers("2027-08-15")).toEqual([]);
    expect(dueStudentClassRollovers("2027-08-16")[0]).toEqual(STUDENT_CLASS_ROLLOVERS[0]);
  });

  it("converts timestamps to the Europe/Zurich calendar date", () => {
    expect(baselCalendarDate(new Date("2027-08-15T22:00:00.000Z"))).toBe("2027-08-16");
  });

  it("includes the published school-year starts through 2032", () => {
    expect(STUDENT_CLASS_ROLLOVERS.map(({ effectiveOn }) => effectiveOn)).toEqual([
      "2027-08-16", "2028-08-14", "2029-08-13", "2030-08-12", "2031-08-11", "2032-08-09",
    ]);
  });
});

describe("class year progression", () => {
  it("advances students and never creates year 7", () => {
    expect([1, 2, 3, 4, 5, 6].map(nextStudentYear)).toEqual([2, 3, 4, 5, 6, 6]);
  });

  it("claims each academic year once when the rollover runs repeatedly", async () => {
    const markers = new Set();
    const years = [1, 5, 6];
    const statements = [];
    const sql = vi.fn(async (strings, ...values) => {
      const statement = strings.join("?");
      statements.push(statement);
      const academicYear = values[0];
      if (markers.has(academicYear)) return [{ processed: false, promoted_count: 0 }];
      markers.add(academicYear);
      let promotedCount = 0;
      for (let index = 0; index < years.length; index += 1) {
        if (years[index] < 6) {
          years[index] += 1;
          promotedCount += 1;
        }
      }
      return [{ processed: true, promoted_count: promotedCount }];
    });

    const first = await processDueStudentClassRollovers(sql, "2027-08-16");
    const repeated = await processDueStudentClassRollovers(sql, "2027-08-16");
    expect(first).toHaveLength(1);
    expect(repeated).toEqual([]);
    expect(years).toEqual([2, 6, 6]);
    expect(markers).toEqual(new Set(["2027-2028"]));
    expect(statements[0]).toContain("ON CONFLICT (academic_year) DO NOTHING");
    expect(statements[0]).toContain("EXISTS (SELECT 1 FROM rollover_claim)");
    expect(statements[0]).toContain("SET year = year + 1");
    expect(statements[0]).toContain("WHERE year < 6");
    expect(statements[0]).toContain("user_roles.designation = 'member'");
  });
});
