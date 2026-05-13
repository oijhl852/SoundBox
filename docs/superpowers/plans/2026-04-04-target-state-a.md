# Target State A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Soundbox 收口到“稳定可持续开发版”，在不推翻现有 Electron 主线的前提下完成文档校准、前端业务层拆分、宿主服务化和测试护栏补强。

**Architecture:** 以当前已存在的 `file-filtering`、`library-state`、虚拟列表和 bridge 测试为起点，不重复已经落地的工作。后续围绕“文档先对齐事实 → `App.tsx` 继续下沉为编排层 → `electron/main.ts` 继续收口为入口/路由层 → 测试围住新边界”推进，优先整理当前真实代码而不是追求与旧计划逐字一致。

**Tech Stack:** Electron、React 19、TypeScript、Vitest、react-window、Vite

> 2026-04-04 审查补充：本计划已按仓库当前真实状态修订。`src/lib/file-filtering.ts`、`src/lib/library-state.ts`、`src/test/file-filtering.test.ts`、`src/test/library-state.test.ts`、`src/test/p0-bridge-and-race.test.ts`、`src/test/p0-app-logic.test.ts` 与虚拟列表已经存在，后续任务不再按“从零创建”表述，而是改为继续完善和向下一层拆分。

---

## File Structure

### Existing files to modify
- `src/App.tsx`
  - 当前主编排组件；目标是收口为页面装配和顶层状态协调，移除可提纯的计算逻辑。
- `src/components/FileListPanel.tsx`
  - 当前文件列表与小波形展示组件；目标是接入真实虚拟列表并保持当前交互。
- `src/lib/api.ts`
  - Electron bridge；保持桥接契约稳定，与测试对齐。
- `src/lib/types.ts`
  - 类型定义；如新增纯逻辑辅助函数或组件 props 类型，需要在此收口共享类型。
- `src/test/core-logic.test.ts`
  - 现有示例测试；目标是替换部分占位断言为真实逻辑测试。
- `src/test/p0-app-logic.test.ts`
  - 已有状态守卫测试；继续扩展为真实过滤/派生逻辑测试。
- `src/test/p0-bridge-and-race.test.ts`
  - 现有 bridge 契约测试；继续保持与实际桥接一致。
- `electron-migration-log.md`
  - 记录达到目标状态 A 的阶段性收口结果。
- `P0-P1-fix-summary.md`
  - 如有必要继续修正文档表述，使其与最终状态一致。

### New files already added in this stage
- `src/lib/file-filtering.ts`
  - 纯函数模块，承载文件过滤、标签可见性、重复标记派生等逻辑。
- `src/lib/library-state.ts`
  - 纯函数模块，承载素材库快照应用相关的纯数据转换逻辑。
- `src/lib/player-state.ts`
  - 播放器状态纯转换模块。
- `src/lib/player-actions.ts`
  - seek、音量与加载守卫等播放行为纯函数模块。
- `src/lib/library-actions.ts`
  - 素材库请求守卫与后台索引触发规则模块。
- `src/lib/file-list-state.ts`
  - 目录树到文件列表的派生状态模块。
- `src/lib/tag-actions.ts`
  - 标签 contentId 解析与建议显示规则模块。
- `src/lib/drag-state.ts`
  - 顶层拖放摘要派生模块。
- `src/lib/tag-inspector-state.ts`
  - 标签面板视图模型模块。
- `src/lib/drop-inspector-state.ts`
  - 拖放观察窗口事件与调试派生模块。
- `electron/library.ts`
  - 宿主层设置、索引、快照与元数据服务模块。
- `electron/tags.ts`
  - 宿主层标签服务模块。
- `electron/protocols.ts`
  - 本地协议与拖放服务模块。
- `src/test/file-filtering.test.ts`
- `src/test/library-state.test.ts`
- `src/test/player-state.test.ts`
- `src/test/library-actions.test.ts`
- `src/test/tag-and-drag-state.test.ts`
- `src/test/tag-inspector-state.test.ts`
- `src/test/drop-inspector-state.test.ts`


### Optional file to create only if needed
- `src/components/FileListRow.tsx`
  - 如果接入虚拟列表后 `FileListPanel.tsx` 过长，则拆出单行渲染组件。

---

## Task 1: 提取 `App.tsx` 中的纯过滤逻辑

**Files:**
- Create: `src/lib/file-filtering.ts`
- Modify: `src/App.tsx`
- Test: `src/test/file-filtering.test.ts`

- [ ] **Step 1: 写失败测试，覆盖当前目录文件过滤与标签派生**

