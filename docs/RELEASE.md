# 本地构建与发布验收

## GitHub 托管

仓库：https://github.com/RainANDCr/microcivilization-lab

网页：https://rainandcr.github.io/microcivilization-lab/

`.github/workflows/pages.yml` 在推送 `main` 或手动运行时执行 lint、核心/存储测试和正式构建，再发布 `dist/`。仓库 Pages 来源设为 GitHub Actions。流程采用 [GitHub 官方 Pages 工作流接口](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

保持该站点地址以保留浏览器本地档案；localhost 与 GitHub Pages 的本地档案互不共享，可通过导出/导入迁移。代码仓库不上传个人世界档案、环境变量、构建缓存和浏览器缓存。

## 本机构建

使用 Node.js 24，在项目根目录运行：

```powershell
npm ci
npm run lint
npm test
npm run build
npm run build:offline
```

`dist/` 是正式观察台的完整静态站点，含安装清单、应用图标和离线 Service Worker。`dist-offline/` 是单独的核心预览。发布时上传所选目录的完整内容。通过 HTTPS 或本机 localhost 访问，保留 `index.html`、`sw.js`、清单和资源的相对目录。

首访在线完成离线缓存后，可从浏览器安装入口打开应用。不同浏览器的安装入口各有差异。离线与在线使用同一站点地址时，IndexedDB 的档案共用。更换域名、协议或端口前，先导出 `.mcworld` 或 `.mchistory` 备份。

## 验收命令

```powershell
npx playwright install chromium firefox webkit
$env:MC_CROSS_BROWSER = '1'
$env:MC_PREVIEW = '1'
npm run test:e2e
npm run test:e2e:offline
npm run test:pwa
$env:MC_ECOLOGY_YEARS = '12'
npm run test:ecology
```

`npm run test:pwa` 使用现有 `dist/`，运行前应重新构建。可用 `MC_CHROMIUM_PATH` 指向本机 Chrome 或 Edge。Chrome 专项使用 `MC_STRESS_MS=180000` 延长地图采样。两套浏览器回归请顺序运行。

## 恢复与回退

- 自动草稿约每 15 秒记录一次未保存进度，隐藏标签页时再尝试保存。世界档案中的「恢复为独立档案」保留原存档。成功手动保存会清理该会话的草稿。
- 模拟 Worker 故障后，下次操作从上一个确认快照开始。后台标签页停止发起新推进，重新可见后恢复推进。
- 保留最近一个通过验收的完整静态目录，回退时原样重新部署。保持旧缓存直到新版 Worker 接管。回退前用当前版本导出新引擎世界，以便继续用支持该引擎的版本读取。
- 确认在线首访、离线重开、键盘入口、存档冲突、Worker 恢复和构建产物均通过，再部署静态站点。CI 工作流在仓库接入后自动执行。

## 发布验收记录（2026-11-06）

- 本地故障验收：注入 IndexedDB 配额不足、未知写入错误和事务中途取消，旧存档保持原 Tick；手动保存和自动草稿失败有提示，当前世界仍可导出。解除故障后重新保存并重开通过。
- PWA 更新验收：新版预缓存资源返回 503 时安装失败，旧版继续离线打开存档；资源恢复后更新成功，重新发布原版后回退成功，原存档仍可离线打开并推进。测试使用本机 HTTP 服务模拟版本切换，未连接生产站点。
- 本轮通过核心 82 项、存储 3 项、PWA 6 项，以及类型检查、lint 和正式构建。
- 用户明确免除更长时间压力测试；保留已有发布构建三分钟采样，不据此保证小时级稳定性。

当前满足本地公开测试版交付条件。正式上线仍需远端 CI、实际 HTTPS 站点的缓存与回退验收，以及移动真机和读屏人工验收。当前目录没有 Git 仓库或部署地址，这些外部验收尚未执行。
