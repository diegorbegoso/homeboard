import { describe, expect, it } from "vitest";
import { qrPath } from "@/lib/qr";

describe("qrPath", () => {
  it("builds a square QR path for a URL", () => {
    const { d, size } = qrPath("https://homeboard-tan-ten.vercel.app/entrar");
    expect(size).toBeGreaterThanOrEqual(21);
    expect(d.startsWith("M")).toBe(true);
    expect(d).toContain("h1v1h-1z");
  });

  it("is deterministic and differs per input", () => {
    expect(qrPath("https://a.test").d).toBe(qrPath("https://a.test").d);
    expect(qrPath("https://a.test").d).not.toBe(qrPath("https://b.test").d);
  });
});
