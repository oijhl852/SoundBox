import { clampSidebarWidth } from "@/lib/app-shell-actions";

export function buildSidebarResizeState(isResizingSidebar: boolean, clientX: number) {
  return {
    isResizingSidebar,
    sidebarWidth: clampSidebarWidth(clientX),
  };
}

export function buildSidebarResizeEndState() {
  return {
    isResizingSidebar: false,
  };
}
