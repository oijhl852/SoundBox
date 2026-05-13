import { useEffect, useRef } from "react";
import { getWaveformPeaks } from "./api";
import { getMissingMiniWaveformFiles } from "./app-shell-actions";
import { logError } from "./logger";
import { mergeMiniWaveforms } from "./app-effects";
import { fileDurationCache } from "@/stores/playerStore";
import type { FileMeta, MiniWaveformMap } from "./types";

async function loadWaveformBatch(
  files: FileMeta[],
  jobId: number,
  miniWaveformJobIdRef: React.MutableRefObject<number>,
  setMiniWaveforms: (updater: MiniWaveformMap | ((prev: MiniWaveformMap) => MiniWaveformMap)) => void
) {
  const results = await Promise.all(
    files.map(async (file) => {
      try {
        const waveform = await getWaveformPeaks(file.path);
        // 顺手缓存 duration
        if (waveform.duration > 0) fileDurationCache[file.path] = waveform.duration;
        return [file.path, waveform.peaks] as const;
      } catch (error) {
        logError("Mini waveform load failed:", { path: file.path, error });
        return null;
      }
    })
  );

  if (jobId !== miniWaveformJobIdRef.current) return;
  const entries = results.filter((result): result is readonly [string, number[]] => Boolean(result));
  if (entries.length === 0) return;
  setMiniWaveforms((prev) => mergeMiniWaveforms(prev, entries));
}

export function useMiniWaveformPreload(options: {
  filteredFiles: FileMeta[];
  miniWaveforms: MiniWaveformMap;
  setMiniWaveforms: (updater: MiniWaveformMap | ((prev: MiniWaveformMap) => MiniWaveformMap)) => void;
  visibleCount?: number;
}) {
  const { filteredFiles, miniWaveforms, setMiniWaveforms, visibleCount = 15 } = options;
  const miniWaveformJobIdRef = useRef(0);
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

    const visibleFiles = missingFiles.slice(0, visibleCount);
    if (visibleFiles.length > 0) {
      loadWaveformBatch(visibleFiles, jobId, miniWaveformJobIdRef, setMiniWaveforms);
    }

    const deferredFiles = missingFiles.slice(visibleCount);
    if (deferredFiles.length > 0) {
      deferredTimerRef.current = setTimeout(() => {
        if (jobId !== miniWaveformJobIdRef.current) return;
        loadWaveformBatch(deferredFiles, jobId, miniWaveformJobIdRef, setMiniWaveforms);
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
