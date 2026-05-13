import type { LibrarySnapshot, LibraryLoadState } from "@/lib/types";

export function buildLoadingState(message: string): LibraryLoadState {
  return {
    status: "indexing",
    message,
  };
}

export function buildLibraryErrorState(error: unknown): LibraryLoadState {
  return {
    status: "error",
    message: error instanceof Error ? error.message : String(error),
  };
}

export function shouldUseCachedSnapshot<T>(cached: T | undefined): cached is T {
  return Boolean(cached);
}

export function buildBackgroundIndexCompletedState(snapshot: LibrarySnapshot) {
  return {
    snapshot,
    shouldCache: true,
  };
}
