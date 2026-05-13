import type { DragDebugState } from "@/lib/types";


export function getDragStateSummary(state: DragDebugState | null): string {
  if (!state) {
    return "waiting";
  }

  return state.detail || state.error || "waiting";
}

export function isMeaningfulDragState(state: DragDebugState | null): boolean {
  return Boolean(state && (state.filePath || state.detail || state.error));
}
