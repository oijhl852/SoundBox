import { shouldAutoplayNextSource } from "@/lib/player-actions";
import type { DragDebugState, LibraryLoadState, LibrarySnapshot, MiniWaveformMap } from "@/lib/types";

/** 并发限制器：同时最多跑 concurrency 个异步任务 */
export async function asyncMapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  const queue = [...items];
  const startWorker = async () => {
    while (queue.length > 0) {
      const item = queue.shift()!;
      const idx = items.indexOf(item);
      results[idx] = await fn(item);
    }
  };
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => startWorker());
  await Promise.all(workers);
  return results;
}

export function createDragStatePoller(options: {
  fetchState: () => Promise<DragDebugState>;
  onState: (state: DragDebugState | null) => void;
  intervalMs?: number;
}) {
  const { fetchState, onState, intervalMs = 800 } = options;
  let cancelled = false;

  const sync = async () => {
    try {
      const state = await fetchState();
      if (!cancelled) {
        onState(state);
      }
    } catch {
      if (!cancelled) {
        onState(null);
      }
    }
  };

  void sync();
  const timer = window.setInterval(sync, intervalMs);

  return () => {
    cancelled = true;
    window.clearInterval(timer);
  };
}

export async function resolveWaveformLoad(options: {
  currentFilePath: string;
  getAudioSource: (path: string) => Promise<{ path: string; mime: string }>;
  getWaveformPeaks: (path: string) => Promise<{ duration: number; peaks: number[] }>;
  isCurrentJob: (jobId: number) => boolean;
  jobId: number;
  setAudioSource: (sourcePath: string) => Promise<void>;
  onReady: (duration: number) => void;
  onError: (error: unknown) => void;
}) {
  const {
    currentFilePath,
    getAudioSource,
    getWaveformPeaks,
    isCurrentJob,
    jobId,
    setAudioSource,
    onReady,
    onError,
  } = options;

  try {
    const [source, waveform] = await Promise.all([
      getAudioSource(currentFilePath),
      getWaveformPeaks(currentFilePath),
    ]);

    if (!isCurrentJob(jobId)) {
      return;
    }

    await setAudioSource(source.path);

    requestAnimationFrame(() => {
      if (!isCurrentJob(jobId)) {
        return;
      }
      onReady(waveform.duration);
    });
  } catch (error) {
    if (!isCurrentJob(jobId)) {
      return;
    }
    onError(error);
  }
}

export async function scheduleBackgroundIndex(options: {
  snapshot: LibrarySnapshot;
  libraryPath: string;
  runBuildLibraryIndex: (path: string) => Promise<LibrarySnapshot>;
  shouldApplyResult: (targetPath: string) => boolean;
  onCompleted: (snapshot: LibrarySnapshot) => void;
  onError: (error: unknown) => void;
}) {
  const {
    snapshot,
    libraryPath,
    runBuildLibraryIndex,
    shouldApplyResult,
    onCompleted,
    onError,
  } = options;

  if (snapshot.indexingComplete) {
    return;
  }

  setTimeout(async () => {
    try {
      const fullSnapshot = await runBuildLibraryIndex(libraryPath);
      if (!shouldApplyResult(libraryPath)) return;
      onCompleted(fullSnapshot);
    } catch (error) {
      if (!shouldApplyResult(libraryPath)) return;
      onError(error);
    }
  }, 0);
}

export function mergeMiniWaveforms(
  previous: MiniWaveformMap,
  entries: readonly (readonly [string, number[]])[]
): MiniWaveformMap {
  const nextEntries = Object.fromEntries(entries.filter(([filePath]) => !previous[filePath]?.length));
  if (Object.keys(nextEntries).length === 0) {
    return previous;
  }
  return { ...previous, ...nextEntries };
}

export function createLibraryLoadErrorState(error: unknown): LibraryLoadState {
  return {
    status: "error",
    message: error instanceof Error ? error.message : String(error),
  };
}

export function createWaveformJobGuard(activeJobIdRef: { current: number }) {
  return (jobId: number) => shouldAutoplayNextSource(jobId, activeJobIdRef.current);
}
