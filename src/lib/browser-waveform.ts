/**
 * 浏览器端波形生成——复用浏览器内置音频解码器，零进程开销。
 * 用于用户点击文件的紧急预载路径，与 ffmpeg 子进程竞速。
 */
import { logError } from "./logger";

const SAMPLE_COUNT = 2048;

function computePeaks(channel: Float32Array, targetCount: number): number[] {
  const bucketSize = Math.max(1, Math.floor(channel.length / targetCount));
  const peaks = new Array<number>(targetCount).fill(0);

  for (let i = 0; i < targetCount; i++) {
    const start = i * bucketSize;
    const end = i === targetCount - 1 ? channel.length : Math.min(channel.length, start + bucketSize);
    let max = 0;
    for (let j = start; j < end; j++) {
      const v = Math.abs(channel[j] ?? 0);
      if (v > max) max = v;
    }
    peaks[i] = Math.min(1, max);
  }

  return peaks;
}

export async function browserWaveform(filePath: string): Promise<{ duration: number; peaks: number[] }> {
  const url = `local-audio:///${filePath.replaceAll("\\", "/")}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Browser waveform fetch failed: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength === 0) {
    throw new Error("Browser waveform: empty response");
  }

  const ctx = new AudioContext();
  try {
    const buffer = await ctx.decodeAudioData(arrayBuffer);
    const channel = buffer.getChannelData(0);
    return {
      duration: buffer.duration,
      peaks: computePeaks(channel, SAMPLE_COUNT),
    };
  } finally {
    await ctx.close().catch(() => {});
  }
}
