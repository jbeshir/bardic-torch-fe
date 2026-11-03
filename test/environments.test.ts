import { describe, it, expect } from "vitest";

describe("test environment", () => {
  it("runs files outside *.test.tsx in node, without a DOM", () => {
    expect(typeof document).toBe("undefined");
    expect(typeof window).toBe("undefined");
  });
});
