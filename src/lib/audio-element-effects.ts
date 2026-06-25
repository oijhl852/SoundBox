import type { PlayerState } from "@/lib/player-state";
import { buildEndedPlayerState, buildWaveformErrorState, buildWaveformReadyState } from "@/lib/player-controller-state";
import { setPlaybackActive, setPlaybackTime } from "@/lib/player-state";

/**
 * 波形点击定位标记。
 *
 * 架构说明：当前采用模块级 ref（而非 React useRef），理由：
 * ─ 应用为单播放器单窗口架构，不存在多实例竞争。
 * ─ 它由 FileListPanel（波形点击）写入、playerStore.selectFile（音频加载后）消费，
 *   两者需要跨组件共享同一引用，模块级 ref 是最轻量的方式。
 *
 * ⚠ 若未来引入多窗口 / 多播放器面板，请将此处重构为组件实例内 useRef 或放入 playerStore。
 */
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
