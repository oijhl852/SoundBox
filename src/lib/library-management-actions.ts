import type { AppSettings, LibraryConfig, LibraryLoadState } from "@/lib/types";

export type LibraryMutationResult = {
  libraries: LibraryConfig[];
  activeLibrary: string;
  libraryLoadState: LibraryLoadState;
};

export function createEmptyLibraryResult(): LibraryMutationResult {
  return {
    libraries: [],
    activeLibrary: "",
    libraryLoadState: { status: "idle", message: "请先添加素材库" },
  };
}

export function createLibrarySelectionResult(settings: AppSettings, preferredPath?: string): LibraryMutationResult {
  if (settings.libraries.length === 0) {
    return createEmptyLibraryResult();
  }

  const activeLibrary = preferredPath && settings.libraries.some((library) => library.path === preferredPath)
    ? preferredPath
    : settings.libraries[0]?.path ?? "";

  return {
    libraries: settings.libraries,
    activeLibrary,
    libraryLoadState: { status: "idle", message: "已读取素材库配置，等待选择加载" },
  };
}
