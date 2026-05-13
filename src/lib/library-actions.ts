import type { LibrarySnapshot } from "@/lib/types";

export function shouldApplyLibraryResult(
  requestId: number,
  currentRequestId: number,
  targetPath: string,
  activePath: string
): boolean {
  return requestId === currentRequestId && targetPath === activePath;
}

export function shouldTriggerBackgroundIndex(snapshot: LibrarySnapshot): boolean {
  return !snapshot.indexingComplete;
}
