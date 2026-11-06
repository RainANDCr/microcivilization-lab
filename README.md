# MicroCivilization · 微观文明实验场

创造一个世界，然后见证它的历史。

[在线体验](https://rainandcr.github.io/microcivilization-lab/) · [源代码](https://github.com/RainANDCr/microcivilization-lab)

推送到 `main` 后，GitHub Actions 自动检查、构建并部署正式观察台到 GitHub Pages。存档保存在访问者自己的浏览器中，请定期导出备份。

**当前版本为 0.4.6 开发预览。** 已实现确定性地形、固定 Tick 模拟、自主居民生存、生态再生、自发营地、共享仓库、真实木材搬运、协作住宅、家庭与出生、夜间返家、父母送餐、先人记录及版本化归档。0.4.5 增加动态气候、洪水、创造者工具、历史回放与分叉、批量实验、模组锁，以及家庭迁移和聚落生产贸易。各阶段状态见 [开发路线](docs/ROADMAP.md)。

## 立即运行：无依赖核心预览

需要 **Node.js 24 或更高版本**。PowerShell 在项目目录执行：

```powershell
npm.cmd run dev:offline
```

然后打开 **http://127.0.0.1:5180**。

无需 npm install，无需联网。预览用原生界面与 Canvas 展示**同一份 sim-core 和真实 Worker**，不是动画样机；React/PixiJS 正式观察台的安装入口仍保留。

生成可静态托管的核心预览：`npm.cmd run build:offline`。输出 `dist-offline/`，部署时以此目录为网站根目录；不要通过 `file://` 直接打开 HTML。已验证 JavaScript 引擎与 TypeScript 源码结果一致，Chromium 的创建、运行暂停、保存恢复、归档及小屏布局 E2E 通过。

操作：创建世界 → 开始模拟 → 单击居民或地块 → 观察采集/进食/休息 → 保存 → 刷新后从“本地存档”打开 → 导出/导入 `.mcworld`。滚轮缩放、拖动平移；地图获得焦点后可以用方向键选择地块。空格切换运行状态。

新世界默认启用 0.4.6，已有存档按原引擎运行。营地库存低于每位成员 1 单位时，携带至少 8 单位食物的居民会优先运送余粮，自留至少 6 单位。默认种子十年对照中，0.4.1 与 0.4.0 均有 98 人存活，累计死亡分别为 47 和 54。

父母会给饥饿且无食物的幼儿送餐，先保留自身至少 2 单位口粮。远处需要真实步行，距离 1 格内才转移食物；仓库补给仍有效。可以从居民的“送餐 / 照料家人”动作及观察笔记查看原因。

0.4.0 每日将已逝居民移入先人记录，保留姓名、亲缘、家庭、事件引用和遗留物资，清理无用的路径缓存。2,000 条历史记录不再阻止出生；仍限制最多 2,000 位在世居民、合计 20,000 条居民记录。家庭面板仍能查看先人。详见 [历史归档验证](docs/HISTORY_VALIDATION.md)。

营地需要至少 3 位有实际采集经验、备有口粮且彼此可达的居民，以及资源丰富的沿岸环境。住宅先消耗 12 木材预留材料，再由居民投入 24 工时；住房容量内的成员在营地附近休息会额外恢复精力。没有固定时间自动升级。

核心预览的 IndexedDB 数据库名为 `mc-core-preview`。React 版本使用 `microcivilization-worlds`，两者不会静默覆盖对方，通过 `.mcworld` 交换世界。清除浏览器网站数据会删除本地存档，请定期导出备份。

## React / PixiJS 完整工程入口

```powershell
npm.cmd install --cache .npm-cache --no-audit --no-fund
npm.cmd run dev
```

访问终端输出的地址（通常为 http://127.0.0.1:5173）。普通终端可以使用 `npm`；Windows 如遇 npm.ps1 执行策略问题，直接使用 `npm.cmd`。

2026-11-01 已补齐 PixiJS、ECharts 等依赖，生成 package-lock.json；完整构建与 Chromium E2E 已通过。受限环境内安装或浏览器启动仍可能被拒绝，本次在获准的受限环境外完成验证。

## 验证

```powershell
npm.cmd run test:core
npm.cmd run benchmark
```

长期人口检查：`npm.cmd run test:population` 固定使用 0.3.0 基线运行 100 年，逐年核对食物与木材守恒、世界结构，并在第 50 年检查归档续跑一致性；结果写入 `docs/POPULATION_RESULTS.json`。此项耗时较长，不包含在日常 `npm test` 内。

家庭供粮对照：`npm.cmd run test:childcare`，分别运行 0.3.0 / 0.3.1 / 0.4.0 十年并逐年核对食物守恒与结构，结果写入 `docs/CHILDCARE_RESULTS.json`。另核对 0.4.0 归档不改变触发旧历史上限之前的人口和食物结果。

以上两项不依赖第三方安装。覆盖地图和 RNG 的确定性、10,000 Tick 与快照续跑、资源守恒、非法归档拒绝、移动约束，以及实际 Worker 消息处理。Worker 测试通过 Node 适配器使用生产线程代码，尚不等于浏览器 E2E。

最新检查：核心 54/54、Dexie 存储 2/2，通过 `npm test`；lint、全工程类型检查及完整 build 通过；正式观察台 E2E 2/2、核心预览 E2E 5/5 通过（含先人展示、新旧引擎供粮、真实 Worker 与保存恢复）。两套 E2E 应按下方命令顺序执行，共用产物目录。历史性能基准见 [BENCHMARKS](docs/BENCHMARKS.md)。

安装依赖后继续：

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npx.cmd playwright install chromium
npm.cmd run test:e2e
npm.cmd run test:e2e:offline
npm.cmd run build
```

`npm test` 包括核心测试和 Dexie/fake-indexeddb 存储测试。浏览器首次安装需要网络；E2E 用例及本轮运行状态见 HANDOFF。

## 真实模型与当前边界

- 相同引擎、初态、种子、RNG 状态和命令序列可复现；校验值是调试用途 FNV-1a，不是加密签名。
- 1 Tick = 1 小时，24 小时/天，360 天/年，四季各 90 天。
- 居民根据饥饿、精力、背包容量及可达资源执行动作；食物从环境转移到背包，再被消费。探索有种子驱动的随机选择，生存行为不是随机动画。
- 0.4.2 起，世界以地形成本运行有预算的 A*，旧引擎沿用等成本 BFS。成本用于选路，实际移动仍按 Tick 逐格推进。正式观察台按 32×32 地块维护纹理，只上传发生像素变化的块。
- 自 0.4.3 起，在世界中选中可通行地块，可一次投放 10–100 位居民。正式观察台会平滑显示连续 Tick 之间的一格移动，并尊重应用与系统的减弱动态设置。
- 季节影响每日资源生长；天气、河流、湖泊、细致土壤退化尚未实现。
- 0.3.0 包含年龄、家庭、出生、儿童照料与高龄死亡；有住宅的居民夜间回家，家庭出生受住房、食物、健康、位置与冷却限制。规则见 [SIMULATION_RULES](docs/SIMULATION_RULES.md)。
- 尚无城市与完整建筑体系、职业生产与贸易、科技文化、正式历史回放/分支 DAG、实验室或模组；现有规则不代表全部阶段完成。
- 当前渲染与 Worker 使用完整快照；大图属于实验档，没有渲染 FPS 承诺。
- 暂无自动保存。手动保存有 revision 冲突检查；失败不会清空原存档。暂停时可能完成已经提交的当前批次，不再发起新批次。
- 不使用账户、云数据库、付费 API 或外部字体。尚未实现 PWA。

## 目录

- `apps/web`：React/Zustand 界面；`apps/offline`：无依赖核心预览。
- `packages/sim-core`：地形、时钟、生态、居民、路径、命令、校验。
- `packages/sim-worker`：独立 Worker；`protocol`：接口；`content`：地形定义。
- `packages/renderer`：PixiJS；`storage`：Dexie 与共用归档格式。
- `tests`：核心、Worker、归档、存储测试；`scripts`：本地预览与真实基准。

继续开发时先读 [HANDOFF](docs/HANDOFF.md)，保留现有世界与版本，不重新初始化。

安装、离线运行和验证命令见 [发布与验收手册](docs/RELEASE.md)。
