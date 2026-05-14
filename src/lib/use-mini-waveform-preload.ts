import { useEffect, useRef } from "react";
import { getWaveformPeaks, getAudioMeta } from "./api";
import { getMissingMiniWaveformFiles } from "./app-shell-actions";
import { logError } from "./logger";
import { mergeMiniWaveforms } from "./app-effects";
import { fileDurationCache } from "@/stores/playerStore";
import type { FileMeta, MiniWaveformMap } from "./types";

// ── 模块级计数器 ──
let urgentJobId = 0;
const miniWaveformJobIdRef = { current: 0 };

async function loadMetaForBatch(files: FileMeta[]) {
  await Promise.all(
    files.map(async (file) => {
      if (fileDurationCache[file.path] !== undefined) return;
      try {
        const meta = await getAudioMeta(file.path);
        if (meta.duration > 0) fileDurationCache[file.path] = meta.duration;
      } catch {
        // 静默失败，波形分析时也会顺便拿到 duration
      }
    })
  );
}

async function loadWaveformBatch(
  files: FileMeta[],
  jobId: number,
  setMiniWaveforms: (updater: MiniWaveformMap | ((prev: MiniWaveformMap) => MiniWaveformMap)) => void
) {
  // 不在这里调 loadMetaForBatch——波形分析内部也会跑 ffprobe，避免重复
  const results = await Promise.all(
    files.map(async (file) => {
      try {
        const waveform = await getWaveformPeaks(file.path);
        if (waveform.duration > 0) fileDurationCache[file.path] = waveform.duration;
        return [file.path, waveform.peaks] as const;
      } catch (error) {
        logError("Mini waveform load failed:", { path: file.path, error });
        return null;
      }
    })
  );

  if (jobId !== miniWaveformJobIdRef.current) return;
  if (jobId < urgentJobId) return;
  const entries = results.filter((result): result is readonly [string, number[]] => Boolean(result));
  if (entries.length === 0) return;
  setMiniWaveforms((prev) => mergeMiniWaveforms(prev, entries));
}

// ── 紧急预载 ──
export async function preloadSingleFile(
  filePath: string,
  miniWaveforms: MiniWaveformMap,
  setMiniWaveforms: (updater: MiniWaveformMap | ((prev: MiniWaveformMap) => MiniWaveformMap)) => void
) {
  if (miniWaveforms[filePath]?.length) return;
  urgentJobId++;

  // 紧急情况下先确保 duration 就绪
  if (fileDurationCache[filePath] === undefined) {
    try {
      const meta = await getAudioMeta(filePath);
      if (meta.duration > 0) fileDurationCache[filePath] = meta.duration;
    } catch {}
  }

  try {
    const waveform = await getWaveformPeaks(filePath);
    if (waveform.duration > 0) fileDurationCache[filePath] = waveform.duration;
    setMiniWaveforms((prev) => {
      if (prev[filePath]?.length) return prev;
      return { ...prev, [filePath]: waveform.peaks };
    });
  } catch (error) {
    logError("Urgent waveform load failed:", { path: filePath, error });
  }
}

// ── 预载进度 ──
export function useWaveformProgress(
  allFiles: FileMeta[],
  miniWaveforms: MiniWaveformMap
): { loaded: number; total: number } {
  const loaded = allFiles.filter((f) => miniWaveforms[f.path]?.length).length;
  return { loaded, total: allFiles.length };
}

// ── Level 3：整库后台预载 ──
export function useBackgroundWaveformPreload(options: {
  allFiles: FileMeta[];
  miniWaveforms: MiniWaveformMap;
  setMiniWaveforms: (updater: MiniWaveformMap | ((prev: MiniWaveformMap) => MiniWaveformMap)) => void;
  batchSize?: number;
  delayMs?: number;
}) {
  const { allFiles, miniWaveforms, setMiniWaveforms, batchSize = 20, delayMs = 500 } = options;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const missing = allFiles.filter((f) => !miniWaveforms[f.path]?.length);
    if (missing.length === 0) return;

    // 先扫一批元数据，让 duration 尽快就绪
    const metaBatch = missing.slice(0, batchSize * 3);
    void loadMetaForBatch(metaBatch);

    const batch = missing.slice(0, batchSize);
    timerRef.current = setTimeout(() => {
      void loadWaveformBatch(batch, miniWaveformJobIdRef.current, setMiniWaveforms);
    }, delayMs);

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allFiles, miniWaveforms]);
}

// ── Level 1 + Level 2：当前文件夹预载 ──
export function useMiniWaveformPreload(options: {
  filteredFiles: FileMeta[];
  miniWaveforms: MiniWaveformMap;
  setMiniWaveforms: (updater: MiniWaveformMap | ((prev: MiniWaveformMap) => MiniWaveformMap)) => void;
  visibleCount?: number;
}) {
  const { filteredFiles, miniWaveforms, setMiniWaveforms, visibleCount = 15 } = options;
  const deferredTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (filteredFiles.length === 0) return;

    const missingFiles = getMissingMiniWaveformFiles(filteredFiles, miniWaveforms, filteredFiles.length);
    if (missingFiles.length === 0) return;

    if (deferredTimerRef.current !== null) {
      clearTimeout(deferredTimerRef.current);
      deferredTimerRef.current = null;
    }

    const jobId = ++miniWaveformJobIdRef.current;

    // Level 1：可见文件——先扫元数据（duration），再跑波形
    const visibleFiles = missingFiles.slice(0, visibleCount);
    if (visibleFiles.length > 0) {
      void loadMetaForBatch(visibleFiles);
      loadWaveformBatch(visibleFiles, jobId, setMiniWaveforms);
    }

    // Level 2：后台文件——延迟后再来
    const deferredFiles = missingFiles.slice(visibleCount);
    if (deferredFiles.length > 0) {
      deferredTimerRef.current = setTimeout(() => {
        if (jobId !== miniWaveformJobIdRef.current) return;
        void loadMetaForBatch(deferredFiles);
        loadWaveformBatch(deferredFiles, jobId, setMiniWaveforms);
      }, 100);
    }

    return () => {
      if (deferredTimerRef.current !== null) {
        clearTimeout(deferredTimerRef.current);
        deferredTimerRef.current = null;
      }
    };
  }, [filteredFiles, miniWaveforms, setMiniWaveforms, visibleCount]);
}
