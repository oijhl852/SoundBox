import { useEffect } from "react";
import { create } from "zustand";
import { computeVolumeForAudio } from "@/lib/player-actions";
import { logError } from "@/lib/logger";
import {
  type PlayerState,
  createInitialPlayerState,
  setPlaybackMuted,
  setPlaybackVolume,
} from "@/lib/player-state";
import { createAudioElementBindings, seekOnLoadPct } from "@/lib/audio-element-effects";
import {
  buildWaveformReadyState,
  buildWaveformErrorState,
  buildSeekState,
  buildPlaybackToggleResult,
  buildNextPlayerSelection,
} from "@/lib/player-controller-state";
import { loadPlayerWaveform } from "@/lib/player-domain-effects";

interface PlayerStateData {
  currentFile: { name: string; path: string } | null;
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
}

interface PlayerActions {
  selectFile: (name: string, path: string) => { hideTagEditor: boolean };
  togglePlay: () => void;
  toggleMute: () => void;
  setVolume: (nextVolume: number) => void;
  seekToPercent: (percent: number) => void;
  handleProgressClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  resetPlayerState: (nextState?: PlayerState) => void;
  clearAudioElement: () => void;
  formatTime: (seconds: number) => string;
}

type PlayerStore = PlayerStateData & PlayerActions;

const audioRef = { current: null as HTMLAudioElement | null };
const progressRef = { current: null as HTMLDivElement | null };
const playheadRafRef = { current: null as number | null };
const waveformJobIdRef = { current: 0 };
export const fileDurationCache: Record<string, number> = {};

