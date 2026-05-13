import { useCallback, useEffect, useRef, useState } from "react";
import { computeVolumeForAudio } from "@/lib/player-actions";
import { logError } from "@/lib/logger";
import { type PlayerState, createInitialPlayerState, setPlaybackMuted, setPlaybackTime, setPlaybackVolume } from "@/lib/player-state";
import { createAudioElementBindings } from "@/lib/audio-element-effects";
import {
  buildLoadingPlayerState,
  buildWaveformReadyState,
  buildWaveformErrorState,
  buildSeekState,
  buildPlaybackToggleResult,
  buildNextPlayerSelection,
} from "@/lib/player-controller-state";
import { loadPlayerWaveform } from "@/lib/player-domain-effects";


export function usePlayerDomain() {
  const [playerState, setPlayerState] = useState<PlayerState>(createInitialPlayerState);

  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const playheadRafRef = useRef<number | null>(null);
  const waveformJobIdRef = useRef(0);

  const currentFile = playerState.currentFile;
  const isPlaying = playerState.isPlaying;
  const isLoading = playerState.isLoading;
  const currentTime = playerState.currentTime;
  const duration = playerState.duration;
  const volume = playerState.volume;
  const isMuted = playerState.isMuted;

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = computeVolumeForAudio(volume, isMuted);
    }
  }, [volume, isMuted]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    return createAudioElementBindings({
      audio,
      requestAnimationFrameImpl: requestAnimationFrame,
      cancelAnimationFrameImpl: cancelAnimationFrame,
      setPlayerState,
      playheadRafRef,
    });
  }, []);

  useEffect(() => {
    if (!currentFile) return;
    setPlayerState((prev) => buildLoadingPlayerState(prev));

    void loadPlayerWaveform({
      currentFilePath: currentFile.path,
      waveformJobIdRef,
      audioRef,
      setPlayerState,
      buildReadyState: buildWaveformReadyState,
      buildFailureState: buildWaveformErrorState,
    });

  }, [currentFile]);

  const resetPlayerState = useCallback((nextState: PlayerState = createInitialPlayerState()) => {
    setPlayerState(nextState);
  }, []);

  const clearAudioElement = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
    }
  }, []);

  const seekToPercent = useCallback((percent: number) => {
    if (!audioRef.current || !duration) return;
    const nextState = buildSeekState(duration, percent);
    audioRef.current.currentTime = nextState.currentTime;
    setPlayerState((prev) => setPlaybackTime(prev, nextState.currentTime));
  }, [duration]);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    seekToPercent((e.clientX - rect.left) / rect.width);
  }, [seekToPercent]);

  const selectFile = useCallback((name: string, path: string) => {
    const nextSelection = buildNextPlayerSelection(playerState, { name, path });
    setPlayerState(nextSelection.playerState);
    return nextSelection;
  }, [playerState]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    const nextAction = buildPlaybackToggleResult(isPlaying);

    if (nextAction.shouldPause) {
      audioRef.current.pause();
      return;
    }
    if (nextAction.shouldPlay) {
      audioRef.current.play().catch((err) => logError("播放失败", err));
    }
  }, [isPlaying]);

  const toggleMute = useCallback(() => {
    setPlayerState((prev) => setPlaybackMuted(prev, !prev.isMuted));
  }, []);

  const setVolume = useCallback((nextVolume: number) => {
    setPlayerState((prev) => setPlaybackVolume(prev, nextVolume));

  }, []);

  const formatTime = useCallback((seconds: number) => {
    return isNaN(seconds)
      ? "00:00"
      : `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
  }, []);

  return {
    playerState,
    currentFile,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    volume,
    isMuted,
    audioRef,
    progressRef,
    setPlayerState,
    resetPlayerState,
    clearAudioElement,
    selectFile,
    togglePlay,
    toggleMute,
    setVolume,
    seekToPercent,
    handleProgressClick,
    formatTime,
  };
}
