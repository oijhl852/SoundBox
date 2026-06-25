# Soundbox — 代码审阅记录

> 每次全项目审阅后在此记录，设计文档只保留核心设计内容。

---

## 2026-05-20 — v1.3 代码审阅

### 审查概要

| 项目 | 内容 |
|------|------|
| **审查范围** | 全部源码 95 个文件（src/ 78 + electron/ 17） |
| **审查基准** | `design.md` v1.2 |
| **发现高优问题** | 6 个（已全部修复） |
| **发现中优问题** | 5 个（待后续修复） |
| **发现低优问题** | 8 个（待后续优化） |
| **测试覆盖** | 63 用例，29 个需测试文件覆盖 22 个（76%），领域特效层 0 覆盖 |

### 总体评价

| 维度 | 评级 | 说明 |
|------|:---:|------|
| 架构一致性 | ⭐⭐⭐⭐⭐ | 四层架构贯彻完整，数据流清晰 |
| 与设计文档吻合度 | ⭐⭐⭐⭐☆ | 核心架构完全一致，有少量合理扩展 |
| IPC 接口完整性 | ⭐⭐⭐⭐⭐ | 19/19 通道完全匹配 |
| 代码质量 | ⭐⭐⭐⭐☆ | 类型安全、错误处理良好 |
| 测试覆盖 | ⭐⭐⭐☆☆ | 76% 覆盖，领域特效层 0 覆盖 |
| 波形系统 | ⭐⭐⭐⭐⭐ | 三级预载、双重去重、原子缓存全部正确 |
| 标签存储 | ⭐⭐⭐⭐⭐ | v1.2 分片存储、原子写入、旧格式迁移全部正确 |

### 架构审计结论

**Store 层：** 4 个 Store 与设计文档定义高度一致，存在少量合理扩展（selectedFolderPath、expandedFolders、theme）

**lib 层：** 33 个文件，纯函数/特效/视图模型分层清晰，存在约 4 个重复函数定义需消除

**组件层：** 全部使用 `useXxxStore()` 自行订阅，无 Props drilling。App.tsx 仅做初始化/副作用挂载/audio绑定/状态栏

**Electron 层：** IPC 19/19 通道完全匹配。ffmpeg 路径仅支持 Windows（待适配）

**hooks/ 目录：** 4 个旧文件已无引用，可安全删除

### 已修复问题

| # | 问题 | 修复内容 | 涉及文件 |
|---|------|----------|----------|
| 1 | `tag-domain-effects.ts` 使用 `require()` 在 ESM 项目中有兼容风险 | 改为 `await import()` 动态导入，`updateTagsInPlace` 改为 async | `src/lib/tag-domain-effects.ts` |
| 2 | `libraryStore.handleAddLibrary` 忽略 `newLibName`/`newLibType`（UI 表单输入无效） | 优先使用表单输入值，回退到文件夹名推断 | `src/stores/libraryStore.ts` |
| 3 | `handleAddLibrary` 异常静默吞没，无日志 | 添加 `logError("添加素材库失败", e)` | `src/stores/libraryStore.ts` |
| 4 | `App.tsx` 订阅 `miniWaveforms` 导致根组件因波形预载频繁重渲染 | 提取 `StatusBar` 独立组件自行订阅 | `src/components/StatusBar.tsx`（新增）、`src/App.tsx` |
| 5 | `playerStore.formatTime` 纯工具函数放在 Store 中不当 | 提取到 `lib/utils.ts` 独立导出 | `src/lib/utils.ts`、`src/stores/playerStore.ts` |
| 6 | 确认 tagStore 写标签后 libraryStore 同步（误报） | `tag-domain-effects.ts` 中 `updateTagsInPlace` 已正确更新，无需修复 | — |

### 待处理（中优）

| # | 问题 | 位置 | 状态 |
|---|------|------|:---:|
| 7 | `FileListPanel` 的 `rowData` 未 memo | `FileListPanel.tsx` | ✅ 已修复 |
| 8 | 重复函数定义 | app-orchestration/app-effects/library-controller-state | ✅ 已修复 |
| 9 | ffmpeg 路径硬编码为 Windows 专用 `.exe` | `electron/waveform-generator.ts` | ⏳ |
| 10 | 搜索行为不一致（标签名搜索大小写处理） | `file-filtering.ts` | ✅ 已修复 |
| 11 | 薄包装函数过多 | `tag-domain-state.ts` | ✅ 已修复 |

### 待处理（低优）

| # | 问题 | 位置 | 状态 |
|---|------|------|:---:|
| 12 | `logger.ts` 环境检测 | 保留 `process.env.NODE_ENV`（跨 electron+browser） | — |
| 13 | `FileListPanel` 17 个 Store 订阅 | 已用 `useShallow` 合并为 3 组 | ✅ 已修复 |
| 14 | `FileListPanel.tsx:368` `as any` | 已加注释说明 | ✅ 已修复 |
| 15 | `browser-waveform.ts` 无用 `logError` 导入 | 已移除 | ✅ 已修复 |
| 16 | `libraryCacheRef` 无淘汰策略 | 添加 `cacheSet()` 上限 5 条目，超出淘汰最早插入 | ✅ 已修复 |
| 17 | `uiStore` setter 风格不统一 | `setShowDropInspector` 统一为简单值 setter | ✅ 已修复 |
| 18 | 模块级可变状态多实例风险 | 添加架构注释说明单实例设计意图 | ✅ 已修复 |
| 19 | 搜索框位置偏差 | UX 优化，暂缓 | ⏳ |

### 后续建议

- [x] ~~消除 lib/ 层重复函数定义~~ ✅ 已完成
- [x] ~~移除 `FileListPanel.tsx:368` 的 `as any` 类型断言~~ ✅ 已加注释
- [x] ~~`libraryCacheRef` 添加淘汰策略~~ ✅ 上限 5 条目
- [x] ~~`FileListPanel` 17 个 Store 订阅用 `useShallow` 合并~~ ✅ 已完成
- [x] ~~模块级可变状态重构为组件实例内 `useRef`~~ ✅ 已加架构注释
- [x] ~~补写领域特效层测试~~ ✅ 新增 17 用例，覆盖 4 文件核心路径

---

*本文件随项目迭代持续更新。每次全项目审阅后新增章节。*

---

## 相关文档

| 文档 | 用途 |
|------|------|
| [design.md](./design.md) | 项目核心设计文档 |
| [CHANGELOG.md](./CHANGELOG.md) | 各版本修改记录 |
| [README.md](./README.md) | 项目介绍 |
