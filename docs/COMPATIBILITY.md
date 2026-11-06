# 兼容性

归档外层仍为 v1；World 结构 v1 对应 engine 0.1.0 / 0.2.0，World v2 对应 engine 0.3.0 / 0.3.1，World v3 对应 engine 0.4.0 / 0.4.1 / 0.4.2 / 0.4.3 / 0.4.4。新世界默认 0.4.4。加载旧世界继续使用原引擎：0.1.0 / 0.2.0 不增加年龄、家庭和夜间返家；0.3.0 不启用父母送餐；0.3.1 保留供粮规则及历史居民总数 2,000 上限。不会将死者静默移出旧存档。未知版本或版本搭配拒绝加载，保持原始文件。

旧引擎回归：配置 legacy-fixture / legacy-rain / 64² / 24 居民 / continent，1,000 Tick 的状态哈希保持 `9d585bb7`；0.2.0 的 legacy-camp-fixture / legacy-camp-rain 同规格哈希保持 `c9da8256`。0.3.0 归档保留家庭、父母、年龄、出生冷却与人口统计，并验证保存恢复后的确定性续跑；无需清空 IndexedDB。

0.3.0 新增固定回归：legacy-family-fixture / rain-river / 64² / 24 居民 / continent，10,000 Tick 哈希保持 `657875a5`。0.3.1 的家庭送餐只使用现有背包、位置、路径和亲缘字段，World 结构仍为 v2；没有自动迁移或删除历史居民。

0.3.1 的 legacy-care-fixture / rain-river / 同规格，50,000 Tick 哈希保持 `64e4dd01`。0.4.0 新增必须存在的 `deceased` 数组，归档已逝居民并清理路径缓存；全部姓名、亲缘和物资随 World v3 保存，旧格式拒绝混入该字段。新规则限制在世人口 2,000、总居民记录 20,000；未提供旧世界升级入口。旧客户端不能读取新格式，应保留原始备份并使用当前版本打开。

正式工程与核心预览共用归档 schema。它们使用不同数据库，通过导出/导入交换，避免未验收替代入口污染正式存储。

Node 24 为无依赖预览和 test:core 的运行要求。浏览器要求 ES modules、Web Worker、structuredClone、IndexedDB、Canvas；正式渲染还需要 WebGL。Chromium 创建、运行、存档流程已通过 E2E，跨浏览器尚未验收。

校验值为 FNV-1a，仅用于当前开发期间比较状态，不提供文件真实性或抗篡改保证。

0.4.1 的低库存运粮规则沿用 World v3。0.4.0 固定回归使用 legacy-history-fixture / rain-river / 64² / 24 人 / continent，50,000 Tick 哈希为 `64ca3aac`。

0.4.2 沿用 World v3，新引擎使用地形成本 A*。0.4.1 保持原寻路规则。legacy-path-fixture / rain-river / 64² / 24 人 / continent 的 5,000 Tick 固定哈希为 `669f9324`。

0.4.3 沿用 World v3 并启用 placeResidents 命令。旧存档按原引擎运行。渲染插值不写入存档或模拟状态。

0.4.4 沿用 World v3。天气根据世界种子与 Tick 推导，旧引擎仍使用原季节再生规则。legacy-weather-fixture / rain-river / 64² / 24 人 / continent 的 0.4.3 固定 5,000 Tick 哈希为 `7291639c`。

0.4.5 沿用 World v3，并在新世界中记录洪水食物损失、允许创造者编辑命令、支持嵌入声明式模组锁。0.4.4 的 legacy-climate-fixture / rain-river / 64² / 24 人 / continent 在 5,000 Tick 的固定哈希为 `dd4f6cf8`。检查点与分支来源由正式界面的浏览器存储保存，原有 .mcworld 仍为单世界快照。

0.4.6 沿用 World v3。商队在途货物、工地目标和新增配方仅由新版本写入。0.4.5 默认基准配置 10,000 Tick 仍为 `7a6fe519`。.mchistory 为正式观察台的主世界及检查点包，.mcworld 仍支持两套观察入口。
