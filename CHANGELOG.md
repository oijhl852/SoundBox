# 修改记录 (CHANGELOG)

> 按时间倒序排列。设计文档只保留核心设计内容，修改记录统一记于此文件。

---

## 2026-05-20 — v1.3 第六轮修复（启动波形秒开）

**修改：** 解决每次启动波形全量重新加载的性能问题。新增 `batchPreloadWaveforms` IPC，素材库加载时一次性批量读取磁盘波形缓存并填入 `miniWaveforms`，避免逐文件 IPC 往返。

| 文件 | 修改 |
|------|------|
| `electron/ipc-handlers.ts` | 新增 `soundbox:batch-preload-waveforms` 处理器 |
| `electron/preload.ts` | 暴露 `batchPreloadWaveforms` |
| `src/lib/bridge-contract.ts` | 添加类型声明 |
| `src/lib/api.ts` | 添加 `batchPreloadWaveforms()` 调用 |
| `src/stores/libraryStore.ts` | 新增 `preloadWaveformCache` action，6 个调用点 |

**结果：** 80 测试全部通过。第二次启动同一素材库时波形立即可用，无需等待逐批加载。

---

## 2026-05-20 — v1.3 第五轮修复（领域特效层测试）

**修改：** 为审阅发现 0 覆盖的 4 个领域特效层文件补写测试。

| 文件 | 用例数 | 覆盖内容 |
|------|:---:|------|
| `library-domain-effects.test.ts` | 5 | 库添加（空名/取消/成功/参数传递）、库删除 |
| `tag-domain-effects.test.ts` | 5 | 添加标签（去重/跨文件同步）、删除标签、采纳建议 |
| `player-domain-effects.test.ts` | 3 | 波形加载成功/失败/任务过期 |
| `use-mini-waveform-preload.test.ts` | 4 | 单文件紧急预载/竞速回退/进度统计 |

**结果：** 新增 17 用例，总计 29 文件 80 用例全部通过。领域特效层从 0 覆盖提升到核心路径覆盖。

---

## 2026-05-20 — v1.3 第四轮修复（#18 架构注释）

**修改：** 为模块级可变状态添加架构说明注释。

| # | 修改 | 涉及文件 |
|---|------|----------|
| 18 | `seekOnLoadPct` 和 `urgentJobId`/`miniWaveformJobIdRef` 添加注释说明单实例设计意图及未来重构条件 | `src/lib/audio-element-effects.ts`、`src/lib/use-mini-waveform-preload.ts` |

**结果：** 63 测试全部通过。审阅问题修复率 17/19（#19 UX 优化暂缓，#9 ffmpeg 不适用）。

---

## 2026-05-20 — v1.3 第三轮修复（低优收尾）

**修改：** 修复剩余低优问题，涉及代码整洁性和健壮性。

| # | 修改 | 涉及文件 |
|---|------|----------|
| 13 | `FileListPanel` 17 个 Store 订阅用 `useShallow` 合并为 3 组 | `src/components/FileListPanel.tsx` |
| 16 | `libraryCacheRef` 添加 5 条目上限淘汰策略 | `src/stores/libraryStore.ts` |
| 17 | `uiStore.setShowDropInspector` 统一 setter 风格 | `src/stores/uiStore.ts` |

**结果：** 63 测试全部通过。

---

## 2026-05-20 — v1.3 第二轮修复（中优+低优）

**修改：** 修复审阅发现的中优和低优问题（#7~#17）。

| # | 修改 | 涉及文件 |
|---|------|----------|
| 7 | `rowData` 使用 `useMemo` 包裹 | `src/components/FileListPanel.tsx` |
| 8 | 消除重复函数：`createLibraryLoadErrorState` / `buildLibraryLoadingState` | `src/lib/app-effects.ts`、`src/lib/library-controller-state.ts`、`src/lib/library-domain-effects.ts` |
| 10 | 修复 `file-filtering.ts` 搜索大小写不一致 | `src/lib/file-filtering.ts` |
| 11 | 移除 `tag-domain-state.ts` 中 30 行无逻辑薄包装函数 | `src/lib/tag-domain-state.ts` |
| 12 | `logger.ts` 环境检测保留（`process.env.NODE_ENV` 跨 electron+browser 兼容） | 无需修改 |
| 14 | `as any` 加注释说明原因 | `src/components/FileListPanel.tsx` |
| 15 | 移除 `browser-waveform.ts` 无用 `logError` 导入 | `src/lib/browser-waveform.ts` |

