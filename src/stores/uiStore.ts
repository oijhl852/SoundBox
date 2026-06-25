import { useEffect } from "react";
import { clampSidebarWidth } from "@/lib/app-shell-actions";
import { buildSidebarResizeEndState } from "@/lib/sidebar-resize-state";
import { create } from "zustand";

export type ThemeName = "default" | "paper" | "midnight" | "cyber";

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
  theme: ThemeName;
}

interface UiActions {
  setSearchQuery: (value: string) => void;
  setShowSettings: (value: boolean) => void;
  setShowDropInspector: (value: boolean) => void;
  setShowSidebar: (value: boolean) => void;
  setSidebarWidth: (value: number) => void;
  setIsResizingSidebar: (value: boolean) => void;
  setTheme: (value: ThemeName) => void;
}

type UiStore = UiState & UiActions;

// ──────────────────────────────────────────────
// 主题名称 → 要应用到 <html> 的属性
// ──────────────────────────────────────────────

const themeClassMap: Record<ThemeName, { className: string; classList: string[] }> = {
  default: { className: "", classList: [] },
  paper: { className: "theme-paper", classList: ["theme-paper"] },
  midnight: { className: "dark", classList: ["dark"] },
  cyber: { className: "theme-cyber", classList: ["theme-cyber"] },
};

export function applyTheme(theme: ThemeName) {
  const root = document.documentElement;
  // 清除所有主题相关 class
  root.classList.remove("dark", "theme-paper", "theme-cyber");
  // 添加当前主题的 class
  const cfg = themeClassMap[theme];
  cfg.classList.forEach((cls) => root.classList.add(cls));
}

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
  theme: "default",

  // Actions
  setSearchQuery: (value) => set({ searchQuery: value }),
  setShowSettings: (value) => set({ showSettings: value }),
  setShowDropInspector: (value) => set({ showDropInspector: value }),
  setShowSidebar: (value) => set({ showSidebar: value }),
  setSidebarWidth: (value) => set({ sidebarWidth: value }),
  setIsResizingSidebar: (value) => set({ isResizingSidebar: value }),
  setTheme: (value) => {
    applyTheme(value);
    set({ theme: value });
  },
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

// ──────────────────────────────────────────────
// 主题初始化副作用（挂载到 App 层）
// ──────────────────────────────────────────────

export function useThemeEffect() {
  useEffect(() => {
    applyTheme(useUiStore.getState().theme);
  }, []);
}
