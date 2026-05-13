import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, X } from "lucide-react";
import { useLibraryStore } from "@/stores/libraryStore";
import { useUiStore } from "@/stores/uiStore";
import { LIBRARY_TYPES } from "@/lib/app-constants";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const libraries = useLibraryStore((s) => s.libraries);
  const newLibName = useLibraryStore((s) => s.newLibName);
  const newLibType = useLibraryStore((s) => s.newLibType);
  const syncStatus = useLibraryStore((s) => s.syncStatus);
  const setNewLibName = useLibraryStore((s) => s.setNewLibName);
  const setNewLibType = useLibraryStore((s) => s.setNewLibType);
  const handleAddLibrary = useLibraryStore((s) => s.handleAddLibrary);
  const handleRemoveLibrary = useLibraryStore((s) => s.handleRemoveLibrary);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg shadow-lg w-[500px] max-h-[80vh] overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium">设置</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-2">素材库管理</h3>
            <div className="space-y-2">
              {libraries.map((lib) => (
                <div key={lib.path} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                  <div>
                    <div className="text-sm font-medium">{lib.name}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[200px]">{lib.path}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive"
                    onClick={() => handleRemoveLibrary(lib.path)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <div>
              <h3 className="text-sm font-medium mb-2">添加素材库</h3>
              <div className="flex gap-2">
                <Input
                  placeholder="名称"
                  value={newLibName}
                  onChange={(e) => setNewLibName(e.target.value)}
                  className="flex-1"
                />
                <select
                  className="h-8 px-2 rounded border bg-background"
                  value={newLibType}
                  onChange={(e) => setNewLibType(e.target.value)}
                >
                  {LIBRARY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <Button onClick={handleAddLibrary}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="border-t pt-3 text-xs text-muted-foreground space-y-1">
              <div className="font-medium text-foreground">仓库 / 同步状态</div>
              <div>本地标签仓库：%APPDATA%/Soundbox/local-meta</div>
              <div>远程标签仓库：预留 NAS 路径配置（下一阶段接入）</div>
              <div>当前同步模式：{syncStatus?.mode ?? "local-only"}</div>
              <div>待同步变更：{syncStatus?.pendingChanges ?? 0}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
