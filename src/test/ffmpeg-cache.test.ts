import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const accessMock = vi.fn(async () => undefined);
const spawnMock = vi.fn(() => {
  throw new Error("spawn should not be called when cache is valid");
});

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return {
    ...actual,
    spawn: spawnMock,
  };
});


type FfmpegModule = typeof import("../../electron/ffmpeg.js");

describe("ffmpeg waveform cache", () => {
  let tempRoot: string;
  let appDataDir: string;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "soundbox-ffmpeg-cache-"));
    appDataDir = path.join(tempRoot, "appdata");
    accessMock.mockClear();
    spawnMock.mockClear();
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("returns cached waveform without spawning ffmpeg when cache is valid", async () => {
    const contentId = "cid:test-audio";
    const sanitized = contentId.replaceAll(":", "_");
    const cachePath = path.join(appDataDir, "Soundbox", "waveform-db", sanitized.slice(7, 9) || "00", `${sanitized}.json`);

    await fs.mkdir(path.dirname(cachePath), { recursive: true });
    await fs.writeFile(
      cachePath,
      JSON.stringify({
        version: 8,
        algorithm: "ffmpeg-f32le-peaks-v2",
        duration: 12.5,
        peaks: [0.2, 0.6, 0.4],
      }),
      "utf-8"
    );

    const module = (await import("../../electron/ffmpeg.js")) as FfmpegModule;
    const waveform = await module.getWaveformPeaks(
      (name) => {
        expect(name).toBe("appData");
        return appDataDir;
      },
      async () => contentId,
      path.join(tempRoot, "audio.wav")
    );

    expect(waveform).toEqual({ duration: 12.5, peaks: [0.2, 0.6, 0.4] });
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("deletes invalid cache file and regenerates waveform cache", async () => {
    const contentId = "cid:broken-audio";
    const sanitized = contentId.replaceAll(":", "_");
    const cachePath = path.join(appDataDir, "Soundbox", "waveform-db", sanitized.slice(7, 9) || "00", `${sanitized}.json`);
    await fs.mkdir(path.dirname(cachePath), { recursive: true });
    await fs.writeFile(cachePath, "{invalid json", "utf-8");

    const audioPath = path.join(tempRoot, "audio.wav");
    await fs.writeFile(audioPath, "seed-audio");

    const fakePcm = Buffer.alloc(16);

    const listeners: Record<string, ((arg?: unknown) => void)[]> = {};
    spawnMock.mockImplementation(() => ({
      stdout: { on: (event: string, handler: (chunk: Buffer) => void) => { listeners[`stdout:${event}`] = [...(listeners[`stdout:${event}`] ?? []), handler]; } },
      stderr: { on: (event: string, handler: (chunk: Buffer) => void) => { listeners[`stderr:${event}`] = [...(listeners[`stderr:${event}`] ?? []), handler]; } },
      on: (event: string, handler: (arg?: unknown) => void) => {
        listeners[event] = [...(listeners[event] ?? []), handler];
        if (event === "close") {
          queueMicrotask(() => {
            for (const stdoutHandler of listeners["stdout:data"] ?? []) {
              stdoutHandler(fakePcm);
            }
            handler(0);
          });
        }
      },
    }));

    const accessSpy = vi.spyOn(fs, "access").mockImplementation(accessMock);

    const module = (await import("../../electron/ffmpeg.js")) as FfmpegModule;
    const waveform = await module.getWaveformPeaks(
      () => appDataDir,
      async () => contentId,
      audioPath
    );

    expect(waveform.peaks.length).toBeGreaterThan(0);
    await expect(fs.readFile(cachePath, "utf-8")).resolves.toContain("fallback-sine-v1");
    accessSpy.mockRestore();



  });
});
