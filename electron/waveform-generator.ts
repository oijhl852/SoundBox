import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type { WaveformResponse } from "../src/lib/types.js";
import { log } from "../src/lib/logger.js";

const FFMPEG_SAMPLE_RATE = 16000;
const PROJECT_FFMPEG_PATH = path.resolve(import.meta.dirname, "../../ffmpeg-8.1-essentials_build/bin/ffmpeg.exe");
const FFMPEG_PROBE_PATH = path.resolve(import.meta.dirname, "../../ffmpeg-8.1-essentials_build/bin/ffprobe.exe");
let ffmpegPathPromise: Promise<string> | null = null;
let ffprobePathPromise: Promise<string> | null = null;


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

async function resolveFfprobePath() {
  if (!ffprobePathPromise) {
    ffprobePathPromise = (async () => {
      log("info", "[ffprobe] resolving path", FFMPEG_PROBE_PATH);
      await fs.access(FFMPEG_PROBE_PATH);
      log("info", "[ffprobe] path-ok", FFMPEG_PROBE_PATH);
      return FFMPEG_PROBE_PATH;
    })();
  }
  return ffprobePathPromise;
}

export async function inspectAudioFile(filePath: string) {
  const ffprobePath = await resolveFfprobePath();
  return new Promise<{ codecName: string | null; duration: number | null }>((resolve, reject) => {
    const args = [
      "-v",
      "error",
      "-show_entries",
      "stream=codec_name:format=duration",
      "-of",
      "json",
      filePath,
    ];
    const child = spawn(ffprobePath, args, { windowsHide: true });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(Buffer.concat(stderrChunks).toString("utf8") || `ffprobe exited with code ${code}`));
        return;
      }

      const payload = JSON.parse(Buffer.concat(stdoutChunks).toString("utf8")) as {
        streams?: Array<{ codec_name?: string }>;
        format?: { duration?: string };
      };
      resolve({
        codecName: payload.streams?.[0]?.codec_name ?? null,
        duration: payload.format?.duration ? Number(payload.format.duration) : null,
      });
    });
  });
}

export async function generateWaveformWithFfmpeg(filePath: string, sampleCount = 2048): Promise<WaveformResponse> {
  const ffmpegPath = await resolveFfmpegPath();
  const stats = await fs.stat(filePath);
  const probe = await inspectAudioFile(filePath).catch((error) => {
    log("warn", "[ffprobe] inspect-failed", { filePath, error });
    return { codecName: null, duration: null };
  });

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

    log("info", "[ffmpeg] spawn", { filePath, ffmpegPath, probe });

    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
    child.on("error", (error) => {
      log("error", "[ffmpeg] spawn-error", { filePath, probe, error });
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