```ts
import { describe, expect, it } from "vitest";
import { buildFilteredFiles, collectVisibleTags } from "@/lib/file-filtering";
import type { FileMeta, NameTagSuggestion, TagEntry } from "@/lib/types";

const files: FileMeta[] = [
  { name: "A Hit.wav", path: "A", folder: "fx", contentId: "cid-a" },
  { name: "B Ambience.wav", path: "B", folder: "amb", contentId: "cid-b" },
];

const tags: Record<string, TagEntry[]> = {
  A: [{ value: "激昂", author: "user", createdAt: "2026-04-04T00:00:00.000Z" }],
};

const suggestions: Record<string, NameTagSuggestion> = {
  B: {
    normalizedName: "b ambience",
    tags: [{ group: "mood", value: "悬疑" }],
    sourceContentIds: ["cid-x"],
    confidence: 0.6,
    sourceSummary: "hint",
  },
};

describe("file-filtering", () => {
  it("prefers actual tags and filters by search + tag selection", () => {
    const result = buildFilteredFiles({
      visibleFiles: files,
      contentIndex: {
        version: "2.0",
        contents: {
          "cid-a": { canonicalName: "A Hit.wav", instances: ["1", "2"] },
          "cid-b": { canonicalName: "B Ambience.wav", instances: ["3"] },
        },
      },
      tags,
      nameSuggestions: suggestions,
      searchQuery: "激昂",
      tagFilters: new Set(["激昂"]),
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.path).toBe("A");
  });

  it("collects visible tags from actual tags first, then suggestions", () => {
    const result = collectVisibleTags({
      visibleFiles: files,
      tags,
      nameSuggestions: suggestions,
    });

    expect(result).toEqual(["悬疑", "激昂"]);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm test -- src/test/file-filtering.test.ts`
Expected: FAIL，提示 `Cannot find module '@/lib/file-filtering'` 或导出不存在

- [ ] **Step 3: 写最小实现，提取过滤逻辑到 `src/lib/file-filtering.ts`**

```ts
import type { ContentIndexFile, FileMeta, NameTagSuggestion, TagEntry } from "@/lib/types";

type BuildFilteredFilesInput = {
  visibleFiles: FileMeta[];
  contentIndex: ContentIndexFile | null;
  tags: Record<string, TagEntry[]>;
  nameSuggestions: Record<string, NameTagSuggestion>;
  searchQuery: string;
  tagFilters: Set<string>;
};

type CollectVisibleTagsInput = {
  visibleFiles: FileMeta[];
  tags: Record<string, TagEntry[]>;
  nameSuggestions: Record<string, NameTagSuggestion>;
};

function getSearchableTags(
  filePath: string,
  tags: Record<string, TagEntry[]>,
  nameSuggestions: Record<string, NameTagSuggestion>
) {
  const actualTags = tags[filePath] ?? [];
  const suggestedTags = nameSuggestions[filePath]?.tags ?? [];
  return actualTags.length > 0 ? actualTags : suggestedTags;
}

export function buildFilteredFiles({
  visibleFiles,
  contentIndex,
  tags,
  nameSuggestions,
  searchQuery,
  tagFilters,
}: BuildFilteredFilesInput): FileMeta[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return visibleFiles.filter((file) => {
    const duplicateCount = file.contentId ? contentIndex?.contents[file.contentId]?.instances.length ?? 0 : 0;
    const duplicateLabel = duplicateCount > 1 ? `重复 ${duplicateCount}` : "";
    const searchableTags = getSearchableTags(file.path, tags, nameSuggestions);

    const matchesSearch = normalizedQuery
      ? file.name.toLowerCase().includes(normalizedQuery) ||
        duplicateLabel.includes(searchQuery) ||
        searchableTags.some((tag) => tag.value.toLowerCase().includes(normalizedQuery))
      : true;

    const matchesTags = tagFilters.size > 0
      ? searchableTags.some((tag) => tagFilters.has(tag.value))
      : true;

    return matchesSearch && matchesTags;
  });
}

export function collectVisibleTags({
  visibleFiles,
  tags,
  nameSuggestions,
}: CollectVisibleTagsInput): string[] {
  const values = new Set<string>();

  for (const file of visibleFiles) {
    for (const tag of getSearchableTags(file.path, tags, nameSuggestions)) {
      values.add(tag.value);
    }
  }

  return [...values].sort((a, b) => a.localeCompare(b, "zh-CN"));
}
```

- [ ] **Step 4: 在 `src/App.tsx` 中改用新纯函数**

