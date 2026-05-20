import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileAudio, X, Tag, Search } from "lucide-react";
import { useCallback, memo, useMemo, useState, useRef, useEffect } from "react";
import { List } from "react-window";
import { useLibraryStore } from "@/stores/libraryStore";
import { usePlayerStore, fileDurationCache } from "@/stores/playerStore";
import { useTagStore } from "@/stores/tagStore";
import { seekOnLoadPct } from "@/lib/audio-element-effects";
import { useUiStore } from "@/stores/uiStore";
import { collectFilesForFolder } from "@/lib/file-list-state";
import { buildFilteredFiles } from "@/lib/file-filtering";
import { useMiniWaveformPreload, useBackgroundWaveformPreload, preloadSingleFile } from "@/lib/use-mini-waveform-preload";
import { TAG_GROUPS } from "@/lib/app-constants";
import { dragOutFile } from "@/lib/api";
import type { MiniWaveformMap, FileMeta, TagEntry } from "@/lib/types";

const ROW_HEIGHT = 44;

// 模块级列宽 ref—— Row 直接读取，绕过 react-window 的 props 传递
const colWidthRef = { name: 150, tags: 130 };

// ── 迷你波形 ──
const TableMiniWaveform = memo(function TableMiniWaveform({
  peaks, active, progress, resizeKey,
}: {
  peaks?: number[]; active: boolean; progress: number | null; resizeKey: number;
}) {
  const canvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas || !peaks?.length) return;
    const wrapper = canvas.parentElement;
    if (!wrapper) return;
    const dpr = window.devicePixelRatio || 1;
    const cw = wrapper.clientWidth || 120;
    const ch = wrapper.clientHeight || 20;
    canvas.width = Math.floor(cw * dpr);
    canvas.height = Math.floor(ch * dpr);
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    const mid = ch / 2;
    const s = getComputedStyle(document.documentElement);
    const sc = s.getPropertyValue(active ? "--waveform-active-line" : "--waveform-line").trim();
    const pg = s.getPropertyValue("--waveform-progress").trim();
    const step = peaks.length / cw;
    ctx.clearRect(0, 0, cw, ch);
    ctx.strokeStyle = sc || (active ? "#6366f1" : "rgba(100,116,139,0.5)");
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < cw; x++) {
      let mx = 0;
      const s = Math.floor(x * step);
      const e = x === cw - 1 ? peaks.length : Math.max(s + 1, Math.floor((x + 1) * step));
      for (let i = s; i < e; i++) mx = Math.max(mx, peaks[i] ?? 0);
      const vp = mx > 0 ? Math.max(mx, 0.02) : 0;
      ctx.moveTo(x + 0.5, mid - vp * mid * 0.85);
      ctx.lineTo(x + 0.5, mid + vp * mid * 0.85);
    }
    ctx.stroke();
    if (progress !== null) {
      const cx = Math.min(1, Math.max(0, progress)) * cw;
      ctx.strokeStyle = pg || "#ef4444";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + 0.5, 0);
      ctx.lineTo(cx + 0.5, ch);
      ctx.stroke();
    }
  }, [peaks, active, progress, resizeKey]);

  if (!peaks?.length) return <div className="h-5 rounded" />;
  return (
    <div className="h-5 w-full rounded overflow-hidden">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
});

// ── 文件行数据 ──
interface FileRowData {
  files: FileMeta[];
  currentFilePath: string | null;
  tagsByPath: Record<string, TagEntry[]>;
  miniWaveforms: MiniWaveformMap;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  nameWidth: number;
  tagsWidth: number;
}

