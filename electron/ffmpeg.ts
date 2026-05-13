import type { WaveformResponse } from "../src/lib/types.js";
import { log } from "../src/lib/logger.js";
import {
  readWaveformCacheSafe,
  WAVEFORM_FALLBACK_ALGORITHM,
  writeWaveformCacheAtomic,
} from "./waveform-cache.js";
import {
  createFallbackWaveform,
  generateWaveformWithFfmpeg,
} from "./waveform-generator.js";

const inflightWaveformJobs = new Map<string, Promise<WaveformResponse>>();

type WaveformJobInput = {
  contentId: string;
  filePath: string;
};


function getOrCreateWaveformJob(
  getPath: (name: "appData") => string,
  { contentId, filePath }: WaveformJobInput
): Promise<WaveformResponse> {
  const existing = inflightWaveformJobs.get(contentId);
  if (existing) {
    console.log("[waveform] in-flight-hit", { filePath, contentId });
    return existing;
  }

  const job = Promise.resolve().then(async () => {
    try {
      log("info", "[waveform] generate-begin", { filePath, contentId });
      const waveform = await generateWaveformWithFfmpeg(filePath);
      log("info", "[waveform] generated", {

        filePath,
        peaks: waveform.peaks.length,
        duration: waveform.duration,
        min: Math.min(...waveform.peaks),
        max: Math.max(...waveform.peaks),
        first: waveform.peaks.slice(0, 12),
      });
      await writeWaveformCacheAtomic(getPath, contentId, waveform);
      log("info", "[waveform] generate-finish", { filePath, contentId });

      return waveform;
    } catch (error) {
      console.error("[waveform] generate-failed", { filePath, contentId, error });
      const fallbackWaveform = createFallbackWaveform();
      await writeWaveformCacheAtomic(getPath, contentId, fallbackWaveform, WAVEFORM_FALLBACK_ALGORITHM).catch((cacheError) => {
        log("warn", "[waveform] fallback-cache-write-failed", { filePath, contentId, cacheError });
      });

      return fallbackWaveform;
    } finally {

      inflightWaveformJobs.delete(contentId);
    }
  });

  inflightWaveformJobs.set(contentId, job);
  return job;
}

export async function getWaveformPeaks(
  getPath: (name: "appData") => string,
  computeContentId: (filePath: string) => Promise<string>,
  filePath: string
): Promise<WaveformResponse> {
  log("info", "[waveform] request-begin", { filePath });
  const contentId = await computeContentId(filePath);
  log("info", "[waveform] content-id-ready", { filePath, contentId });

  const cached = await readWaveformCacheSafe(getPath, contentId);
  log("info", "[waveform] request", { filePath, contentId, hasCached: Boolean(cached) });

  if (cached) {
    log("info", "[waveform] cache-hit", {

      filePath,
      peaks: cached.peaks.length,
      duration: cached.duration,
      min: Math.min(...cached.peaks),
      max: Math.max(...cached.peaks),
      first: cached.peaks.slice(0, 12),
    });
    return cached;
  }

  console.log("[waveform] cache-miss", { filePath, contentId });
  return getOrCreateWaveformJob(getPath, { contentId, filePath });
}
