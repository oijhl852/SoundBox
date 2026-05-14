import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { parseFile } from "music-metadata";
import type { WaveformResponse } from "../src/lib/types.js";
import { log } from "../src/lib/logger.js";

const FFMPEG_SAMPLE_RATE = 16000;
const PROJECT_FFMPEG_PATH = path.resolve(import.meta.dirname, "../../ffmpeg-8.1-essentials_build/bin/ffmpeg.exe");
let ffmpegPathPromise: Promise<string> | null = null;

export async function resolveFfmpegPath() {
  if (!ffmpegPathPromise) {
    ffmpegPathPromise = (async () => {
      log("info", "[ffmpeg] resolving path", PROJECT_FFMPEG_PATH);
      await fs.access(PROJECT_FFMPEG_PATH);
      log("info", "[ffmpeg] path-ok", PROJECT_FFMPEG_PATH);
      return PROJECT_FFMPEG_PATH;
    })();
  }
  return ffmpegPathPromise;
}

/**
 * 读取音频文件元信息（纯 Node.js，不启动子进程）。
 * 替代 ffprobe 子进程，消除进程启动开销。
 */
export async function inspectAudioFile(filePath: string) {
  try {
    const meta = await parseFile(filePath, { duration: true });
    return {
      codecName: meta.format.codec ?? null,
      duration: meta.format.duration ?? null,
    };
  } catch {
    return { codecName: null, duration: null };
  }
}

export async function generateWaveformWithFfmpeg(filePath: string, sampleCount = 2048): Promise<WaveformResponse> {
  const ffmpegPath = await resolveFfmpegPath();
  const stats = await fs.stat(filePath);

  const args = [
    "-v",
    "error",
    "-i",
    filePath,
    "-ac",
    "1",
    "-ar",
    String(FFMPEG_SAMPLE_RATE),
    "-f",
    "f32le",
    "-acodec",
    "pcm_f32le",
    "pipe:1",
  ];

  const pcmBuffer = await new Promise<Buffer>((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { windowsHide: true });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    log("info", "[ffmpeg] spawn", { filePath, ffmpegPath });

    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
    child.on("error", (error) => {
      log("error", "[ffmpeg] spawn-error", { filePath, error });
      reject(error);
    });
    child.on("close", (code) => {

      log("info", "[ffmpeg] close", {
        filePath,
        code,
        stdoutBytes: stdoutChunks.reduce((sum, chunk) => sum + chunk.length, 0),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
      });
      if (code === 0) {
        resolve(Buffer.concat(stdoutChunks));
        return;
      }
      reject(new Error(Buffer.concat(stderrChunks).toString("utf8") || `ffmpeg exited with code ${code}`));
    });
  });

  const sampleTotal = Math.floor(pcmBuffer.length / 4);
  log("info", "[waveform] ffmpeg-output", { filePath, pcmBytes: pcmBuffer.length, sampleTotal });
  if (sampleTotal <= 0) {
    return {
      duration: 0,
      peaks: Array(sampleCount).fill(0),
    };
  }

  const samples = new Float32Array(pcmBuffer.buffer, pcmBuffer.byteOffset, sampleTotal);
  const duration = sampleTotal / FFMPEG_SAMPLE_RATE || Math.max(0, stats.size / 16000);
  const bucketSize = Math.max(1, Math.floor(sampleTotal / sampleCount));
  const peaks = new Array<number>(sampleCount).fill(0);

  for (let bucketIndex = 0; bucketIndex < sampleCount; bucketIndex++) {
    const start = bucketIndex * bucketSize;
    const end = bucketIndex === sampleCount - 1 ? sampleTotal : Math.min(sampleTotal, start + bucketSize);
    let maxPeak = 0;

    for (let sampleIndex = start; sampleIndex < end; sampleIndex++) {
      const value = Math.abs(samples[sampleIndex] ?? 0);
      if (value > maxPeak) maxPeak = value;
    }

    peaks[bucketIndex] = Math.min(1, maxPeak);
  }

  return { duration, peaks };
}

export function createFallbackWaveform(): WaveformResponse {
  return {
    duration: 0,
    peaks: Array.from({ length: 1024 }, (_, index) => {
      const position = index / 1023;
      return Math.max(0.04, Math.sin(position * Math.PI) * 0.22);
    }),
  };
}
