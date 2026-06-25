import { buildLibraryIndex, buildLibrarySnapshot, getSyncStatus, loadSettings } from "@/lib/api";
import { scheduleBackgroundIndex } from "@/lib/app-effects";
import { buildLibraryErrorState, buildLoadingState } from "@/lib/app-orchestration";
import { shouldApplyLibraryResult, shouldTriggerBackgroundIndex } from "@/lib/library-actions";
import { createLibrarySelectionResult } from "@/lib/library-management-actions";
import { deriveBootstrapState } from "@/lib/app-shell-actions";

import {
  applyLibraryMutationResult,
  buildLibraryControllerState,
  buildLibraryErrorResult,
} from "@/lib/library-controller-state";

import type { LibraryLoadState } from "@/lib/types";

export async function bootstrapLibraryDomain() {
  const [settings, sync] = await Promise.all([loadSettings(), getSyncStatus().catch(() => null)]);
  const bootstrap = deriveBootstrapState(settings, sync);

  const nextState = buildLibraryControllerState(bootstrap);
  return {
    bootstrap,
    nextState,
  };
}

export async function resolveLibrarySelection(options: {
  path: string;
  requestId: number;
  activeRequestId: number;
  cachedSnapshot?: Awaited<ReturnType<typeof buildLibrarySnapshot>>;
  applySnapshot: (snapshot: Awaited<ReturnType<typeof buildLibrarySnapshot>>) => void;
  onLoadingState: (state: LibraryLoadState) => void;
  cacheSnapshot: (libraryPath: string, snapshot: Awaited<ReturnType<typeof buildLibrarySnapshot>>) => void;
  onErrorState: (error: ReturnType<typeof buildLibraryErrorResult>) => void;
}) {
  const { path, requestId, activeRequestId, cachedSnapshot, applySnapshot, onLoadingState, cacheSnapshot, onErrorState } = options;
  const shouldApplyResult = (targetPath: string) => shouldApplyLibraryResult(requestId, activeRequestId, targetPath, path);

  if (cachedSnapshot) {
    if (shouldApplyResult(path)) {
      applySnapshot(cachedSnapshot);
    }
    return;
  }

  onLoadingState(buildLoadingState("正在读取目录结构..."));

  try {
    const previewSnapshot = await buildLibrarySnapshot(path);
    if (!shouldApplyResult(path)) return;
    applySnapshot(previewSnapshot);

    if (shouldTriggerBackgroundIndex(previewSnapshot)) {
      void scheduleBackgroundIndex({
        snapshot: previewSnapshot,
        libraryPath: path,
        runBuildLibraryIndex: buildLibraryIndex,
        shouldApplyResult,
        onCompleted: (fullSnapshot) => {
          cacheSnapshot(path, fullSnapshot);
          applySnapshot(fullSnapshot);
        },
        onError: (indexErr) => {
          onLoadingState(buildLibraryErrorState(indexErr));
        },
      });
    } else {
      cacheSnapshot(path, previewSnapshot);
    }
  } catch (err) {
    if (!shouldApplyResult(path)) return;
    onErrorState(buildLibraryErrorResult(err));
  }
}

export async function resolveLibraryAdd(options: {
  newLibName: string;
  newLibType: string;
  librariesState: ReturnType<typeof buildLibraryControllerState>;
  addLibraryAction: (name: string, path: string, libType: string) => Promise<void>;
  selectFolderAction: () => Promise<string | null>;
}) {
  const { newLibName, newLibType, librariesState, addLibraryAction, selectFolderAction } = options;
  if (!newLibName.trim()) {
    return { ok: false as const, reason: "empty-name" as const };
  }

  const path = await selectFolderAction();
  if (!path) {
    return { ok: false as const, reason: "cancelled" as const };
  }

  await addLibraryAction(newLibName, path, newLibType);
  const settings = await loadSettings();
  const nextState = applyLibraryMutationResult(
    librariesState,
    createLibrarySelectionResult(settings, path)
  );

  return {
    ok: true as const,
    path,
    nextState,
  };
}

export async function resolveLibraryRemoval(options: {
  path: string;
  librariesState: ReturnType<typeof buildLibraryControllerState>;
  removeLibraryAction: (path: string) => Promise<void>;
}) {
  const { path, librariesState, removeLibraryAction } = options;
  await removeLibraryAction(path);
  const settings = await loadSettings();
  return applyLibraryMutationResult(
    librariesState,
    createLibrarySelectionResult(settings)
  );
}
