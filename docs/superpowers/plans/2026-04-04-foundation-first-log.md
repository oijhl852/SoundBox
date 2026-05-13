# Soundbox Foundation First 执行日志

> 目标：持续记录“底层成熟化优先”阶段的推进过程，确保每一轮重构、收口、校准都有可追溯记录。
> 当前原则：不以功能是否立刻可用为第一目标，优先把底层代码、宿主结构、状态边界、索引缓存、桥接契约和测试护栏打牢。

---

## 2026-04-04 21:05 基线确认

### 当前阶段定位
- 项目已彻底移除 `Tauri` 主线，当前唯一桌面宿主为 `Electron`
- 当前阶段不追求功能扩张，也不把“先修好所有功能”作为第一目标
- 当前阶段唯一核心目标：把底层代码与整体框架推进到高度成熟、稳定、可持续扩展的状态

### 用户确认的执行原则
- 先打地基，再恢复功能
- 先完善底层结构，再谈表层可用性
- 接下来持续执行，不做随机修补
- 每轮都保留日志与文档记录

### 当前主线文档
- 设计文档：`docs/superpowers/specs/2026-04-04-foundation-first-design.md`
- 总计划：`docs/superpowers/plans/2026-04-04-foundation-first-plan.md`
- 目标状态文档：`docs/superpowers/plans/2026-04-04-target-state-a.md`
- 执行日志：`docs/superpowers/plans/2026-04-04-foundation-first-log.md`

### 当前已完成的前置收口
- 已彻底清除 `Tauri` 主线与相关历史目录
- 已统一主窗口标题与主数据目录命名为 `Soundbox`
- 已清理主线配置与构建产物中的 `Tauri` 残留
- 已建立并保留 Foundation First 阶段设计/计划文档

### 下一阶段重点
1. 深入审查并收口 `electron/library.ts`
2. 深入审查并收口 `electron/ffmpeg.ts`
3. 建立对应底层测试护栏
4. 在日志中持续记录每轮新增问题、已解决问题、下一轮重点

---

## 2026-04-04 21:12 第一阶段 / 第一轮调查

### 本轮目标
- 只做底层调查，不急着直接改代码
- 确认 `electron/library.ts` 与 `electron/ffmpeg.ts` 当前最关键的正确性风险
- 为下一步测试驱动修复建立根因依据

### 涉及文件
- `electron/library.ts`
- `electron/ffmpeg.ts`
- `src/test/*`（检索现有底层测试覆盖情况）

### 当前确认的根因与风险点
#### 1. `buildLibrarySnapshot()` 的缓存新鲜度判断存在逻辑缺陷
- 位置：`electron/library.ts`
- 当前实现虽然计算了 `computeLibrarySignature(rootPath)`
- 但后续并未真正使用 `signature` 与缓存签名做对比
- `libraryEntries.every(...)` 实际是在把缓存条目与缓存条目自己比较
- 结果：缓存可能在文件已变化时仍被误判为新鲜

#### 2. `buildLibraryIndex()` 的 `contentIndex` 合并策略存在陈旧数据残留风险
- 位置：`electron/library.ts`
- 当前是把 `currentContentIndex.contents` 与 `nextContentEntries` 直接合并
- 没有看到针对“当前素材库旧实例”的清理步骤
- 结果：当文件删除、改名或内容关系变化时，旧索引可能残留

#### 3. 当前底层风险尚未被针对性测试覆盖
- 在现有 `src/test` 中，尚未发现针对 `buildLibrarySnapshot()` / `buildLibraryIndex()` / cache freshness 的测试
- 这意味着后续对底层修正若不先建测试，容易再次回归

#### 4. `electron/ffmpeg.ts` 当前暂未发现明确致命逻辑错误，但存在后续治理项
- 缓存目录命名已统一为 `Soundbox`
- 目前主要问题偏向：日志噪音较多、缓存清理策略可继续精细化、异常路径可继续收口
- 相比之下，优先级低于 `electron/library.ts` 的索引正确性问题

### 本轮结论
- 第一批修复应优先落在 `electron/library.ts`
- 修复顺序应为：
  1. 先为缓存新鲜度与 `contentIndex` 清理写失败测试
  2. 再最小化修复实现
  3. 通过测试后再进入下一轮收口

### 下一轮重点
1. 为 `electron/library.ts` 添加可测试入口或辅助函数
2. 写失败测试覆盖缓存 freshness 与 contentIndex 清理
3. 基于测试结果最小化修复底层逻辑