**涉及测试：** `src/test/app-effects.test.ts`、`src/test/use-library-controller.test.ts`、`src/test/use-tag-controller.test.ts`

**结果：** 63 测试全部通过。

---

## 2026-05-20 — v1.3 全项目审阅与修复

**修改：** 对照 `design.md` 审阅全项目 95 个源码文件，修复 6 项高优问题。

| # | 修改 | 原因 | 涉及文件 |
|---|------|------|----------|
| 1 | `require()` → `await import()` | ESM 兼容性 | `src/lib/tag-domain-effects.ts` |
| 2 | `handleAddLibrary` 读取 `newLibName`/`newLibType` | UI 表单输入被忽略 | `src/stores/libraryStore.ts` |
| 3 | 添加 `logError` | 异常静默吞没 | `src/stores/libraryStore.ts` |
| 4 | 提取 `StatusBar` 组件 | 根组件频繁重渲染 | `src/components/StatusBar.tsx`（新）、`src/App.tsx` |
| 5 | `formatTime` 提取到 `lib/utils.ts` | 工具函数不应在 Store | `src/lib/utils.ts`、`src/stores/playerStore.ts` |
| 6 | 确认标签同步机制 | 误报，已有正确实现 | 无需修改 |

**结果：** 63 测试通过，0 lint 错误。审阅详情见 `AUDIT.md`。

---

## 2026-05-20 — v1.2 标签存储架构升级

**修改：** 从单一 `local-tags.json` 升级为分片目录存储。

- 每个 contentId 独立文件（`tags/content/{bucket}/{contentId}.json`）
- 原子写入：先写 `.tmp`，再 `rename` 覆盖
- 增量更新 Store（`updateTagsInPlace`），不重建快照
- 旧格式首次启动自动迁移
- 支持 `custom_tag_path` 可配置

**涉及文件：** `electron/tags.ts`、`electron/ipc-handlers.ts`、`src/lib/types.ts`、`src/lib/api.ts`、`src/lib/tag-domain-effects.ts`

---

## 2026-05-16 — v1.1 播放架构重构与稳定性修复

**修改：**

- **波形缓存稳定性**：contentId 哈希移除 mtimeMs，解决跨 session 失效
- **Range 协议**：`local-audio://` 新增 Content-Length + 206 响应
- **播放架构重构**：`selectFile` 为唯一控制中心，`audioLoadId` 代际隔离根除竞态
- **冗余清理**：移除 `resolveWaveformLoad`、`loadMetaForBatch`、`inspectAudioFile` 等无用调用
- **浏览器波形竞速**：`browserWaveform()` + `Promise.race`
- **音频格式扩展**：新增 .ogg .flac .aac 支持
- **代码清理**：删除 hooks/ 4 个死文件 + types.js 残留

**涉及文件：** `electron/protocols.ts`、`electron/waveform-cache.ts`、`src/stores/playerStore.ts`、`src/lib/browser-waveform.ts`、`src/lib/audio-element-effects.ts`、`src/lib/player-domain-effects.ts`

---

## 2026-05-10 — v1.0 初始版本

**内容：** 文件浏览器、波形播放器、标签管理、搜索过滤、索引系统、去重提示、波形缓存、文件拖出、素材库管理、Zustand 状态管理、表格视图、主题系统、三级波形预载、音量控件、界面重构

---

## 相关文档

| 文档 | 用途 |
|------|------|
| [design.md](./design.md) | 项目核心设计文档 |
| [AUDIT.md](./AUDIT.md) | 代码审阅记录与问题追踪 |
| [README.md](./README.md) | 项目介绍 |
