import { describe, expect, it } from "vitest";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

describe("site", () => {
  it("names the product HomeBoard", () => {
    expect(SITE_NAME).toBe("HomeBoard");
  });

  it("describes it in Spanish", () => {
    expect(SITE_DESCRIPTION).toMatch(/hogar/);
  });
});
