import { createWaveformJobGuard, resolveWaveformLoad } from "@/lib/app-effects";
import { getAudioSource, getWaveformPeaks } from "@/lib/api";
import type { PlayerState } from "@/lib/player-state";

export async function loadPlayerWaveform(options: {
  currentFilePath: string;
  waveformJobIdRef: { current: number };
  audioRef: { current: HTMLAudioElement | null };
  setPlayerState: React.Dispatch<React.SetStateAction<PlayerState>>;
  buildReadyState: (playerState: PlayerState, waveformDuration: number) => PlayerState;
  buildFailureState: (playerState: PlayerState) => PlayerState;
  fileDurationCache: Record<string, number>;
}) {
  const { currentFilePath, waveformJobIdRef, audioRef, setPlayerState, buildReadyState, buildFailureState, fileDurationCache } = options;
  const jobId = ++waveformJobIdRef.current;
  const isCurrentJob = createWaveformJobGuard(waveformJobIdRef);

  await resolveWaveformLoad({
    currentFilePath,
    getAudioSource,
    getWaveformPeaks,
    isCurrentJob,
    jobId,
    setAudioSource: async (_sourcePath: string) => {
      // selectFile 已经设置了 src 并开始播放
      // 这里什么都不做，只等 waveform 分析完成后 onReady
    },
    onReady: (waveformDuration: number) => {
      if (!isCurrentJob(jobId)) return;
      if (waveformDuration > 0) fileDurationCache[currentFilePath] = waveformDuration;
      setPlayerState((prev) => buildReadyState(prev, waveformDuration));
    },
    onError: () => {
      if (!isCurrentJob(jobId)) return;
      setPlayerState((prev) => buildFailureState(prev));
    },
  });
}
