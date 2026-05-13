import { describe, expect, it } from "vitest";
import { buildBackgroundIndexCompletedState, buildLibraryErrorState, buildLoadingState, shouldUseCachedSnapshot } from "@/lib/app-orchestration";

describe("app-orchestration", () => {
  it("builds loading and error states", () => {
    expect(buildLoadingState("正在读取目录结构...")).toEqual({
      status: "indexing",
      message: "正在读取目录结构...",
    });
    expect(buildLibraryErrorState(new Error("boom"))).toEqual({
      status: "error",
      message: "boom",
    });
  });

  it("treats cached snapshot as reusable orchestration input", () => {
    expect(shouldUseCachedSnapshot(undefined)).toBe(false);
    expect(shouldUseCachedSnapshot({})).toBe(true);
  });

  it("marks completed background snapshot for caching", () => {
    const snapshot = { indexingComplete: true } as never;
    expect(buildBackgroundIndexCompletedState(snapshot)).toEqual({
      snapshot,
      shouldCache: true,
    });
  });
});