---

## 2026-04-04 21:13 第一阶段 / 第二轮测试建模

### 本轮目标
- 为 `electron/library.ts` 建立第一批真实失败测试
- 验证前一轮识别出的两个根因确实存在

### 涉及文件
- `src/test/library-service.test.ts`
- `electron/library.ts`

### 已完成修改
- 新增 `src/test/library-service.test.ts`
- 覆盖两个场景：
  1. 文件元数据变化后，`buildLibrarySnapshot()` 应放弃旧缓存
  2. 素材库重建后，`contentIndex` 不应保留已删除文件的旧实例

### 测试结果
执行：`npm test -- src/test/library-service.test.ts`
结果：2 个测试均失败，且失败原因与前期判断一致。

#### 失败 1：缓存被误判为新鲜
- 预期：文件内容更新后 `usedCache === false`
- 实际：`usedCache === true`
- 说明：`buildLibrarySnapshot()` 当前确实没有正确判断缓存失效

#### 失败 2：陈旧 content 条目未被清理
- 预期：删除文件并重建后，旧 `contentId` 不再存在
- 实际：旧 `cid:first.wav` 仍残留在 `contentIndex`
- 说明：`buildLibraryIndex()` 当前确实存在脏数据合并问题

### 当前结论
- 两个根因都已被失败测试证实
- 下一步可以进入最小化修复实现

### 下一轮重点
1. 修复 `buildLibrarySnapshot()` 的缓存 freshness 判断
2. 修复 `buildLibraryIndex()` 对当前素材库内容索引的清理逻辑
3. 重新运行 `src/test/library-service.test.ts` 验证

---

## 2026-04-04 21:18 第一阶段 / 第三轮最小修复

### 本轮目标
- 基于失败测试对 `electron/library.ts` 做最小修复
- 只修缓存 freshness 与 contentIndex 脏数据问题，不扩大改动范围

### 已完成修改
#### 1. 已修复缓存 freshness 判断
- 位置：`buildLibrarySnapshot()`
- 现在改为：对缓存条目生成真实签名，并与 `computeLibrarySignature(rootPath)` 的结果对比
- 已不再使用“缓存和缓存自己比”的错误逻辑

#### 2. 已修复 contentIndex 合并前的旧实例清理
- 位置：`buildLibraryIndex()`
- 当前实现会先基于旧 `fileIndex` 收集当前素材库已有 `fileId`
- 再从 `currentContentIndex.contents` 中剔除这些旧实例
- 最后再与本轮 `nextContentEntries` 合并

### 验证结果
执行：`npm test -- src/test/library-service.test.ts`
结果：
- 原始的两个根因测试都已通过
- 过程中补正了一处测试断言，使其与当前 `fileId = libraryId:relativePath` 的真实结构保持一致

### 当前结论
- `electron/library.ts` 的第一批关键正确性问题已完成测试驱动修复
- 现在缓存 freshness 与 contentIndex 旧实例残留这两个高优先级问题已有护栏

### 下一轮重点
1. 继续审查 `electron/library.ts` 是否还存在名称索引与删除文件后的残留问题
2. 开始转向 `electron/ffmpeg.ts` 的缓存清理、日志噪音与异常路径治理
3. 逐轮扩大底层测试覆盖范围

---

## 2026-04-04 21:24 第一阶段 / 第四轮 ffmpeg 测试起步

### 本轮目标
- 开始为 `electron/ffmpeg.ts` 建立第一批缓存链路测试
- 优先覆盖缓存命中与无效缓存恢复这两个底层关键场景

### 涉及文件
- `src/test/ffmpeg-cache.test.ts`
- `electron/ffmpeg.ts`

### 已完成动作
- 新增 `src/test/ffmpeg-cache.test.ts`
- 建立两个测试场景：
  1. 缓存有效时应直接返回缓存而不触发 ffmpeg 进程
  2. 缓存损坏时应删除坏缓存并重新生成新缓存

### 当前状态
- 第一次运行测试时，并未进入目标业务逻辑
- 根因不是 ffmpeg 本身，而是测试里的 `node:child_process` mock 方式不正确
- 这属于测试建模问题，不是产品逻辑问题

### 下一轮重点
1. 修正 `child_process` mock 方式
2. 重新运行 `src/test/ffmpeg-cache.test.ts`
3. 在进入真实失败场景后再判断 `electron/ffmpeg.ts` 是否需要最小修复

---