let audioLoadId = 0;

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  currentFile: null,
  isPlaying: false,
  isLoading: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  isMuted: false,

  selectFile: (name, path) => {
    const audio = audioRef.current;
    if (!audio) return { hideTagEditor: true };

    audioLoadId++;
    const myLoadId = audioLoadId;

    // 1. 停掉当前播放
    audio.pause();

    // 2. 处理 seek 意图
    const pct = seekOnLoadPct.current;
    seekOnLoadPct.current = null;

    // 3. 更新 store
    const currentPlayerState: PlayerState = {
      currentFile: get().currentFile,
      isPlaying: get().isPlaying,
      isLoading: get().isLoading,
      currentTime: get().currentTime,
      duration: get().duration,
      volume: get().volume,
      isMuted: get().isMuted,
    };
    const nextSelection = buildNextPlayerSelection(currentPlayerState, { name, path });
    set({
      currentFile: nextSelection.playerState.currentFile,
      isPlaying: nextSelection.playerState.isPlaying,
      isLoading: nextSelection.playerState.isLoading,
      currentTime: nextSelection.playerState.currentTime,
      duration: nextSelection.playerState.duration,
    });

    // 4. 设置音频源
    const ts = pct !== null ? `?t=${Date.now()}` : "";
    const srcPath = `local-audio:///${path.replaceAll("\\", "/")}${ts}`;
    audio.src = srcPath;

    if (pct !== null && isFinite(pct) && pct > 0 && pct < 1) {
      // ── 有 seek：先 load，再 play（用户手势上下文），loadedmetadata 后 seek ──
      const onMeta = () => {
        audio.removeEventListener("loadedmetadata", onMeta);
        if (audioLoadId !== myLoadId) return;

        let dur: number = audio.duration;
        if (!isFinite(dur) || dur <= 0) {
          dur = fileDurationCache[path] ?? 0;
        }
        const seekTime = pct * dur;
        if (isFinite(seekTime) && seekTime > 0 && seekTime < dur) {
          audio.currentTime = seekTime;
        }
        // 浏览器在播，seek 后自动从新位置继续
      };
      // 先注册再 load() → loadedmetadata 不会错过
      audio.addEventListener("loadedmetadata", onMeta);
      audio.load();
      // play() 在 load() 之后 —— 避免被 load() 中止
      audio.play().catch(() => {});
    } else {
      // ── 无 seek：load 后直接 play ──
      audio.load();
      audio.play().catch(() => {});
    }

    return nextSelection;
  },

  togglePlay: () => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextAction = buildPlaybackToggleResult(get().isPlaying);
    if (nextAction.shouldPause) { audio.pause(); return; }
    if (nextAction.shouldPlay) {
      if (!audio.src) return;
      audio.play().catch((err) => {
        // AbortError = 被新文件加载打断，正常行为，不记录
        if (err.name !== "AbortError") logError("播放失败", err);
      });
    }
  },

  toggleMute: () => {
    const prev = get();
    const nextState = setPlaybackMuted(
      { currentFile: prev.currentFile, isPlaying: prev.isPlaying, isLoading: prev.isLoading, currentTime: prev.currentTime, duration: prev.duration, volume: prev.volume, isMuted: prev.isMuted },
      !prev.isMuted
    );
    set({ isMuted: nextState.isMuted });
  },

  setVolume: (nextVolume) => {
    const prev = get();
    const nextState = setPlaybackVolume(
      { currentFile: prev.currentFile, isPlaying: prev.isPlaying, isLoading: prev.isLoading, currentTime: prev.currentTime, duration: prev.duration, volume: prev.volume, isMuted: prev.isMuted },
      nextVolume
    );
    set({ volume: nextState.volume });
  },

  seekToPercent: (percent) => {
    const audio = audioRef.current;
    const { duration } = get();
    if (!audio || !isFinite(duration) || duration <= 0 || !isFinite(percent)) return;
    const nextState = buildSeekState(duration, percent);
    audio.currentTime = nextState.currentTime;
    set({ currentTime: nextState.currentTime });
  },

  handleProgressClick: (e) => {
    const progressEl = progressRef.current;
    if (!progressEl) return;
    const rect = progressEl.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    get().seekToPercent(percent);
  },

  resetPlayerState: (nextState) => {
    const state = nextState ?? createInitialPlayerState();
    set({
      currentFile: state.currentFile, isPlaying: state.isPlaying, isLoading: state.isLoading,
      currentTime: state.currentTime, duration: state.duration, volume: state.volume, isMuted: state.isMuted,
    });
  },

  clearAudioElement: () => {
    const audio = audioRef.current;
    if (audio) { audio.pause(); audio.removeAttribute("src"); audio.load(); }
  },

  formatTime: (seconds) => {
    return isNaN(seconds)
      ? "00:00"
      : `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
  },
}));

export function usePlayerAudioEffect() {
  const volume = usePlayerStore((s) => s.volume);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const currentFile = usePlayerStore((s) => s.currentFile);

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
      setPlayerState: (updater) => {
        const prev = usePlayerStore.getState();
        const next = updater({
          currentFile: prev.currentFile, isPlaying: prev.isPlaying, isLoading: prev.isLoading,
          currentTime: prev.currentTime, duration: prev.duration, volume: prev.volume, isMuted: prev.isMuted,
        });
        usePlayerStore.setState({
          currentFile: next.currentFile, isPlaying: next.isPlaying, isLoading: next.isLoading,
          currentTime: next.currentTime, duration: next.duration, volume: next.volume, isMuted: next.isMuted,
        });
      },
      playheadRafRef,
      getFallbackDuration: () => {
        const path = usePlayerStore.getState().currentFile?.path;
        return path ? (fileDurationCache[path] ?? 0) : 0;
      },
    });
  }, []);

  useEffect(() => {
    if (!currentFile) return;
    usePlayerStore.setState({ isLoading: true });
    void loadPlayerWaveform({
      currentFilePath: currentFile.path,
      waveformJobIdRef,
      audioRef,
      setPlayerState: (updater) => {
        const prev = usePlayerStore.getState();
        const next = updater({
          currentFile: prev.currentFile, isPlaying: prev.isPlaying, isLoading: prev.isLoading,
          currentTime: prev.currentTime, duration: prev.duration, volume: prev.volume, isMuted: prev.isMuted,
        });
        usePlayerStore.setState({ isLoading: next.isLoading, currentTime: next.currentTime, duration: next.duration });
      },
      buildReadyState: buildWaveformReadyState,
      buildFailureState: buildWaveformErrorState,
      fileDurationCache,
    });
  }, [currentFile]);
}

export { audioRef, progressRef };
