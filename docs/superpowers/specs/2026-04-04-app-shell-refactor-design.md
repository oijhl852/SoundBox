# Soundbox `App.tsx` 彻底拆分设计

## 目标

将 `src/App.tsx` 从当前的“超级组件”收口为真正的页面壳与顶层装配器：只负责组织页面结构、连接少量顶层状态入口、把明确的 props 传给组件，不再直接承载核心业务编排、异步流程、事件绑定和缓存协调。

本次重构不以新增功能为目标，只以“让当前代码结构成熟可持续”为目标。最终成果必须满足：
- `App.tsx` 不再直接承载主要异步编排流程
- 播放、素材库、标签、mini waveform、拖放调试、侧边栏拖拽等职责分别归位
- 现有组件继续复用，不进行无意义 UI 改写
- 新增与调整后的逻辑具备真实测试护栏

---

## 当前问题

当前 `App.tsx` 同时承担了以下职责：
- 启动时加载设置与同步状态
- 素材库切换、缓存命中、后台补建索引
- 音频元素事件绑定与播放状态同步
- 标签增删与建议采纳后的快照刷新
- mini waveform 批量补建
- 拖放调试状态轮询
- 侧边栏宽度拖动
- 页面级 UI 装配

虽然已有 `src/lib/app-effects.ts`、`src/lib/app-shell-actions.ts`、`src/lib/app-orchestration.ts`、`src/lib/library-management-actions.ts` 等模块，但 `App.tsx` 仍然保留了大量 effect、ref、异步回调与跨域协调逻辑，导致：
- 读一遍文件无法快速看清主流程
- effect 与业务动作纠缠，测试边界不够清晰
- 一处修改容易影响多条行为链路
- 新逻辑容易再次回流到顶层

---

## 设计原则

### 1. `App.tsx` 只做装配
`App.tsx` 最终只保留：
- 页面级 UI 显示状态
- 少量基础输入状态
- 调用顶层 controller / hook
- 将结果传给组件

### 2. React 生命周期逻辑进入 controller / hook
凡是以下内容，优先迁出 `App.tsx`：
- `useEffect` 中的异步与事件绑定
- 和 `ref` 强绑定的宿主协调逻辑
- 需要缓存、竞态保护、轮询、批处理的逻辑

### 3. 纯规则继续放在 `src/lib/*.ts`
继续沿用当前结构：
- 纯函数、状态转换、规则判断，优先放在现有 `src/lib/*.ts`
- hook / controller 只做 orchestration，不承载复杂规则

### 4. 组件保持展示职责
现有组件不作为本次重构重点，不把复杂逻辑重新塞进组件内部。

### 5. 测试围绕边界补齐
每迁出一类职责，都补对应测试，尤其覆盖：
- bootstrap 与 library controller
- player controller
- tag controller
- mini waveform controller
- drag debug controller
- sidebar resize controller

---

## 目标结构

### 顶层页面壳
- `src/App.tsx`

职责：
- 组织页面结构
- 连接各 controller / hook
- 输出 props 给 `LibrarySidebar`、`FileListPanel`、`WaveformPlayer`、`TagInspector`、`SettingsDialog`

### 顶层 orchestration / hook 层
计划新增：
- `src/lib/use-app-bootstrap.ts`
- `src/lib/use-library-controller.ts`
- `src/lib/use-player-controller.ts`
- `src/lib/use-tag-controller.ts`
- `src/lib/use-mini-waveforms.ts`
- `src/lib/use-drag-debug.ts`
- `src/lib/use-sidebar-resize.ts`

职责划分：
- `use-app-bootstrap.ts`
  - 启动读取 `loadSettings` 与 `getSyncStatus`
  - 输出 bootstrap 初始状态
- `use-library-controller.ts`
  - 管理 library cache、requestId、快照应用、切库、增删库、背景索引
- `use-player-controller.ts`
  - 管理 `audioRef`、音频事件绑定、资源加载、播放/暂停/静音/seek/音量
- `use-tag-controller.ts`
  - 管理标签编辑相关输入、增删标签、采纳建议、刷新快照
- `use-mini-waveforms.ts`
  - 管理 mini waveform 缺失检测与批量补全
- `use-drag-debug.ts`
  - 管理拖放调试状态轮询
- `use-sidebar-resize.ts`
  - 管理侧边栏拖拽状态与 mousemove/mouseup 生命周期

### 继续复用的纯逻辑层
已存在并继续作为基础：
- `src/lib/app-orchestration.ts`
- `src/lib/app-shell-actions.ts`
- `src/lib/library-management-actions.ts`
- `src/lib/library-actions.ts`
- `src/lib/player-state.ts`
- `src/lib/player-actions.ts`
- `src/lib/tag-actions.ts`
- `src/lib/file-filtering.ts`
- `src/lib/file-list-state.ts`
- `src/lib/library-state.ts`
- `src/lib/drag-state.ts`
- `src/lib/tag-inspector-state.ts`
- `src/lib/drop-inspector-state.ts`

这些模块继续负责：
- 状态转换
- 条件判断
- 数据派生
- 规则层收口

---

## 分阶段实施策略

### 阶段 1：先收口 library flow
目标：先把最重的素材库编排从 `App.tsx` 抽走。

包括：
- `applySnapshot`
- `clearLibraryView`
- `selectLibrary`
- 启动 bootstrap
- `handleAddLibrary`
- `handleRemoveLibrary`
- library cache / requestId refs

完成后，`App.tsx` 不再直接持有素材库异步编排。

### 阶段 2：收口 player flow
包括：
- audio 事件监听绑定
- 资源加载与 `resolveWaveformLoad`
- play / pause / mute / seek / volume
- 播放器显示状态输出

完成后，`App.tsx` 只消费播放器 controller 返回值。

### 阶段 3：收口 tag flow
包括：
- tag editor 开关和输入状态
- 添加标签
- 删除标签
- 采纳建议
- 调用 library refresh

完成后，标签相关动作从页面壳移除。

### 阶段 4：收口 mini waveform / drag debug / sidebar resize
包括：
- mini waveform 批量补齐 effect
- drag debug polling effect
- 侧边栏拖动 effect

完成后，`App.tsx` 只保留简单布尔 UI 状态与派生值。

### 阶段 5：最终清理 `App.tsx`
包括：
- 精简 import
- 清理不再需要的 refs / callbacks
- 对 props 进行最终整理
- 跑测试与 lint 验证

---

## 验收标准

当以下条件同时满足时，认为拆分完成：

1. `App.tsx` 不再直接实现主异步编排逻辑
2. 页面中主要 `useEffect` 已迁移到专属 hook / controller
3. 库管理、播放、标签、mini waveform、drag debug、sidebar resize 都有明确归属
4. 纯规则仍留在 `src/lib/*.ts`，未被塞回 hook
5. 相关测试通过
6. `npm run test`、`npm run lint`、`npm run electron:build` 能提供新的验证证据

---

## 非目标

本次不做：
- 新功能扩张
- 组件视觉重做
- Electron 宿主层大规模重写
- 同步系统补完
- `contentId` 策略改造

本次只解决：`App.tsx` 必须彻底拆到位。
