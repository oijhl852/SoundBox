import { describe, expect, it, vi } from "vitest";

// ── mock api ──
vi.mock("@/lib/api", () => ({
  getWaveformPeaks: vi.fn(),
  getAudioMeta: vi.fn(),
}));
vi.mock("@/lib/browser-waveform", () => ({
  browserWaveform: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
}));
vi.mock("@/stores/playerStore", () => ({
  fileDurationCache: {},
}));

import { preloadSingleFile, useWaveformProgress } from "@/lib/use-mini-waveform-preload";
import type { FileMeta, MiniWaveformMap } from "@/lib/types";

describe("use-mini-waveform-preload", () => {
  // ────── preloadSingleFile ──────

  it("skips if waveform already loaded", async () => {
    const setMiniWaveforms = vi.fn();
    const miniWaveforms: MiniWaveformMap = { "D:/a.wav": [0.1, 0.2] };

    await preloadSingleFile("D:/a.wav", miniWaveforms, setMiniWaveforms);
    expect(setMiniWaveforms).not.toHaveBeenCalled();
  });

  it("loads waveform and updates store on ffmpeg success", async () => {
    const { getWaveformPeaks } = await import("@/lib/api");
    const { browserWaveform } = await import("@/lib/browser-waveform");

    // browserWaveform 先 reject，getWaveformPeaks 后 resolve
    vi.mocked(browserWaveform).mockRejectedValue(new Error("timeout"));
    vi.mocked(getWaveformPeaks).mockResolvedValue({ duration: 120, peaks: [0.5, 0.8] });

    const setMiniWaveforms = vi.fn((updater: Function | MiniWaveformMap) =>
      typeof updater === "function" ? updater({}) : updater
    );
    await preloadSingleFile("D:/song.wav", {}, setMiniWaveforms);

    expect(setMiniWaveforms).toHaveBeenCalled();
  });

  it("falls back to ffmpeg when browser waveform fails and race resolves to null", async () => {
    const { getWaveformPeaks } = await import("@/lib/api");
    const { browserWaveform } = await import("@/lib/browser-waveform");

    // browserWaveform 返回 null（.catch(() => null)），race 得到 null
    vi.mocked(browserWaveform).mockResolvedValue(null as any);
    vi.mocked(getWaveformPeaks).mockResolvedValue({ duration: 60, peaks: [0.3] });

    const setMiniWaveforms = vi.fn();
    await preloadSingleFile("D:/sfx.wav", {}, setMiniWaveforms);
    expect(setMiniWaveforms).toHaveBeenCalled();
  });

  // ────── useWaveformProgress ──────

  it("counts loaded / total files in a waveform map", () => {
    const allFiles: FileMeta[] = [
      { name: "A.wav", path: "A", folder: "fx", contentId: "cid-a" },
      { name: "B.wav", path: "B", folder: "fx", contentId: "cid-b" },
      { name: "C.wav", path: "C", folder: "fx", contentId: "cid-c" },
    ];
    const miniWaveforms: MiniWaveformMap = {
      A: [0.1, 0.2],
      B: [],
    };

    const { loaded, total } = useWaveformProgress(allFiles, miniWaveforms);
    expect(total).toBe(3);
    expect(loaded).toBe(1); // A 有峰值数据；B 是空数组；C 不在 map 中
  });
});
