import { describe, expect, it } from "vitest";
import { parseUsersFromText } from "./studentAccountImport.js";

describe("student account import format", () => {
  it("parses programme and year in CSV, tab, and legacy whitespace rows", () => {
    expect(parseUsersFromText(
      "Max Example, max@example.org, secret, Gym, 1\nLia Example\tlia@example.org\tsecret\tInt\t2\nthird@example.org secret Gym 3",
    )).toEqual([
      { name: "Max Example", email: "max@example.org", password: "secret", programme: "Gym", year: 1 },
      { name: "Lia Example", email: "lia@example.org", password: "secret", programme: "Int", year: 2 },
      { email: "third@example.org", password: "secret", programme: "Gym", year: 3 },
    ]);
  });

  it("leaves missing and invalid values for server-side validation to reject", () => {
    const [missing, invalid] = parseUsersFromText(
      "missing@example.org secret\ninvalid@example.org secret Gym first",
    );
    expect(missing.year).toBeNaN();
    expect(invalid.year).toBeNaN();
  });
});
