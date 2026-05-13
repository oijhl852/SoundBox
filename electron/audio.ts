import { createHash } from "node:crypto";
import * as fsPromises from "node:fs/promises";
import path from "node:path";
import type { AudioSourceResponse } from "../src/lib/types.js";

export function guessAudioMime(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  return "audio/mpeg";
}

export async function getAudioSource(filePath: string): Promise<AudioSourceResponse> {
  return {
    path: `local-audio:///${filePath.replaceAll("\\", "/")}`,
    mime: guessAudioMime(filePath),
  };
}


export async function computeContentId(filePath: string): Promise<string> {
  const stats = await fsPromises.stat(filePath);
  const hash = createHash("sha256");

  // 使用采样哈希而非全文件读取，提升大文件性能
  // 采样策略：文件头 64KB + 文件尾 64KB + 文件大小 + 修改时间
  const sampleSize = 64 * 1024; // 64KB

  if (stats.size <= sampleSize * 2) {
    // 小文件直接全量读取
    const data = await fsPromises.readFile(filePath);
    hash.update(data);
  } else {
    // 大文件采样读取
    const headBuffer = await readSampleRange(filePath, 0, sampleSize);
    const tailOffset = stats.size - sampleSize;
    const tailBuffer = await readSampleRange(filePath, tailOffset, sampleSize);

    hash.update(headBuffer);
    hash.update(tailBuffer);
  }

  // 加入文件大小和修改时间，确保唯一性
  hash.update(`:${stats.size}:${Math.floor(stats.mtimeMs)}`);

  return `sha256:${hash.digest("hex").toUpperCase()}`;
}

async function readSampleRange(filePath: string, start: number, length: number): Promise<Buffer> {
  const buffer = Buffer.alloc(length);
  const fd = await fsPromises.open(filePath, "r");
  try {
    const { buffer: readBuffer } = await fd.read(buffer, 0, length, start);
    return readBuffer;
  } finally {
    await fd.close();
  }
}

export function toRelativePath(rootPath: string, absolutePath: string) {
  return path.relative(rootPath, absolutePath).replaceAll("\\", "/");
}
