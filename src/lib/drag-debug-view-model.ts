import { createDragStatePoller } from "@/lib/app-effects";
import type { DragDebugState } from "@/lib/types";


export function buildDragDebugViewModel(state: DragDebugState | null) {
  if (!state) {
    return null;
  }

  return {
    stage: state.stage,
    detail: state.detail,
    error: state.error,
  };
}

export function createDragDebugStatePoller(fetchState: () => Promise<DragDebugState>, onState: (state: DragDebugState | null) => void) {
  return createDragStatePoller({
    fetchState,
    onState,
  });
}
