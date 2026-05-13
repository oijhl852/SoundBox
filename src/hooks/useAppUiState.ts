import { useEffect, useState } from "react";
import { clampSidebarWidth } from "@/lib/app-shell-actions";
import { buildSidebarResizeEndState } from "@/lib/sidebar-resize-state";


export function useAppUiState() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showDropInspector, setShowDropInspector] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);

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
  }, [isResizingSidebar]);

  return {
    searchQuery,
    showSettings,
    showDropInspector,
    showSidebar,
    sidebarWidth,
    isResizingSidebar,
    setSearchQuery,
    setShowSettings,
    setShowDropInspector,
    setShowSidebar,
    setSidebarWidth,
    setIsResizingSidebar,
  };
}
