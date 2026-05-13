import { describe, expect, it } from "vitest";
import {
  buildEndedPlayerState,
  buildLoadingPlayerState,
  buildNextPlayerSelection,
  buildPlaybackToggleResult,
  buildPlayerControllerState,
  buildSeekState,
  buildWaveformErrorState,
  buildWaveformReadyState,
} from "@/lib/player-controller-state";

import { createInitialPlayerState, setPlaybackLoading } from "@/lib/player-state";

describe("player-controller-state", () => {

  it("builds player controller state from player state", () => {
    const state = buildPlayerControllerState(createInitialPlayerState());
    expect(state.currentFile).toBeNull();
    expect(state.isPlaying).toBe(false);
    expect(state.duration).toBe(0);
  });

  it("selects next file and resets tag editor visibility", () => {
    const result = buildNextPlayerSelection(createInitialPlayerState(), { name: "A.wav", path: "A" });
    expect(result.playerState.currentFile?.path).toBe("A");
    expect(result.hideTagEditor).toBe(true);
  });

  it("builds seek state with clamped time", () => {
    const result = buildSeekState(120, 0.5);
    expect(result.currentTime).toBe(60);
  });

  it("builds waveform lifecycle states for app shell", () => {
    const base = createInitialPlayerState();
    expect(buildLoadingPlayerState(base).isLoading).toBe(true);
    expect(buildWaveformReadyState(setPlaybackLoading(base, true), 33).duration).toBe(33);
    expect(buildWaveformErrorState(setPlaybackLoading(base, true)).isLoading).toBe(false);
  });

  it("builds playback toggle and ended states", () => {
    expect(buildPlaybackToggleResult(true)).toEqual({ shouldPause: true, shouldPlay: false });
    expect(buildPlaybackToggleResult(false)).toEqual({ shouldPause: false, shouldPlay: true });
    expect(buildEndedPlayerState(createInitialPlayerState()).currentTime).toBe(0);
  });
});