// ── 文件行 ──
function Row({
  index, style, files, currentFilePath, tagsByPath, miniWaveforms, currentTime, duration, isPlaying, nameWidth, tagsWidth,
}: { index: number; style: React.CSSProperties } & FileRowData) {
  const file = files[index];
  const active = currentFilePath === file.path;
  const fileTags = tagsByPath[file.path] ?? [];
  const progress = active && duration > 0 ? currentTime / duration : null;

  const handleRowClick = () => {
    // 行点击 = 从开头播放，清除任何等待的波形定位
    seekOnLoadPct.current = null;
    if (active) {
      usePlayerStore.getState().togglePlay();
    } else {
      usePlayerStore.getState().selectFile(file.name, file.path);
    }
  };

  const handleTagRemove = (e: React.MouseEvent, tag: TagEntry) => {
    e.stopPropagation();
    if (!tag.group) return;
    useTagStore.getState().handleRemoveTag(tag);
  };

  return (
    <div style={style} className="px-3">
      <div
        role="button" tabIndex={0}
        draggable
        onClick={handleRowClick}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleRowClick()}
        onDragStart={(e) => {
          e.preventDefault();
          dragOutFile(file.path);
        }}
        className={`flex items-center h-[44px] rounded px-2 gap-0 cursor-pointer transition-colors text-sm ${
          active ? "bg-primary/[0.06] border border-primary/20" : "hover:bg-muted/30 border border-transparent"
        }`}
      >
        {/* 列1：文件名 */}
        <div className="flex items-center gap-1 min-w-0 shrink-0" style={{ width: nameWidth }}>
          <FileAudio className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm">{file.name}</span>
        </div>

        {/* 列2：波形（点击定位播放） */}
        <div className="min-w-0 flex-1" onClick={(e) => {
          e.stopPropagation();
          const state = usePlayerStore.getState();
          const rect = e.currentTarget.getBoundingClientRect();
          const seekPct = (e.clientX - rect.left) / rect.width;
          // 如果这个文件还没有波形，触发紧急预载（Level 0）
          const miniWaveforms = useLibraryStore.getState().miniWaveforms;
          const setMiniWaveforms = useLibraryStore.getState().setMiniWaveforms;
          if (!miniWaveforms[file.path]?.length) {
            preloadSingleFile(file.path, miniWaveforms, setMiniWaveforms);
          }
          // 优先从缓存取 duration（预载器已存好），保底用 store 中上次播放的值
          const dur = fileDurationCache[file.path] ?? state.duration;
          if (state.currentFile?.path === file.path) {
            // 同一文件：直接定位，不需要重新加载
            seekOnLoadPct.current = null;
            if (dur > 0) state.seekToPercent(seekPct);
            if (!state.isPlaying) state.togglePlay();
          } else {
            // 不同文件：靠 selectFile + loadedmetadata 定位
            seekOnLoadPct.current = seekPct;
            state.selectFile(file.name, file.path);
          }
        }}>
          <TableMiniWaveform
            peaks={miniWaveforms[file.path]}
            active={active}
            progress={active && isPlaying ? progress : null}
            resizeKey={nameWidth + tagsWidth}
          />
        </div>

        {/* 列3：标签 */}
        <div className="flex items-center gap-0.5 overflow-hidden shrink-0" style={{ width: tagsWidth }}>
          {fileTags.slice(0, 2).map((tag, idx) => (
            <Badge key={idx} variant="outline"
              className="text-[10px] px-1 py-0 h-4 cursor-pointer hover:bg-destructive hover:text-destructive-foreground shrink-0"
              onClick={(e) => handleTagRemove(e, tag)}
            >{tag.value}</Badge>
          ))}
          {fileTags.length > 2 && (
            <span className="text-[10px] text-muted-foreground shrink-0">+{fileTags.length - 2}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 标签编辑器弹出（正常流布局，不再 absolute）──
function TagEditorPopup({ onClose }: { onClose: () => void }) {
  const currentFile = usePlayerStore((s) => s.currentFile);
  const tagsByPath = useLibraryStore((s) => s.tags);
  const selectedTagGroup = useTagStore((s) => s.selectedTagGroup);
  const newTagValue = useTagStore((s) => s.newTagValue);
  const setSelectedTagGroup = useTagStore((s) => s.setSelectedTagGroup);
  const setNewTagValue = useTagStore((s) => s.setNewTagValue);
  const handleAddTag = useTagStore((s) => s.handleAddTag);
  const handleRemoveTag = useTagStore((s) => s.handleRemoveTag);

  if (!currentFile) return null;
  const fileTags = tagsByPath[currentFile.path] ?? [];

  return (
    <div className="border-b bg-background px-4 py-2">
      {/* 已有标签 */}
      <div className="flex items-center gap-1 mb-2 flex-wrap">
        <span className="text-[10px] text-muted-foreground mr-1 shrink-0">标签：</span>
        {fileTags.length === 0 && <span className="text-[10px] text-muted-foreground">无</span>}
        {fileTags.map((tag, idx) => (
          <Badge key={idx} variant="secondary"
            className="text-[10px] px-1.5 py-0 h-4 cursor-pointer hover:bg-destructive hover:text-destructive-foreground shrink-0"
            onClick={() => handleRemoveTag(tag)}
          >{tag.value} <X className="h-2.5 w-2.5 ml-0.5" /></Badge>
        ))}
      </div>
      {/* 添加 */}
      <div className="flex items-center gap-1 flex-wrap">
        <select className="h-6 text-[11px] px-1 rounded border bg-background" value={selectedTagGroup}
          onChange={(e) => setSelectedTagGroup(e.target.value)}
        >
          {TAG_GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
        </select>
        <Input placeholder="标签值" value={newTagValue}
          onChange={(e) => setNewTagValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
          className="h-6 w-24 text-[11px]"
        />
        <Button size="sm" className="h-6 text-[11px] px-2" onClick={() => handleAddTag()}>添加</Button>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onClose}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// ── 拖拽条（列与列之间）──
function DragHandle({ onResizeStart }: { onResizeStart: (e: React.MouseEvent) => void }) {
  return (
    <div
      className="shrink-0 self-stretch w-2 cursor-col-resize hover:bg-primary/30 active:bg-primary/60 rounded"
      onMouseDown={onResizeStart}
    />
  );
}

// ── 主组件 ──
export function FileListPanel() {
  const folderTree = useLibraryStore((s) => s.folderTree);
  const selectedFolderPath = useLibraryStore((s) => s.selectedFolderPath);
  const contentIndex = useLibraryStore((s) => s.contentIndex);
  const libTags = useLibraryStore((s) => s.tags);
  const nameSuggestions = useLibraryStore((s) => s.nameSuggestions);
  const miniWaveforms = useLibraryStore((s) => s.miniWaveforms);
  const setMiniWaveforms = useLibraryStore((s) => s.setMiniWaveforms);
  const librariesCount = useLibraryStore((s) => s.libraries.length);
  const libraryLoadStateStatus = useLibraryStore((s) => s.libraryLoadState.status);
  const searchQuery = useUiStore((s) => s.searchQuery);
  const currentFilePath = usePlayerStore((s) => s.currentFile?.path ?? null);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const tagFilters = useTagStore((s) => s.tagFilters);
  const currentFile = usePlayerStore((s) => s.currentFile);

  const [showTagEditor, setShowTagEditor] = useState(false);

  // 列宽状态
  const [colWidths, setColWidths] = useState(() => ({ ...colWidthRef }));

  // 同步到模块级 ref（Row 直接读取）
  useEffect(() => {
    colWidthRef.name = colWidths.name;
    colWidthRef.tags = colWidths.tags;
  }, [colWidths]);

  // 拖拽调整列宽
  const dragRef = useRef<{ col: string; startX: number; startW: number } | null>(null);
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      setColWidths((prev) => {
        const minW = 50;
        const dx = e.clientX - drag.startX;
        if (drag.col === "name") {
          const w = Math.max(minW, drag.startW + dx);
          colWidthRef.name = w;  // ← 立即同步 ref，行实时刷新
          return { ...prev, name: w };
        }
        if (drag.col === "tags") {
          const w = Math.max(minW, drag.startW - dx);
          colWidthRef.tags = w;  // ← 立即同步
          return { ...prev, tags: w };
        }
        return prev;
      });
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  // 筛选后的文件列表
  const filteredFiles = useMemo(() => {
    const visibleFiles = collectFilesForFolder(folderTree, selectedFolderPath);
    return buildFilteredFiles({
      visibleFiles, contentIndex, tags: libTags, nameSuggestions, searchQuery, tagFilters,
    });
  }, [folderTree, selectedFolderPath, contentIndex, libTags, nameSuggestions, searchQuery, tagFilters]);

  useMiniWaveformPreload({ filteredFiles, miniWaveforms, setMiniWaveforms });
  useBackgroundWaveformPreload({ allFiles: useLibraryStore.getState().allFiles, miniWaveforms, setMiniWaveforms });

  const rowData: FileRowData = {
    files: filteredFiles, currentFilePath, tagsByPath: libTags,
    miniWaveforms, currentTime, duration, isPlaying,
    nameWidth: colWidthRef.name, tagsWidth: colWidthRef.tags,
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* 标签编辑器（正常流布局，不重叠） */}
      {showTagEditor && <TagEditorPopup onClose={() => setShowTagEditor(false)} />}

      {/* 文件列表 */}
      <div className="flex-1 overflow-hidden bg-muted/5">
        {filteredFiles.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-16 text-muted-foreground">
            <Search className="h-8 w-8 mb-3" />
            <p className="text-sm">
              {libraryLoadStateStatus === "indexing" ? "正在建立索引..."
                : librariesCount > 0 ? "未找到匹配的素材" : "请在设置中添加素材库"}
            </p>
          </div>
        ) : (
          <>
            {/* 表头 */}
            <div className="flex items-center px-5 py-1 border-b text-[11px] text-muted-foreground">
              <span className="shrink-0" style={{ width: colWidths.name }}>文件名</span>
              <DragHandle onResizeStart={(e) => { dragRef.current = { col: "name", startX: e.clientX, startW: colWidths.name }; }} />
              <span className="flex-1 px-1">波形</span>
              <DragHandle onResizeStart={(e) => { dragRef.current = { col: "tags", startX: e.clientX, startW: colWidths.tags }; }} />
              <span className="shrink-0 flex items-center gap-1" style={{ width: colWidths.tags }}>
                标签
                {currentFile && (
                  <button
                    onClick={() => setShowTagEditor(!showTagEditor)}
                    className="ml-0.5 p-0.5 rounded hover:bg-muted/50 transition-colors"
                  >
                    <Tag className="h-3 w-3" />
                  </button>
                )}
              </span>
            </div>
            <List
              className="px-0 py-0"
              defaultHeight={600}
              rowCount={filteredFiles.length}
              rowHeight={ROW_HEIGHT}
              rowComponent={Row as any}
              rowProps={rowData}
              overscanCount={10}
              style={{ width: "100%", height: "100%" }}
            />
          </>
        )}
      </div>
    </div>
  );
}
