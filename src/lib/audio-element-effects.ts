import type { PlayerState } from "@/lib/player-state";
import { buildEndedPlayerState, buildWaveformErrorState, buildWaveformReadyState } from "@/lib/player-controller-state";
import { setPlaybackActive, setPlaybackTime } from "@/lib/player-state";

export function createAudioElementBindings(options: {
  audio: HTMLAudioElement;
  requestAnimationFrameImpl: typeof requestAnimationFrame;
  cancelAnimationFrameImpl: typeof cancelAnimationFrame;
  setPlayerState: (updater: (prev: PlayerState) => PlayerState) => void;
  playheadRafRef: { current: number | null };
}) {
  const { audio, requestAnimationFrameImpl, cancelAnimationFrameImpl, setPlayerState, playheadRafRef } = options;

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
    setPlayerState((prev) => buildWaveformReadyState(prev, audio.duration));
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
