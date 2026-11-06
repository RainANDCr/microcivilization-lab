# 架构与实施记录

React UI → Zustand 会话 → 请求控制器 → 生产 Worker → sim-core。React/Pixi 不直接修改模拟事实。

无依赖核心预览 → 同一 Worker → 同一 sim-core；原生 Canvas 是依赖不可安装时的可运行入口，不能代替正式 Pixi 分块性能验收。

核心模块不引用 DOM、React、系统时钟或 Math.random。地形按种子空间平滑噪声生成，xorshift32 RNG 状态跟随世界序列化。稳定数组顺序处理居民，规则逐 Tick 执行。

Worker 请求含 ID；错误返回同一 ID。前端最多一个推进请求在途，超时与线程错误停止模拟并保留主线程快照。当前消息仍传完整世界，增量投影待做。

## 持久化

正式工程 Dexie v1 worlds 表：id、updated、name 索引，完整快照与 revision 一次事务写入。事务内比较 revision，拒绝旧标签页覆盖。核心预览原生 IndexedDB 采用相同 revision 语义，但使用独立数据库名。

`.mcworld` 为 UTF-8 JSON：`{format:'mcworld',version:1,world}`。导入上限 50 MiB。验证引擎、地图尺寸、数值范围、ID、实体路径与日志引用后才交给 Worker。支持 engine 0.1.0/0.2.0，按版本选择是否启用营地规则；未知版本明确拒绝，不改写来源文件。

营地模块独立于 React：日级评估可达协作群体与环境，Tick 级分配搬运、共享补给与建造。建设材料先从仓库扣除并记入工程 cost；居民逐格运输，不瞬移库存。住宅收益由真实建筑状态、成员容量与位置推导。

## 尚未完成的技术要求

Zod schemas、Tailwind/Radix、分块裁剪、增量 Worker 帧、Worker 浏览器 E2E、版本迁移、检查点表、正式分支、跨浏览器确定性、PWA、自动恢复与质量回归均仍需实施。不为未来系统添加空实现。

## 决策

1. 本轮在空工作区直接创建工程，未初始化 Git、未提交和推送。
2. npm 受网络策略拒绝时，用 Node 内置 test 验证纯核心；保留 Vitest 用于 Dexie。
3. 依赖不可安装时补充 core-preview，用户可运行真实模型，完整技术栈入口仍保留。
4. 当前均匀成本地图用 BFS，预算失败返回无路径并允许重新评估；未声称完成 A*。
