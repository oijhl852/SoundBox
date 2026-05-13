import { describe, expect, it } from "vitest";
import {
  createInitialPlayerState,
  selectPlayerFile,
  setPlaybackLoading,
  setPlaybackMuted,
  setPlaybackTime,
  setPlaybackVolume,
} from "@/lib/player-state";
import { computeSeekTime, computeVolumeForAudio, shouldAutoplayNextSource } from "@/lib/player-actions";

describe("player-state", () => {
  it("selects file and resets playback progress", () => {
    const base = {
      ...createInitialPlayerState(),
      isPlaying: true,
      isLoading: true,
      currentTime: 12,
      duration: 99,
    };

    const result = selectPlayerFile(base, { name: "A.wav", path: "A" });

    expect(result.currentFile?.path).toBe("A");
    expect(result.isPlaying).toBe(false);
    expect(result.isLoading).toBe(false);
    expect(result.currentTime).toBe(0);
    expect(result.duration).toBe(0);
  });

  it("computes seek time and audio volume safely", () => {
    expect(computeSeekTime(100, 0.25)).toBe(25);
    expect(computeSeekTime(100, -1)).toBe(0);
    expect(computeSeekTime(100, 2)).toBe(100);
    expect(computeVolumeForAudio(0.8, false)).toBe(0.8);
    expect(computeVolumeForAudio(0.8, true)).toBe(0);
  });

  it("keeps job guard and basic state setters stable", () => {
    const base = createInitialPlayerState();
    expect(shouldAutoplayNextSource(2, 2)).toBe(true);
    expect(shouldAutoplayNextSource(2, 3)).toBe(false);
    expect(setPlaybackLoading(base, true).isLoading).toBe(true);
    expect(setPlaybackTime(base, 10).currentTime).toBe(10);
    expect(setPlaybackVolume(base, 0.5).volume).toBe(0.5);
    expect(setPlaybackMuted(base, true).isMuted).toBe(true);
  });
});