将当前 `filteredFiles` 和 `allUniqueTags` 的 `useMemo` 改为调用：

```ts
const filteredFiles = useMemo(() => {
  return buildFilteredFiles({
    visibleFiles,
    contentIndex,
    tags,
    nameSuggestions,
    searchQuery,
    tagFilters,
  });
}, [visibleFiles, contentIndex, tags, nameSuggestions, searchQuery, tagFilters]);

const allUniqueTags = useMemo(() => {
  return collectVisibleTags({
    visibleFiles,
    tags,
    nameSuggestions,
  });
}, [visibleFiles, tags, nameSuggestions]);
```

并在顶部补导入：

```ts
import { buildFilteredFiles, collectVisibleTags } from "./lib/file-filtering";
```

- [ ] **Step 5: 运行测试，确认通过**

Run: `npm test -- src/test/file-filtering.test.ts`
Expected: PASS

- [ ] **Step 6: 运行相关全量测试，确认无回归**

Run: `npm test`
Expected: PASS

---

## Task 2: 提取素材库快照应用的纯转换逻辑

**Files:**
- Create: `src/lib/library-state.ts`
- Modify: `src/App.tsx`
- Test: `src/test/library-state.test.ts`

- [ ] **Step 1: 写失败测试，覆盖快照转前端状态数据**

```ts
import { describe, expect, it } from "vitest";
import { deriveLibraryStateFromSnapshot } from "@/lib/library-state";

const snapshot = {
  tree: {
    name: "Root",
    path: "D:/lib",
    children: [],
    files: [{ name: "A.wav", path: "D:/lib/A.wav", extension: "wav", size: 1, contentId: "cid-a" }],
  },
  contentIndex: { version: "2.0", contents: {} },
  localTags: {
    version: "2.0",
    contents: {
      "cid-a": {
        tags: {
          mood: [{ value: "激昂", author: "user", createdAt: "2026-04-04T00:00:00.000Z" }],
        },
      },
    },
  },
  nameSuggestions: {},
  usedCache: true,
  indexingComplete: true,
} as const;

describe("library-state", () => {
  it("derives files, tags and load state from snapshot", () => {
    const result = deriveLibraryStateFromSnapshot(snapshot, {});

    expect(result.folderTree).toEqual([snapshot.tree]);
    expect(result.files).toEqual([
      { name: "A.wav", path: "D:/lib/A.wav", folder: "Root", contentId: "cid-a" },
    ]);
    expect(result.tagsByPath["D:/lib/A.wav"]?.[0]?.value).toBe("激昂");
    expect(result.libraryLoadState.status).toBe("ready");
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm test -- src/test/library-state.test.ts`
Expected: FAIL，提示 `Cannot find module '@/lib/library-state'`

- [ ] **Step 3: 写最小实现，创建 `src/lib/library-state.ts`**

```ts
import type { LibraryLoadState, LibrarySnapshot, MiniWaveformMap, TagEntry, FileMeta, FolderNode } from "@/lib/types";

type DerivedLibraryState = {
  folderTree: FolderNode[];
  expandedFolders: Set<string>;
  selectedFolderPath: string;
  files: FileMeta[];
  tagsByPath: Record<string, TagEntry[]>;
  miniWaveforms: MiniWaveformMap;
  libraryLoadState: LibraryLoadState;
};

export function deriveLibraryStateFromSnapshot(
  snapshot: LibrarySnapshot,
  previousMiniWaveforms: MiniWaveformMap,
  previousSelectedFolderPath?: string | null
): DerivedLibraryState {
  const tree = snapshot.tree;
  const tagsByContentId = snapshot.localTags?.contents ?? {};
  const tagsByPath: Record<string, TagEntry[]> = {};
  const files: FileMeta[] = [];

  const collectFiles = (node: FolderNode, folderName: string) => {
    for (const file of node.files) {
      files.push({ name: file.name, path: file.path, folder: folderName, contentId: file.contentId });
      if (file.contentId && tagsByContentId[file.contentId]) {
        const tagList: TagEntry[] = [];
        for (const [group, entries] of Object.entries(tagsByContentId[file.contentId].tags as Record<string, TagEntry[]>)) {
          tagList.push(...entries.map((entry) => ({ ...entry, group })));
        }
        tagsByPath[file.path] = tagList;
      }
    }

    for (const child of node.children) {
      collectFiles(child, child.name);
    }
  };

  collectFiles(tree, tree.name);

  const miniWaveforms: MiniWaveformMap = {};
  for (const file of files) {
    if (previousMiniWaveforms[file.path]?.length) {
      miniWaveforms[file.path] = previousMiniWaveforms[file.path];
    }
  }

  return {
    folderTree: [tree],
    expandedFolders: new Set([tree.path]),
    selectedFolderPath:
      previousSelectedFolderPath && previousSelectedFolderPath.startsWith(tree.path)
        ? previousSelectedFolderPath
        : tree.path,
    files,
    tagsByPath,
    miniWaveforms,
    libraryLoadState: {
      status: snapshot.indexingComplete ? "ready" : "indexing",
      usedCache: snapshot.usedCache,
      indexingComplete: snapshot.indexingComplete,
      message: snapshot.usedCache
        ? "已从本地索引恢复素材列表"
        : snapshot.indexingComplete
          ? "已完成完整索引构建"
          : "已加载目录和文件列表，正在后台补建索引...",
    },
  };
}
```

