# 存档与数据库结构

存档外层仍为 `{format:"mcworld",version:1,world}`，最大导入 50 MiB。

## World v1

| 字段 | 用途 |
|---|---|
| version / engine | 结构版本 1；规则引擎 0.1.0 或 0.2.0 |
| config / tick / rng | 初态配置、整数虚拟小时、xorshift32 状态 |
| tiles | size² 地形、容量及真实食物/木材/石材 |
| agents | 唯一 ID、需求、位置、两个各 12 容量的资源袋、路线、已知区域、所属营地 |
| settlements | 0.2.0 营地：唯一实体 ID、成员、位置、仓库、住宅工程 |
| events | 事件 ID、Tick、可选成对坐标、实体引用、实际事件文本 |
| metrics | 日采样：人口、地表食物、聚落数、累计采集与消费 |
| rules / totals / commands | 再生倍率、累计食物流量、已执行的创造者命令 |

营地仓库食物和木材容量各 200。住宅必须预留 12 木材，工程 progress 为 0–24 工时；消耗材料保留在 cost 字段供审计。agent.settlement 与 camp.members 双向一致；ID 不与居民重复，死亡立即移除成员引用，遗留库存不凭空销毁。

版本 0.1.0 世界必须没有聚落实体，并继续运行原规则。打开旧世界不会自动升级；新建世界默认使用 0.4.0。

## World v2 / engine 0.3.0、0.3.1

保留上述公共字段，增加 `families`（家庭 ID、营地、两位家庭伙伴、成员、建立时刻和上次出生时刻）。居民增加 `initialAgeTicks`、`family` 和 `parents`；统计增加 `families/children/births/deaths`。旧引擎拒绝混入这些居民/家庭字段。校验覆盖双向成员关联、父母存在及代际时间顺序。死亡成员保留亲缘记录，成年子女另组家庭时只转移当前家庭关联。IndexedDB 表结构不变，无需删除旧存档。

0.3.1 只改变家庭供粮行为，使用已有背包、路径、动作和亲缘字段，不增加结构字段。0.3.0 归档继续原规则，保持确定性。

## World v3 / engine 0.4.0

保留 v2 的公共字段，增加必需的 `deceased: Agent[]`。每日人口更新会将死者从 `agents` 移入此数组，清空 `path/target/known`；身份、姓名、位置、出生年龄、亲缘、家庭、经验、动作/原因及食物/木材保留。日内新死者可暂留 `agents`，下一次每日更新时归档。

`agents` 最多 2,000 条，`agents + deceased` 合计最多 20,000 条。归档条目不能存活、不能属于营地，也不能保留路径和探索缓存。ID 在当前居民、先人、营地与家庭间唯一；家庭和父母及事件实体引用验证全部居民，不只查 `agents`。家庭展示与累计出生/死亡统计同样覆盖先人。

先人遗留食物和木材仍属于资源总账，但不自动转入仓库。数据结构升级不改变 IndexedDB 表结构；只用于新世界，不自动转换旧世界。归档外层仍为 v1，导入仍限制 50 MiB。

## IndexedDB

- React/Dexie：数据库 `microcivilization-worlds`，version 1，表 worlds，索引 `id,updated,name`。
- 核心预览：数据库 `mc-core-preview`，version 1，object store worlds，keyPath id。
- 每个记录保存 id/world/revision/updated。Dexie 另存 name/seed/tick/population 作为列表元数据。
- 保存事务先比较旧 revision，再原子写入；不匹配就报冲突，不覆盖新版本。
- 原生预览与正式数据库保持隔离；通过 .mcworld 归档交换世界。

0.4.5 的正式界面使用独立的检查点库，分支来源随本地档案记录。贸易写入事件日志，往来关系存入聚落状态。模组清单和版本锁随 WorldConfig 保存。实验结果可单独导出 CSV。
