import type { PlayerState } from "@/lib/player-state";
import { buildEndedPlayerState, buildWaveformErrorState, buildWaveformReadyState } from "@/lib/player-controller-state";
import { setPlaybackActive, setPlaybackTime } from "@/lib/player-state";

// 仅由 FileListPanel 写入、playerStore.selectFile 消费
export const seekOnLoadPct = { current: null as number | null };

export function createAudioElementBindings(options: {
  audio: HTMLAudioElement;
  requestAnimationFrameImpl: typeof requestAnimationFrame;
  cancelAnimationFrameImpl: typeof cancelAnimationFrame;
  setPlayerState: (updater: (prev: PlayerState) => PlayerState) => void;
  playheadRafRef: { current: number | null };
  getFallbackDuration?: () => number;
}) {
  const { audio, requestAnimationFrameImpl, cancelAnimationFrameImpl, setPlayerState, playheadRafRef, getFallbackDuration } = options;

  const tick = () => {
    setPlayerState((prev) => setPlaybackTime(prev, audio.currentTime));
    if (!audio.paused && !audio.ended) {
      playheadRafRef.current = requestAnimationFrameImpl(tick);
    }
  };

  const stopRaf = () => {
    if (playheadRafRef.current !== null) {
      cancelAnimationFrameImpl(playheadRafRef.current);
      playheadRafRef.current = null;
    }
  };

  // 只做 event → state 映射，不参与 seek / play 决策
  const onLoadedMetadata = () => {
    let dur = audio.duration;
    if (!isFinite(dur) || dur <= 0) {
      const fallback = getFallbackDuration?.() ?? 0;
      if (fallback > 0) dur = fallback;
    }
    setPlayerState((prev) => buildWaveformReadyState(prev, dur));
  };

  const onTimeUpdate = () => setPlayerState((prev) => setPlaybackTime(prev, audio.currentTime));
  const onPlay = () => {
    setPlayerState((prev) => setPlaybackActive(prev, true));
    stopRaf();
    playheadRafRef.current = requestAnimationFrameImpl(tick);
  };
  const onPause = () => {
    setPlayerState((prev) => setPlaybackActive(prev, false));
    stopRaf();
  };
  const onEnded = () => {
    seekOnLoadPct.current = null;
    setPlayerState((prev) => buildEndedPlayerState(prev));
    stopRaf();
  };
  const onError = () => {
    seekOnLoadPct.current = null;
    setPlayerState((prev) => buildWaveformErrorState(prev));
    stopRaf();
  };

  audio.addEventListener("loadedmetadata", onLoadedMetadata);
  audio.addEventListener("timeupdate", onTimeUpdate);
  audio.addEventListener("play", onPlay);
  audio.addEventListener("pause", onPause);
  audio.addEventListener("ended", onEnded);
  audio.addEventListener("error", onError);

  return () => {
    stopRaf();
    audio.removeEventListener("loadedmetadata", onLoadedMetadata);
    audio.removeEventListener("timeupdate", onTimeUpdate);
    audio.removeEventListener("play", onPlay);
    audio.removeEventListener("pause", onPause);
    audio.removeEventListener("ended", onEnded);
    audio.removeEventListener("error", onError);
  };
}
