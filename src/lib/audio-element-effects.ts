import type { PlayerState } from "@/lib/player-state";
import { buildEndedPlayerState, buildWaveformErrorState, buildWaveformReadyState } from "@/lib/player-controller-state";
import { setPlaybackActive, setPlaybackTime } from "@/lib/player-state";

// 模块级：波形点击时写入，loadeddata 时消费（loadedmetadata 只取 duration，不 seek）
export const seekOnLoadPct = { current: null as number | null };

export function createAudioElementBindings(options: {
  audio: HTMLAudioElement;
  requestAnimationFrameImpl: typeof requestAnimationFrame;
  cancelAnimationFrameImpl: typeof cancelAnimationFrame;
  setPlayerState: (updater: (prev: PlayerState) => PlayerState) => void;
  playheadRafRef: { current: number | null };
  /** 浏览器 duration 为 Infinity/NaN 时的 fallback（来自预载器已缓存的值） */
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

  const onLoadedMetadata = () => {
    // VBR MP3 / 部分格式下浏览器可能返回 Infinity，用预载器缓存的 duration 兜底
    const browserDur = audio.duration;
    let dur = browserDur;
    if (!isFinite(dur) || dur <= 0) {
      const fallback = getFallbackDuration?.() ?? 0;
      if (fallback > 0) dur = fallback;
    }
    setPlayerState((prev) => buildWaveformReadyState(prev, dur));
    if (seekOnLoadPct.current !== null) {
      console.log("[audio] seek-pending", {
        file: audio.src, browserDur, resolvedDur: dur, pct: seekOnLoadPct.current,
      });
    }
    // 这里不 seek——loadedmetadata 时数据还没加载，currentTime 会被忽略
    // seek 在 loadeddata / canplay 中执行
  };

  const trySeek = () => {
    const pct = seekOnLoadPct.current;
    if (pct === null) return false;

    let dur = audio.duration;
    if (!isFinite(dur) || dur <= 0) {
      const fallback = getFallbackDuration?.() ?? 0;
      if (fallback > 0) dur = fallback;
    }
    if (!isFinite(dur) || dur <= 0) {
      console.warn("[audio] seek-no-duration", { file: audio.src, browserDur: audio.duration, fallback: getFallbackDuration?.() });
      return false;
    }

    seekOnLoadPct.current = null;
    const seekTime = pct * dur;
    if (!isFinite(seekTime) || seekTime >= dur) return false;

    audio.currentTime = seekTime;
    audio.play().catch(() => {});
    console.log("[audio] seek-ok", { file: audio.src, seekTime, dur, pct });
    return true;
  };

  const onLoadedData = () => {
    if (seekOnLoadPct.current === null) return;
    if (!trySeek()) {
      // loadeddata 时 duration 仍无效，不消耗 seekOnLoadPct，留给 canplay 再试
      console.log("[audio] seek-deferred-to-canplay", { file: audio.src, dur: audio.duration });
    }
  };

  const onCanPlay = () => {
    if (seekOnLoadPct.current === null) return;
    if (!trySeek()) {
      // canplay 也不行，放弃定位，从头播
      seekOnLoadPct.current = null;
      console.warn("[audio] seek-failed-playing-from-0", { file: audio.src, dur: audio.duration });
      audio.play().catch(() => {});
    }
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
    setPlayerState((prev) => buildEndedPlayerState(prev));
    stopRaf();
  };
  const onError = () => {
    setPlayerState((prev) => buildWaveformErrorState(prev));
    stopRaf();
  };

  audio.addEventListener("loadedmetadata", onLoadedMetadata);
  audio.addEventListener("loadeddata", onLoadedData);
  audio.addEventListener("canplay", onCanPlay);
  audio.addEventListener("timeupdate", onTimeUpdate);
  audio.addEventListener("play", onPlay);
  audio.addEventListener("pause", onPause);
  audio.addEventListener("ended", onEnded);
  audio.addEventListener("error", onError);

  return () => {
    stopRaf();
    audio.removeEventListener("loadedmetadata", onLoadedMetadata);
    audio.removeEventListener("loadeddata", onLoadedData);
    audio.removeEventListener("canplay", onCanPlay);
    audio.removeEventListener("timeupdate", onTimeUpdate);
    audio.removeEventListener("play", onPlay);
    audio.removeEventListener("pause", onPause);
    audio.removeEventListener("ended", onEnded);
    audio.removeEventListener("error", onError);
  };
}
