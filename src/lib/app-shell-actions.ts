import type { AppSettings, FileMeta, LibraryLoadState, MiniWaveformMap, SyncStatus } from "@/lib/types";

export type AppShellBootstrap = {
  libraries: AppSettings["libraries"];
  activeLibrary: string;
  libraryLoadState: LibraryLoadState;
  syncStatus: SyncStatus | null;
};

export function deriveBootstrapState(settings: AppSettings, syncStatus: SyncStatus | null): AppShellBootstrap {
  if (settings.libraries.length === 0) {
    return {
      libraries: [],
      activeLibrary: "",
      libraryLoadState: { status: "idle", message: "请先添加素材库" },
      syncStatus,
    };
  }

  return {
    libraries: settings.libraries,
    activeLibrary: settings.libraries[0]?.path ?? "",
    libraryLoadState: { status: "idle", message: "已读取素材库配置，等待选择加载" },
    syncStatus,
  };
}

export function clampSidebarWidth(clientX: number): number {
  return Math.min(480, Math.max(180, clientX));
}

export function getMissingMiniWaveformFiles(
  files: FileMeta[],
  miniWaveforms: MiniWaveformMap,
  limit = 60
): FileMeta[] {
  return files.slice(0, limit).filter((file) => !miniWaveforms[file.path]?.length);
}
