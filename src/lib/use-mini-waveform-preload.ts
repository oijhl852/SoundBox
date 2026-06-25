import { useEffect, useRef } from "react";
import { getWaveformPeaks, getAudioMeta } from "./api";
import { getMissingMiniWaveformFiles } from "./app-shell-actions";
import { logError } from "./logger";
import { mergeMiniWaveforms } from "./app-effects";
import { fileDurationCache } from "@/stores/playerStore";
import { browserWaveform } from "./browser-waveform";
import type { FileMeta, MiniWaveformMap } from "./types";

/**
 * 模块级波形加载任务计数器。
 *
 * 架构说明：当前为模块级变量（而非 React useRef），理由：
 * ─ 应用为单 FileListPanel 架构，同一时间只有一个预载批次在运行。
 * ─ urgentJobId 用于紧急预载去重（同一文件多次点击不重复触发），
 *   miniWaveformJobIdRef 用于后台预载批次去重。
 *
 * ⚠ 若未来引入多 FileListPanel 或多窗口，请将此处重构为组件实例内 useRef，或通过 Context 隔离。
 */
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
  // 不在这里调 loadMetaForBatch——waveform 返回结果已包含 duration
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

// ── 紧急预载（Level 0）──
// 浏览器解码器与 ffmpeg 子进程竞速，谁先返回就用谁
export async function preloadSingleFile(
  filePath: string,
  miniWaveforms: MiniWaveformMap,
  setMiniWaveforms: (updater: MiniWaveformMap | ((prev: MiniWaveformMap) => MiniWaveformMap)) => void
) {
  if (miniWaveforms[filePath]?.length) return;
  urgentJobId++;

  try {
    const waveform = await Promise.race([
      browserWaveform(filePath).catch(() => null as never),
      getWaveformPeaks(filePath),
    ]);

    if (!waveform) {
      // 浏览器端挂了，等 ffmpeg 的结果
      const fallback = await getWaveformPeaks(filePath);
      if (fallback.duration > 0) fileDurationCache[filePath] = fallback.duration;
      setMiniWaveforms((prev) => {
        if (prev[filePath]?.length) return prev;
        return { ...prev, [filePath]: fallback.peaks };
      });
      return;
    }

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

    const batch = missing.slice(0, batchSize);

    // 先扫一批元数据让 duration 尽快就绪（仅扫波形批次外的文件，避免重复读）
    const metaBatch = missing.slice(batchSize, batchSize * 3);
    if (metaBatch.length > 0) void loadMetaForBatch(metaBatch);

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

    // Level 1：可见文件 — waveform 返回结果已包含 duration，无需单独调 getAudioMeta
    const visibleFiles = missingFiles.slice(0, visibleCount);
    if (visibleFiles.length > 0) {
      loadWaveformBatch(visibleFiles, jobId, setMiniWaveforms);
    }

    // Level 2：后台文件 — 延迟后再来
    const deferredFiles = missingFiles.slice(visibleCount);
    if (deferredFiles.length > 0) {
      deferredTimerRef.current = setTimeout(() => {
        if (jobId !== miniWaveformJobIdRef.current) return;
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