- [ ] **Step 4: 在 `src/App.tsx` 中替换 `applySnapshot` 的内联转换**

将 `applySnapshot` 内部的大段数据转换替换为：

```ts
const derived = deriveLibraryStateFromSnapshot(
  snapshot,
  miniWaveformsRef.current,
  selectedFolderPathRef.current
);

setFolderTree(derived.folderTree);
setExpandedFolders(derived.expandedFolders);
setSelectedFolderPath(derived.selectedFolderPath);
setContentIndex(snapshot.contentIndex);
setTags(derived.tagsByPath);
setNameSuggestions(snapshot.nameSuggestions);
setAllFiles(derived.files);
setMiniWaveforms(derived.miniWaveforms);
setLibraryLoadState(derived.libraryLoadState);
```

必要时新增：

```ts
const selectedFolderPathRef = useRef<string | null>(null);
useEffect(() => {
  selectedFolderPathRef.current = selectedFolderPath;
}, [selectedFolderPath]);
```

并补导入：

```ts
import { deriveLibraryStateFromSnapshot } from "./lib/library-state";
```

- [ ] **Step 5: 运行测试，确认通过**

Run: `npm test -- src/test/library-state.test.ts`
Expected: PASS

- [ ] **Step 6: 运行全量测试，确认无回归**

Run: `npm test`
Expected: PASS

---

## Task 3: 接入真实虚拟列表

**Files:**
- Modify: `src/components/FileListPanel.tsx`
- Optional Create: `src/components/FileListRow.tsx`
- Test: `src/test/core-logic.test.ts`

- [ ] **Step 1: 写失败测试，确认列表为空状态与搜索栏仍可渲染**

```ts
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FileListPanel } from "@/components/FileListPanel";

describe("FileListPanel", () => {
  it("renders empty state when there are no files", () => {
    render(
      <FileListPanel
        searchQuery=""
        filteredFiles={[]}
        currentFilePath={null}
        librariesCount={1}
        libraryLoadStateStatus="ready"
        contentIndex={null}
        tags={{}}
        nameSuggestions={{}}
        miniWaveforms={{}}
        currentTime={0}
        duration={0}
        onSearchChange={() => {}}
        onSelectFile={() => {}}
      />
    );

    expect(screen.getByPlaceholderText("搜索文件名、标签或氛围...")).toBeInTheDocument();
    expect(screen.getByText("未找到匹配的素材")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试，确认失败或尚未覆盖虚拟列表重构**

Run: `npm test -- src/test/core-logic.test.ts`
Expected: 若当前测试文件仍为占位，则先失败于找不到断言内容或未包含组件测试

- [ ] **Step 3: 替换 `src/test/core-logic.test.ts` 中占位测试为真实组件测试**

把原有 `expect(true).toBe(true)` 中至少一组替换为上面的 `FileListPanel` 渲染测试，并保留 bridge / cache 等测试位置为后续任务使用。

- [ ] **Step 4: 在 `FileListPanel.tsx` 中接入 `react-window` 的 `FixedSizeList`**

核心实现要求：
- 用 `AutoSizer` 不可用时，自己用容器高度测量
- 保持顶部搜索栏和底部空状态逻辑不变
- 每行高度固定，例如 `156` 或当前卡片真实高度
- 只把滚动区内容改成虚拟列表，不改业务交互契约

建议最小结构：

```ts
const ITEM_HEIGHT = 156;

