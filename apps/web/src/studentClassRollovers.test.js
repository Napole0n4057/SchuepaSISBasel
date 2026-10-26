import { describe, expect, it, vi } from "vitest";
import {
  baselCalendarDate,
  dueStudentClassRollovers,
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

describe("class progression", () => {
  it("passes both exact progression sequences to SQL and skips legacy/unassigned accounts", async () => {
    const sql = vi.fn()
      .mockResolvedValueOnce([{ processed: true, promoted_count: 10, review_count: 2 }])
      .mockResolvedValueOnce([{ processed: false }]);

    const result = await processDueStudentClassRollovers(sql, "2027-08-16");
    await processDueStudentClassRollovers(sql, "2027-08-16");
    expect(result[0]).toMatchObject({ promotedCount: 10, reviewCount: 2 });
    const [strings, ...values] = sql.mock.calls[0];
    const mapping = JSON.parse(values[2]);
    expect(mapping).toEqual([
      { class_name: "S1", next_class: "S2" },
      { class_name: "S2", next_class: "G1" },
      { class_name: "G1", next_class: "G2" },
      { class_name: "G2", next_class: "G3" },
      { class_name: "G3", next_class: "G4" },
      { class_name: "G4", next_class: null },
      { class_name: "Pre-IB 1", next_class: "Pre-IB 2" },
      { class_name: "Pre-IB 2", next_class: "Pre-IB 3" },
      { class_name: "Pre-IB 3", next_class: "IBDP 1" },
      { class_name: "IBDP 1", next_class: "IBDP 2" },
      { class_name: "IBDP 2", next_class: "IBDP 3" },
      { class_name: "IBDP 3", next_class: null },
    ]);
    const query = strings.join("?");
    expect(query).toContain("ON CONFLICT (academic_year) DO NOTHING");
    expect(query).toContain("sc.class_name = p.class_name");
    expect(query).toContain("COALESCE(p.next_class, sc.class_name)");
    expect(query).toContain("review_required = (p.next_class IS NULL)");
  });
});
