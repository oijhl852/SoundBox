import { useEffect } from "react";
import { SettingsDialog } from "@/components/SettingsDialog";
import { LibrarySidebar } from "@/components/LibrarySidebar";
import { FileListPanel } from "@/components/FileListPanel";
import { DropInspectorWindow } from "@/components/DropInspectorWindow";
import { useLibraryStore } from "@/stores/libraryStore";
import { usePlayerStore, usePlayerAudioEffect, audioRef } from "@/stores/playerStore";
import { useUiStore, useSidebarResizeEffect } from "@/stores/uiStore";
import { Button } from "@/components/ui/button";
import { Music, Settings, PanelLeft } from "lucide-react";

function App() {
  // --- 初始化素材库（启动时执行一次）---
  useEffect(() => {
    useLibraryStore.getState().initLibraries();
  }, []);

  // --- 副作用 Hooks ---
  usePlayerAudioEffect();
  useSidebarResizeEffect();

  // --- UI 状态 ---
  const showSidebar = useUiStore((s) => s.showSidebar);
  const sidebarWidth = useUiStore((s) => s.sidebarWidth);
  const showDropInspector = useUiStore((s) => s.showDropInspector);
  const showSettings = useUiStore((s) => s.showSettings);
  const setShowSettings = useUiStore((s) => s.setShowSettings);
  const setShowSidebar = useUiStore((s) => s.setShowSidebar);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground select-none">
      <audio ref={audioRef as React.RefObject<HTMLAudioElement>} preload="metadata" />

      <header className="flex h-10 items-center border-b px-4 text-sm font-medium">
        <Music className="mr-2 h-4 w-4" />
        <span>Soundbox</span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowSidebar(!showSidebar)}>
            <PanelLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)}>
            <Settings className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground">v1.0.0</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <LibrarySidebar visible={showSidebar} sidebarWidth={sidebarWidth} />

        <div className="flex flex-1 flex-col overflow-hidden">
          <FileListPanel />
        </div>
      </div>

      {showDropInspector && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => useUiStore.getState().setShowDropInspector(false)}
        >
          <div className="w-full max-w-4xl max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <DropInspectorWindow />
          </div>
        </div>
      )}

      <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}

export default App;