function Row({ index, style, data }: ListChildComponentProps<RowData>) {
  const file = data.files[index];
  return (
    <div style={style} className="px-3 pb-2">
      <FileCard ... />
    </div>
  );
}
```

并用 `ResizeObserver` 读取列表容器高度：

```ts
const containerRef = useRef<HTMLDivElement>(null);
const [listHeight, setListHeight] = useState(400);
```

- [ ] **Step 5: 如果 `FileListPanel.tsx` 过长，则拆出 `FileListRow.tsx`**

若文件超过约 350 行，创建：
- `src/components/FileListRow.tsx`

并把单行卡片渲染移入该文件。

- [ ] **Step 6: 运行测试，确认通过**

Run: `npm test -- src/test/core-logic.test.ts`
Expected: PASS

- [ ] **Step 7: 运行全量测试，确认无回归**

Run: `npm test`
Expected: PASS

---

## Task 4: 替换占位测试为真实 bridge / 纯逻辑测试

**Files:**
- Modify: `src/test/core-logic.test.ts`
- Modify: `src/test/p0-bridge-and-race.test.ts`
- Modify: `src/test/p0-app-logic.test.ts`

- [ ] **Step 1: 删除剩余 `expect(true).toBe(true)` 占位断言**

将以下测试文件内所有占位断言替换为真实断言：
- `src/test/core-logic.test.ts`
- `src/test/p0-bridge-and-race.test.ts`
- `src/test/p0-app-logic.test.ts`

- [ ] **Step 2: 补 bridge 缺失实现错误路径测试**

在 `src/test/p0-bridge-and-race.test.ts` 新增：

```ts
it("dragOutFile does not throw when bridge is missing", () => {
  Object.defineProperty(window, "soundbox", {
    configurable: true,
    value: {},
  });

  expect(() => dragOutFile("C:/demo/test.wav")).not.toThrow();
});
```

- [ ] **Step 3: 补素材库请求守卫测试**

在 `src/test/p0-app-logic.test.ts` 中把当前测试对齐到从 `src/lib/library-state.ts` 导出的逻辑，至少验证：
- 旧请求不会覆盖新请求
- 错误状态不会污染新库

- [ ] **Step 4: 运行测试，确认通过**

Run: `npm test`
Expected: PASS

---

## Task 5: 收敛日志与文档，宣布达到目标状态 A

**Files:**
- Modify: `electron-migration-log.md`
- Modify: `P0-P1-fix-summary.md`
- Modify: `electron/preload.ts`
- Modify: `src/lib/api.ts`
- Modify: `electron/main.ts`（仅在确实仍存在无必要高频日志时）

- [ ] **Step 1: 扫描并分类当前日志**

保留：
- 主进程启动失败
- 协议失败
- 波形生成失败
- 拖出链路关键错误

去掉或降级：
- 高频成功日志
- 初始化枚举日志
- 每次 UI 交互都会打印的无害日志

- [ ] **Step 2: 删除剩余无价值高频日志**

优先检查：
- `electron/preload.ts`
- `src/lib/api.ts`
- `src/components/FileListPanel.tsx`
- `electron/main.ts` 中仅用于一次性调试定位、当前已无必要保留的成功日志

- [ ] **Step 3: 更新迁移日志**

在 `electron-migration-log.md` 追加一节，内容至少包含：
- 目标状态 A 的定义
- 本轮完成的收口动作
- 当前已达到的程度
- 剩余不纳入 A 的事项（如 Premiere Pro 拖出兼容专项）

- [ ] **Step 4: 更新修复总结文档**

在 `P0-P1-fix-summary.md` 中补一段当前真实状态总结，明确：
- Zustand/hooks 草稿已移除
- 虚拟列表已正式接入（若 Task 3 完成）
- 测试基础设施已升级为部分真实测试

- [ ] **Step 5: 运行最终验证**

Run: `npm test && npm run electron:build`
Expected:
- `vitest` 全通过
- `electron:build` 全通过

- [ ] **Step 6: 人工确认达到目标状态 A 的标准**

核对以下清单：
- [ ] `App.tsx` 已降为编排层，纯逻辑已明显下沉
- [ ] `FileListPanel` 已真正虚拟化
- [ ] 核心逻辑已有真实自动化测试
- [ ] 日志、文档、代码状态一致
- [ ] 当前项目适合继续稳定加功能

---

## Self-Review

- Spec coverage: 已覆盖目标状态 A 的五个核心要求：架构收口、虚拟列表、真实测试、日志收敛、文档对齐。
- Placeholder scan: 无 `TODO`、`TBD`、`implement later` 一类占位描述；每个任务都给出文件、代码或命令。
- Type consistency: 所有新增模块围绕 `FileMeta`、`LibrarySnapshot`、`TagEntry`、`NameTagSuggestion`、`MiniWaveformMap` 现有类型展开，没有引入与当前代码风格冲突的新状态管理方案。
