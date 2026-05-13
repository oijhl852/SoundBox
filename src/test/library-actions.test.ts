import { describe, expect, it } from "vitest";
import { shouldApplyLibraryResult, shouldTriggerBackgroundIndex } from "@/lib/library-actions";

describe("library-actions", () => {
  it("guards async library result by request id and path", () => {
    expect(shouldApplyLibraryResult(1, 1, "A", "A")).toBe(true);
    expect(shouldApplyLibraryResult(1, 2, "A", "A")).toBe(false);
    expect(shouldApplyLibraryResult(1, 1, "A", "B")).toBe(false);
  });

  it("triggers background index only when snapshot is incomplete", () => {
    expect(shouldTriggerBackgroundIndex({ indexingComplete: false } as never)).toBe(true);
    expect(shouldTriggerBackgroundIndex({ indexingComplete: true } as never)).toBe(false);
  });
});
