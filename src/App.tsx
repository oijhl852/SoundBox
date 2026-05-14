import { useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { SettingsDialog } from "@/components/SettingsDialog";
import { LibrarySidebar } from "@/components/LibrarySidebar";
import { FileListPanel } from "@/components/FileListPanel";
import { DropInspectorWindow } from "@/components/DropInspectorWindow";
import { useLibraryStore } from "@/stores/libraryStore";
import { usePlayerStore, usePlayerAudioEffect, audioRef } from "@/stores/playerStore";
import { useUiStore, useSidebarResizeEffect, useThemeEffect } from "@/stores/uiStore";
import { Button } from "@/components/ui/button";
import { Music, Settings, PanelLeft, Volume2, Search } from "lucide-react";

function App() {
  // --- 初始化 ---
  useEffect(() => {
    useLibraryStore.getState().initLibraries();
  }, []);

  // --- 副作用 Hooks ---
  useThemeEffect();
  usePlayerAudioEffect();
  useSidebarResizeEffect();

  // --- UI 状态 ---
  const showSidebar = useUiStore((s) => s.showSidebar);
  const sidebarWidth = useUiStore((s) => s.sidebarWidth);
  const showDropInspector = useUiStore((s) => s.showDropInspector);
  const showSettings = useUiStore((s) => s.showSettings);
  const setShowSettings = useUiStore((s) => s.setShowSettings);
  const setShowSidebar = useUiStore((s) => s.setShowSidebar);
  const volume = usePlayerStore((s) => s.volume);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const toggleMute = usePlayerStore((s) => s.toggleMute);
  const allFiles = useLibraryStore((s) => s.allFiles);
  const miniWaveforms = useLibraryStore((s) => s.miniWaveforms);
  const waveformTotal = allFiles.length;
  const searchQuery = useUiStore((s) => s.searchQuery);
  const setSearchQuery = useUiStore((s) => s.setSearchQuery);
  const waveformLoaded = useMemo(
    () => allFiles.filter((f) => miniWaveforms[f.path]?.length).length,
    [allFiles, miniWaveforms]
  );

  return (
    <div className="flex h-screen flex-col bg-background text-foreground select-none">
      <audio ref={audioRef as React.RefObject<HTMLAudioElement>} preload="metadata" />

      <header className="flex h-10 items-center border-b px-4 text-sm font-medium gap-3">
        <Music className="h-4 w-4 shrink-0" />
        <span className="shrink-0">Soundbox</span>
        {/* 全局搜索 */}
        <div className="flex items-center gap-1.5 flex-1 max-w-xs">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Input
            placeholder="搜索文件名、标签或氛围..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 text-xs flex-1"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* 音量 */}
          <div className="flex items-center gap-1.5 mr-1">
            <button
              onClick={toggleMute}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted/50 transition-colors"
            >
              <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-16 h-1 accent-primary cursor-pointer"
            />
            <span className="text-[11px] text-muted-foreground w-8 text-right tabular-nums">
              {Math.round((isMuted ? 0 : volume) * 100)}%
            </span>
          </div>
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

      {/* 底部状态栏 */}
      <div className="flex h-6 items-center border-t px-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          波形 {waveformTotal > 0 ? `${waveformLoaded}/${waveformTotal}` : ""}
        </span>
        <div className="ml-auto" />
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
