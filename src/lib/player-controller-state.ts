import { computeSeekTime } from "@/lib/player-actions";
import {
  createInitialPlayerState,
  selectPlayerFile,
  setPlaybackActive,
  setPlaybackDuration,
  setPlaybackLoading,
  setPlaybackTime,
} from "@/lib/player-state";

export function buildPlayerControllerState(playerState = createInitialPlayerState()) {
  return {
    currentFile: playerState.currentFile,
    isPlaying: playerState.isPlaying,
    isLoading: playerState.isLoading,
    currentTime: playerState.currentTime,
    duration: playerState.duration,
    volume: playerState.volume,
    isMuted: playerState.isMuted,
  };
}

export function buildNextPlayerSelection(
  playerState: ReturnType<typeof createInitialPlayerState>,
  file: { name: string; path: string }
) {
  return {
    playerState: selectPlayerFile(playerState, file),
    hideTagEditor: true,
  };
}

export function buildSeekState(duration: number, percent: number) {
  return {
    currentTime: computeSeekTime(duration, percent),
  };
}

export function buildLoadingPlayerState(playerState: ReturnType<typeof createInitialPlayerState>) {
  return setPlaybackDuration(setPlaybackTime(setPlaybackLoading(playerState, true), 0), 0);
}

export function buildWaveformReadyState(
  playerState: ReturnType<typeof createInitialPlayerState>,
  waveformDuration: number
) {
  const nextState = isFinite(waveformDuration) && waveformDuration > 0
    ? setPlaybackDuration(playerState, waveformDuration)
    : playerState;
  return setPlaybackLoading(nextState, false);
}

export function buildWaveformErrorState(playerState: ReturnType<typeof createInitialPlayerState>) {
  return setPlaybackLoading(playerState, false);
}

export function buildPlaybackToggleResult(isPlaying: boolean) {
  return {
    shouldPause: isPlaying,
    shouldPlay: !isPlaying,
  };
}

export function buildEndedPlayerState(playerState: ReturnType<typeof createInitialPlayerState>) {
  return setPlaybackTime(setPlaybackActive(playerState, false), 0);
}
