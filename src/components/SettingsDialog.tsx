import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Palette, FolderOpen, Info, Music, Plus, Loader2, Trash2 } from "lucide-react";
import { useLibraryStore } from "@/stores/libraryStore";
import { useUiStore, type ThemeName } from "@/stores/uiStore";

const THEMES: { name: ThemeName; label: string; desc: string; colors: string }[] = [
  { name: "default", label: "极简白", desc: "冷感通透", colors: "bg-white text-zinc-800 ring-1 ring-zinc-300" },
  { name: "paper", label: "暖白纸墨", desc: "柔和护眼", colors: "bg-stone-100 text-amber-950 ring-1 ring-amber-300" },
  { name: "midnight", label: "暗夜深蓝", desc: "深邃高对比", colors: "bg-slate-950 text-blue-100 ring-1 ring-blue-800" },
  { name: "cyber", label: "赛博紫", desc: "暗紫霓虹", colors: "bg-fuchsia-950 text-fuchsia-100 ring-1 ring-fuchsia-700" },
];

const TABS = [
  { id: "appearance", label: "外观", icon: Palette },
  { id: "libraries", label: "素材库", icon: FolderOpen },
  { id: "about", label: "关于", icon: Info },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<TabId>("appearance");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const libraries = useLibraryStore((s) => s.libraries);
  const syncStatus = useLibraryStore((s) => s.syncStatus);
  const handleAddLibrary = useLibraryStore((s) => s.handleAddLibrary);
  const handleRemoveLibrary = useLibraryStore((s) => s.handleRemoveLibrary);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);

  const showFeedback = (ok: boolean, msg: string) => {
    setFeedback({ ok, msg });
    setTimeout(() => setFeedback(null), 3000);
  };

  const onAddLibrary = async () => {
    setAdding(true);
    const ok = await handleAddLibrary();
    setAdding(false);
    if (ok) {
      showFeedback(true, "素材库添加成功");
    }
  };

  const onRemoveLibrary = async (path: string) => {
    setRemoving(path);
    await handleRemoveLibrary(path);
    setRemoving(null);
    showFeedback(true, "素材库已移除");
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-background rounded-xl shadow-2xl w-[580px] max-h-[85vh] overflow-hidden flex flex-col relative">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
          <h2 className="text-base font-semibold">设置</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* ── Toast feedback ── */}
        {feedback && (
          <div
            className={`absolute top-14 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg text-sm transition-all ${
              feedback.ok ? "bg-green-600 text-white" : "bg-destructive text-destructive-foreground"
            }`}
          >
            <span>{feedback.msg}</span>
          </div>
        )}

        {/* ── Body ── */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Tabs */}
          <nav className="w-36 shrink-0 border-r p-2 space-y-0.5">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeTab === tab.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                <tab.icon className="h-4 w-4 shrink-0" />
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">

            {/* ════════════════ 外观 ════════════════ */}
            {activeTab === "appearance" && (
              <div>
                <h3 className="text-sm font-semibold mb-3">主题配色</h3>
                <div className="grid grid-cols-2 gap-2.5">
                  {THEMES.map((t) => (
                    <button
                      key={t.name}
                      onClick={() => setTheme(t.name)}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                        theme === t.name
                          ? "border-primary ring-2 ring-primary/30 bg-primary/[0.03]"
                          : "border-border hover:border-primary/40 hover:bg-muted/20"
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-full shrink-0 ${t.colors}`} />
                      <div className="flex flex-col text-left">
                        <span className="text-sm font-medium">{t.label}</span>
                        <span className="text-[11px] text-muted-foreground">{t.desc}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ════════════════ 素材库 ════════════════ */}
            {activeTab === "libraries" && (
              <>
                <div>
                  <h3 className="text-sm font-semibold mb-3">已添加的素材库</h3>
                  {libraries.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded-lg">
                      还没有素材库，点击下方添加
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {libraries.map((lib) => (
                        <div
                          key={lib.path}
                          className="group flex items-center justify-between p-3 rounded-lg border border-border/60 bg-muted/10 hover:bg-muted/20 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <Music className="h-4 w-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium">{lib.name}</div>
                              <div className="text-xs text-muted-foreground truncate max-w-[300px]">{lib.path}</div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={removing === lib.path}
                            className="h-7 w-7 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive shrink-0 transition-opacity"
                            onClick={() => onRemoveLibrary(lib.path)}
                          >
                            {removing === lib.path ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Button onClick={onAddLibrary} disabled={adding} className="w-full">
                  {adding ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  ) : (
                    <Plus className="h-4 w-4 mr-1.5" />
                  )}
                  {adding ? "正在选择文件夹..." : "添加素材库"}
                </Button>

                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold mb-2">仓库状态</h3>
                  <div className="text-xs text-muted-foreground space-y-1.5 bg-muted/15 rounded-lg p-3">
                    <div className="flex justify-between">
                      <span>本地标签仓库</span>
                      <span className="text-foreground/70">%APPDATA%/Soundbox/local-meta</span>
                    </div>
                    <div className="flex justify-between">
                      <span>同步模式</span>
                      <span className="text-foreground/70">{syncStatus?.mode ?? "local-only"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>待同步变更</span>
                      <span className="text-foreground/70">{syncStatus?.pendingChanges ?? 0}</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ════════════════ 关于 ════════════════ */}
            {activeTab === "about" && (
              <div className="flex flex-col items-center py-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Music className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-base font-semibold">Soundbox</h3>
                <p className="text-sm text-muted-foreground mt-1">音频素材管理工具</p>
                <div className="mt-1 text-xs text-muted-foreground/60">v1.0.0</div>
                <div className="mt-6 text-xs text-muted-foreground/50 leading-relaxed max-w-xs">
                  波形预览 · 标签系统 · 快速检索<br />
                  基于 Electron + React + Zustand 构建
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
