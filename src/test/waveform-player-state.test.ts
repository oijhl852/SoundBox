import { describe, expect, it } from "vitest";
import { buildProgressPercent, clampSeekTarget } from "@/lib/waveform-player-state";

describe("waveform-player-state", () => {
  it("clamps seek target within range", () => {
    expect(clampSeekTarget(100, 50, -10)).toBe(40);
    expect(clampSeekTarget(100, 5, -10)).toBe(0);
    expect(clampSeekTarget(100, 95, 10)).toBe(100);
  });

  it("builds progress percent safely", () => {
    expect(buildProgressPercent(25, 100)).toBe(25);
    expect(buildProgressPercent(0, 0)).toBe(0);
  });
});
