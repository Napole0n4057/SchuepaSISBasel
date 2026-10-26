import { describe, expect, it } from "vitest";
import { parseUsersFromText } from "./studentAccountImport.js";

describe("account import", () => {
  it("preserves exact class names with spaces in all formats and permits no class", () => {
    expect(parseUsersFromText(
        "Max, m@example.org, secret, G3\nLia\tl@example.org\tsecret\tIBDP 2\ni@example.org secret Pre-IB 3\nt@example.org secret",
    ).map((u) => u.class_name)).toEqual(["G3", "IBDP 2", "Pre-IB 3", null]);
  });

  it("does not silently translate legacy programme/year pairs", () => {
    expect(
      parseUsersFromText("Max, m@example.org, secret, Gym, 4")[0].class_name,
    ).toBe("Gym 4");
  });
});
