import { describe, expect, it, vi } from "vitest";

// ── mock api ──
const mockGetWaveformPeaks = vi.fn();
vi.mock("@/lib/api", () => ({
  getWaveformPeaks: (...args: unknown[]) => mockGetWaveformPeaks(...args),
}));

// ── mock app-effects.resolveWaveformLoad (注入式测试) ──
let resolveWaveformLoadImpl: Function;
vi.mock("@/lib/app-effects", () => ({
  resolveWaveformLoad: (opts: Record<string, unknown>) => resolveWaveformLoadImpl(opts),
  createWaveformJobGuard: (ref: { current: number }) => (jobId: number) => jobId === ref.current,
}));

import { loadPlayerWaveform } from "@/lib/player-domain-effects";
import {
  buildWaveformReadyState,
  buildWaveformErrorState,
} from "@/lib/player-controller-state";

describe("player-domain-effects", () => {
  it("calls getWaveformPeaks and updates state on success", async () => {
    const setPlayerState = vi.fn();
    const cache: Record<string, number> = {};

    resolveWaveformLoadImpl = async (opts: any) => {
      // 模拟 resolveWaveformLoad 调用 getWaveformPeaks 并回调 onReady
      const { getWaveformPeaks, isCurrentJob, jobId, onReady } = opts;
      const waveform = await getWaveformPeaks(opts.currentFilePath);
      if (isCurrentJob(jobId)) onReady(waveform.duration);
    };

    mockGetWaveformPeaks.mockResolvedValue({ duration: 180.5, peaks: [0.1, 0.2] });

    await loadPlayerWaveform({
      currentFilePath: "D:/test.wav",
      waveformJobIdRef: { current: 0 },
      audioRef: { current: null },
      setPlayerState,
      buildReadyState: buildWaveformReadyState,
      buildFailureState: buildWaveformErrorState,
      fileDurationCache: cache,
    });

    expect(mockGetWaveformPeaks).toHaveBeenCalledWith("D:/test.wav");
    expect(cache["D:/test.wav"]).toBe(180.5);
    expect(setPlayerState).toHaveBeenCalled();
  });

  it("sets error state when waveform load fails", async () => {
    const setPlayerState = vi.fn();

    resolveWaveformLoadImpl = async (opts: any) => {
      const { isCurrentJob, jobId, onError } = opts;
      if (isCurrentJob(jobId)) onError();
    };

    mockGetWaveformPeaks.mockRejectedValue(new Error("ffmpeg crash"));

    await loadPlayerWaveform({
      currentFilePath: "D:/bad.wav",
      waveformJobIdRef: { current: 0 },
      audioRef: { current: null },
      setPlayerState,
      buildReadyState: buildWaveformReadyState,
      buildFailureState: buildWaveformErrorState,
      fileDurationCache: {},
    });

    expect(setPlayerState).toHaveBeenCalled();
  });

  it("skips update when job is no longer current", async () => {
    const setPlayerState = vi.fn();

    resolveWaveformLoadImpl = async (opts: any) => {
      // 不调用任何 callback——模拟 job 已过期
    };

    await loadPlayerWaveform({
      currentFilePath: "D:/stale.wav",
      waveformJobIdRef: { current: 0 },
      audioRef: { current: null },
      setPlayerState,
      buildReadyState: buildWaveformReadyState,
      buildFailureState: buildWaveformErrorState,
      fileDurationCache: {},
    });

    expect(setPlayerState).not.toHaveBeenCalled();
  });
});
