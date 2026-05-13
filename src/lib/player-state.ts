export type PlayerState = {
  currentFile: { name: string; path: string } | null;
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
};

export function createInitialPlayerState(): PlayerState {
  return {
    currentFile: null,
    isPlaying: false,
    isLoading: false,
    currentTime: 0,
    duration: 0,
    volume: 0.8,
    isMuted: false,
  };
}

export function resetPlaybackProgress(state: PlayerState): PlayerState {
  return {
    ...state,
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    isLoading: false,
  };
}

export function selectPlayerFile(
  state: PlayerState,
  file: { name: string; path: string } | null
): PlayerState {
  return {
    ...resetPlaybackProgress(state),
    currentFile: file,
  };
}

export function setPlaybackLoading(state: PlayerState, isLoading: boolean): PlayerState {
  return {
    ...state,
    isLoading,
  };
}

export function setPlaybackTime(state: PlayerState, currentTime: number): PlayerState {
  return {
    ...state,
    currentTime,
  };
}

export function setPlaybackDuration(state: PlayerState, duration: number): PlayerState {
  return {
    ...state,
    duration,
  };
}

export function setPlaybackActive(state: PlayerState, isPlaying: boolean): PlayerState {
  return {
    ...state,
    isPlaying,
  };
}

export function setPlaybackVolume(state: PlayerState, volume: number): PlayerState {
  return {
    ...state,
    volume,
  };
}

export function setPlaybackMuted(state: PlayerState, isMuted: boolean): PlayerState {
  return {
    ...state,
    isMuted,
  };
}
