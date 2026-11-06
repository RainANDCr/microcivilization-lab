# Living World Implementation Plan

**Goal:** 从空目录实现总规格 Phase 00–04 可运行闭环，然后继续后续阶段。
**Architecture:** React 仅展示快照和发送指令；独立 TypeScript 核心由 Worker 驱动。PixiJS 渲染世界，Dexie 以事务保存版本化完整快照。
**Tech Stack:** React、TypeScript、Vite、PixiJS 8、Dexie、Zod、Zustand、Vitest、Playwright。
**Spec:** 用户提供的 MicroCivilization_Ultimate_Codex_开发总提示词.md（本会话已全文读取）。

## Global Constraints
- 1 Tick = 1 小时，360 天/年；随机数状态和所有影响结果的状态必须序列化。
- 本地优先、无账号、无必需 API；禁止假统计和随机移动冒充模拟。
- 不覆盖旧数据，损坏/未知版本导入拒绝，写冲突可见。

## Review Focus
- 全海/不可达地图：拒绝无落点创建，路径失败可恢复。
- 非法导入：尺寸、数值、引用、版本与容量校验。
- 连续点击和旧 Worker 响应：只使用当前请求对应状态。
- 存档写冲突：比较 revision，保留原数据。
- 高倍速：逐 Tick 执行，不跳过规则。

## Tasks
1. 工程与核心契约：packages/protocol、content；基础测试。运行 npm install/typecheck/lint/test/build。
2. 地形与时钟：packages/sim-core；先测试相同种子、边界、10000 Tick 确定性，再实现。
3. 自主居民：真实邻接路径、需求、容量采集、消费、休息；测试不可达、库存和存活。
4. Worker 和存储：packages/sim-worker、storage；测试序列化一致、损坏拒绝和 revision 冲突。
5. 渲染与 UI：packages/renderer、apps/web；E2E 创建、暂停、单步、存档刷新、导出。
6. 阶段验收和交接：逐项运行全部命令，记录结果，后续功能仅真实实现后才更新状态。

用户总规格已明确直接实施并自动继续，沿用已定架构，不再次设计审批。当前为空目录，无需 worktree 隔离或保护旧存档。
