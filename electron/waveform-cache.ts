import fs from "node:fs/promises";
import path from "node:path";
import type { WaveformResponse } from "../src/lib/types.js";
import { log } from "../src/lib/logger.js";

export const WAVEFORM_CACHE_VERSION = 8;
export const WAVEFORM_CACHE_ALGORITHM = "ffmpeg-f32le-peaks-v2";
export const WAVEFORM_FALLBACK_ALGORITHM = "fallback-sine-v1";
const MAX_CACHE_SIZE_MB = 500;
const MAX_CACHE_FILES = 10000;

type WaveformCacheFile = WaveformResponse & { version: number; algorithm: string };

function getAppDataDir(getPath: (name: "appData") => string) {
  return path.join(getPath("appData"), "Soundbox");
}

function getWaveformDbDir(getPath: (name: "appData") => string) {
  return path.join(getAppDataDir(getPath), "waveform-db");
}

export function getWaveformCachePath(getPath: (name: "appData") => string, contentId: string) {
  const sanitized = contentId.replaceAll(":", "_");
  const bucket = sanitized.slice(7, 9) || "00";
  return path.join(getWaveformDbDir(getPath), bucket, `${sanitized}.json`);
}

async function ensureWaveformDbDir(getPath: (name: "appData") => string, contentId: string) {
  await fs.mkdir(path.dirname(getWaveformCachePath(getPath, contentId)), { recursive: true });
}

export async function readWaveformCacheSafe(
  getPath: (name: "appData") => string,
  contentId: string
): Promise<WaveformResponse | null> {
  const fallback: WaveformCacheFile = {
    version: WAVEFORM_CACHE_VERSION,
    algorithm: WAVEFORM_CACHE_ALGORITHM,
    duration: 0,
    peaks: [],
  };
  const cachePath = getWaveformCachePath(getPath, contentId);

  try {
    const raw = await fs.readFile(cachePath, "utf-8");
    const trimmed = raw.trim();
    if (!trimmed) {
      throw new SyntaxError("Waveform cache is empty");
    }

    const result = { ...fallback, ...(JSON.parse(trimmed) as Partial<WaveformCacheFile>) } as WaveformCacheFile;
    const peaks = Array.isArray(result.peaks)
      ? result.peaks.filter((value: unknown): value is number => typeof value === "number" && Number.isFinite(value))
      : [];

    if (result.algorithm === WAVEFORM_FALLBACK_ALGORITHM) {
      console.log("[waveform-cache] SKIP (fallback algo)", { contentId: contentId.slice(0, 20), cachePath });
      return null;
    }

    if (result.version !== WAVEFORM_CACHE_VERSION || result.algorithm !== WAVEFORM_CACHE_ALGORITHM) {
      console.log("[waveform-cache] STALE", { contentId: contentId.slice(0, 20), fileVer: result.version, expectVer: WAVEFORM_CACHE_VERSION });
      return null;
    }

    if (peaks.length === 0) {
      console.log("[waveform-cache] EMPTY", { contentId: contentId.slice(0, 20) });
      return null;
    }

    console.log("[waveform-cache] HIT", { contentId: contentId.slice(0, 20), peaks: peaks.length, dur: result.duration.toFixed(1) });
    return {
      duration: typeof result.duration === "number" && Number.isFinite(result.duration) ? result.duration : 0,
      peaks,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    if (errMsg.includes("ENOENT") || errMsg.includes("no such file")) {
      console.log("[waveform-cache] MISS (no file)", { contentId: contentId.slice(0, 20) });
    } else {
      console.warn("[waveform-cache] INVALID, deleting", { contentId: contentId.slice(0, 20), cachePath, error: errMsg });
    }
    await fs.rm(cachePath, { force: true }).catch(() => undefined);
    await fs.rm(`${cachePath}.tmp`, { force: true }).catch(() => undefined);
    return null;
  }
}

export async function writeWaveformCacheAtomic(
  getPath: (name: "appData") => string,
  contentId: string,
  waveform: WaveformResponse,
  algorithm = WAVEFORM_CACHE_ALGORITHM
) {
  await ensureWaveformDbDir(getPath, contentId);
  const payload: WaveformCacheFile = {
    version: WAVEFORM_CACHE_VERSION,
    algorithm,
    ...waveform,
  };
  const targetPath = getWaveformCachePath(getPath, contentId);
  const tempPath = `${targetPath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(payload, null, 2), "utf-8");
  await fs.rename(tempPath, targetPath);
  console.log("[waveform-cache] WRITE", { contentId: contentId.slice(0, 20), peaks: waveform.peaks.length, dur: waveform.duration.toFixed(1), targetPath });

  await cleanupWaveformCache(getPath).catch((err) => {
    log("warn", "[waveform] cache-cleanup-failed", err);
  });
}

export async function cleanupWaveformCache(getPath: (name: "appData") => string) {
  const cacheDir = getWaveformDbDir(getPath);

  try {
    try {
      await fs.access(cacheDir);
    } catch {
      return;
    }

    const cacheFiles: Array<{ path: string; mtime: number; size: number }> = [];
    let totalSize = 0;

    async function scanDir(dirPath: string) {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } else if (entry.name.endsWith(".json")) {
          const stats = await fs.stat(fullPath);
          cacheFiles.push({
            path: fullPath,
            mtime: stats.mtimeMs,
            size: stats.size,
          });
          totalSize += stats.size;
        }
      }
    }

    await scanDir(cacheDir);

    const totalSizeMB = totalSize / (1024 * 1024);
    log("info", "[waveform] cache-stats", {
      totalFiles: cacheFiles.length,
      totalSizeMB: totalSizeMB.toFixed(2),
    });

    const needsCleanup = totalSizeMB > MAX_CACHE_SIZE_MB || cacheFiles.length > MAX_CACHE_FILES;
    if (!needsCleanup) {
      return;
    }

    log("info", "[waveform] cache-cleanup-start", {
      reason: totalSizeMB > MAX_CACHE_SIZE_MB ? "size-exceeded" : "file-count-exceeded",
      currentSizeMB: totalSizeMB.toFixed(2),
      currentFiles: cacheFiles.length,
    });

    cacheFiles.sort((a, b) => a.mtime - b.mtime);

    let deletedCount = 0;
    let deletedSize = 0;

    for (const file of cacheFiles) {
      if (totalSizeMB <= MAX_CACHE_SIZE_MB && cacheFiles.length - deletedCount <= MAX_CACHE_FILES) {
        break;
      }

      try {
        await fs.rm(file.path, { force: true });
        deletedCount++;
        deletedSize += file.size;
      } catch (err) {
        log("warn", "[waveform] cache-cleanup-delete-failed", { path: file.path, err });
      }
    }

    log("info", "[waveform] cache-cleanup-complete", {
      deletedFiles: deletedCount,
      deletedSizeMB: (deletedSize / (1024 * 1024)).toFixed(2),
      remainingFiles: cacheFiles.length - deletedCount,
    });
  } catch (error) {
    log("error", "[waveform] cache-cleanup-error", error);
    throw error;
  }
}
