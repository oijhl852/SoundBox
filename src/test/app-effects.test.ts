import { describe, expect, it, vi } from "vitest";
import { createWaveformJobGuard, mergeMiniWaveforms } from "@/lib/app-effects";
import { buildLibraryErrorState } from "@/lib/app-orchestration";

describe("app-effects", () => {
  it("merges only missing mini waveforms", () => {
    const result = mergeMiniWaveforms(
      { A: [1, 2] },
      [
        ["A", [9, 9]],
        ["B", [3, 4]],
      ] as const
    );

    expect(result).toEqual({ A: [1, 2], B: [3, 4] });
  });

  it("builds error state from thrown error", () => {
    expect(buildLibraryErrorState(new Error("boom"))).toEqual({
      status: "error",
      message: "boom",
    });
  });

  it("checks waveform job identity through guard", () => {
    const ref = { current: 2 };
    const guard = createWaveformJobGuard(ref);
    expect(guard(2)).toBe(true);
    expect(guard(3)).toBe(false);
  });
});
