import { useMemo } from "react";
import { useLibraryStore } from "@/stores/libraryStore";

/**
 * 底部状态栏 — 独立组件，避免根组件因波形预载频繁重渲染
 */
export function StatusBar() {
  const allFiles = useLibraryStore((s) => s.allFiles);
  const miniWaveforms = useLibraryStore((s) => s.miniWaveforms);

  const waveformTotal = allFiles.length;
  const waveformLoaded = useMemo(
    () => allFiles.filter((f) => miniWaveforms[f.path]?.length).length,
    [allFiles, miniWaveforms]
  );

  return (
    <div className="flex h-6 items-center border-t px-4 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1">
        波形 {waveformTotal > 0 ? `${waveformLoaded}/${waveformTotal}` : ""}
      </span>
      <div className="ml-auto" />
    </div>
  );
}