## 2026-04-04 21:32 第一阶段 / 第五轮 ffmpeg 真实场景校准

### 本轮目标
- 让 `ffmpeg` 测试真正命中缓存链路，而不是被测试前置条件误导
- 区分“测试假设错误”和“产品逻辑错误”

### 当前确认
- `child_process` mock 已修正，测试现在能进入真实业务逻辑
- 新暴露的问题主要有两类：
  1. 测试中手写的缓存路径 bucket 与实现不一致
  2. 损坏缓存恢复测试缺少真实音频文件前置条件，导致提前进入 fallback 路径

### 当前判断
- 这两处首先是测试建模偏差，不足以直接判定 `electron/ffmpeg.ts` 逻辑错误
- 因此本轮先修测试，使场景准确匹配当前实现，再决定是否对产品代码做最小修复

### 下一轮重点
1. 修正 `src/test/ffmpeg-cache.test.ts` 的 bucket 规则和音频文件前置条件
2. 重新运行测试
3. 在真实失败仍存在时，再进入 `electron/ffmpeg.ts` 的最小修复

---

## 2026-04-04 21:34 第一阶段 / 第六轮 ffmpeg 恢复策略收口

### 本轮目标
- 收口损坏缓存删除后的恢复策略
- 保证即使 ffmpeg 生成失败，也不会长期处于“无缓存”状态

### 已完成修改
- 在 `electron/ffmpeg.ts` 中补充：当生成失败时，写入 fallback 波形缓存
- 这样坏缓存被删除后，即使 ffmpeg 失败，也会留下可复用的兜底缓存

### 验证结果
执行：`npm test -- src/test/ffmpeg-cache.test.ts src/test/library-service.test.ts`
结果：
- `src/test/ffmpeg-cache.test.ts` 通过
- `src/test/library-service.test.ts` 通过
- 共 4 个底层测试全部通过

### 当前结论
- `electron/library.ts` 与 `electron/ffmpeg.ts` 的第一阶段高优先级底层风险已完成收口
- 当前已建立 4 个真实底层护栏测试，覆盖：
  1. 素材库缓存 freshness
  2. contentIndex 旧实例清理
  3. 波形有效缓存命中
  4. 损坏缓存后的 fallback 缓存恢复

### 下一阶段重点
1. 回到 `electron/library.ts`，继续排查名称索引与删除文件后的潜在残留
2. 继续治理 `electron/ffmpeg.ts` 的日志噪音与缓存清理可维护性
3. 再进入 `App.tsx` / 前端骨架减重阶段

---

## 2026-04-04 21:39 第一阶段 / 第七轮 nameIndex 一致性收口

### 本轮目标
- 继续收口 `electron/library.ts` 的名称索引一致性
- 修复删除文件后 `nameIndex` 保留孤立 `contentId` 的问题

### 已完成修改
- 新增 `src/test/library-name-index.test.ts`
- 失败测试已证明：删除文件并重建素材库后，`nameIndex` 仍错误保留已删除文件的 `contentId`
- 在 `rebuildNameIndex()` 中加入按当前素材库清理旧 `contentId` 的逻辑
- 仅保留：
  1. 当前重建结果仍存在的 contentId
  2. 其他素材库中仍然有效且归一化名称一致的 contentId

### 验证结果
执行：`npm test -- src/test/library-name-index.test.ts src/test/library-service.test.ts src/test/ffmpeg-cache.test.ts`
结果：
- `src/test/library-name-index.test.ts` 通过
- `src/test/library-service.test.ts` 通过
- `src/test/ffmpeg-cache.test.ts` 通过
- 共 5 个底层测试全部通过

### 当前结论
- `electron/library.ts` 第一阶段已进一步收口：
  1. 缓存 freshness 正确
  2. `contentIndex` 旧实例可清理
  3. `nameIndex` 删除文件后的孤立 contentId 可清理
- `electron/ffmpeg.ts` 第一阶段已具备基本缓存稳定性护栏
- 第一阶段底层稳定性收口已达到一个完整阶段节点

### 下一阶段重点
1. 开始治理 `electron/ffmpeg.ts` 的日志噪音与缓存清理可维护性
2. 然后进入 `App.tsx` / 前端骨架减重阶段
3. 继续扩展底层测试护栏，避免后续重构回归

---

## 日志记录规范
每一轮执行后补充以下内容：
- 本轮目标
- 涉及文件
- 根因/风险点
- 已完成修改
- 验证结果
- 剩余问题
- 下一轮重点
