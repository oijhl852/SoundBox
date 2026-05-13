import { useEffect } from "react";
import { clampSidebarWidth } from "@/lib/app-shell-actions";
import { buildSidebarResizeEndState } from "@/lib/sidebar-resize-state";
import { create } from "zustand";

// ──────────────────────────────────────────────
// Store 类型
// ──────────────────────────────────────────────

interface UiState {
  searchQuery: string;
  showSettings: boolean;
  showDropInspector: boolean;
  showSidebar: boolean;
  sidebarWidth: number;
  isResizingSidebar: boolean;
}

interface UiActions {
  setSearchQuery: (value: string) => void;
  setShowSettings: (value: boolean) => void;
  setShowDropInspector: (value: boolean | ((prev: boolean) => boolean)) => void;
  setShowSidebar: (value: boolean) => void;
  setSidebarWidth: (value: number) => void;
  setIsResizingSidebar: (value: boolean) => void;
}

type UiStore = UiState & UiActions;

// ──────────────────────────────────────────────
// Store
// ──────────────────────────────────────────────

export const useUiStore = create<UiStore>((set) => ({
  // State
  searchQuery: "",
  showSettings: false,
  showDropInspector: false,
  showSidebar: true,
  sidebarWidth: 260,
  isResizingSidebar: false,

  // Actions
  setSearchQuery: (value) => set({ searchQuery: value }),
  setShowSettings: (value) => set({ showSettings: value }),
  setShowDropInspector: (value) =>
    set((state) => ({
      showDropInspector: typeof value === "function" ? value(state.showDropInspector) : value,
    })),
  setShowSidebar: (value) => set({ showSidebar: value }),
  setSidebarWidth: (value) => set({ sidebarWidth: value }),
  setIsResizingSidebar: (value) => set({ isResizingSidebar: value }),
}));

// ──────────────────────────────────────────────
// 侧栏 resize 副作用 Hook（挂载到 App 层）
// ──────────────────────────────────────────────

export function useSidebarResizeEffect() {
  const isResizingSidebar = useUiStore((s) => s.isResizingSidebar);
  const setSidebarWidth = useUiStore((s) => s.setSidebarWidth);
  const setIsResizingSidebar = useUiStore((s) => s.setIsResizingSidebar);

  useEffect(() => {
    let rafId: number | null = null;
    let pendingX = 0;

    const flushResize = () => {
      rafId = null;
      if (isResizingSidebar) {
        setSidebarWidth(clampSidebarWidth(pendingX));
      }
    };

    const onMove = (e: MouseEvent) => {
      pendingX = e.clientX;
      if (rafId === null) {
        rafId = requestAnimationFrame(flushResize);
      }
    };

    const onUp = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      setIsResizingSidebar(buildSidebarResizeEndState().isResizingSidebar);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isResizingSidebar, setSidebarWidth, setIsResizingSidebar]);
}
