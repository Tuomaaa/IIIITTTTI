# 维护网站（dev agent）

你在改这个网站本身：界面、功能、数据模型、CLI、部署。不要顺手改 `data/plan.json` 里用户的数据，
需要迁移数据时单独一个 commit，并按 [plan.md](plan.md) 的规则来。

## 架构

- **数据**：`data/plan.json`（唯一数据源），`data/schema.json`（JSON Schema）。网页通过 GitHub Contents API 实时读写它
  （`src/data/github.ts`；写入要用户在设置里填 fine-grained token，冲突时按 op 重放，见 `src/data/store.ts`）。
- **`src/core/`**：纯函数，网页和 CLI 共用，改这里要补测试。
  - `types.ts` 数据类型；`derive.ts` 派生状态（phase、过期、推迟压力、inbox、负载、归档过滤）
  - `ops.ts` 所有编辑操作（不可变，返回新 Plan）；`validate.ts` 引用和日期检查
  - `layout.ts` 甘特图一行里 task / milestone 的分 lane；`quickadd.ts` 快速添加语法；`format.ts` 稳定的 JSON 格式
  - `commands.ts` CLI 的全部命令（argv 进，文本 + 新 Plan 出），CLI 和 MCP 共用
- **`scripts/plan.ts`**：给 plan agent 用的 CLI，只负责读写文件。加新的数据操作时，先在 `ops.ts` 写 op，再在 `commands.ts` 里暴露，并更新 plan.md。
- **`functions/` + `src/server/`**：Cloudflare Pages Functions（部署和鉴权见 [deploy.md](../deploy.md)）。
  `_middleware.ts` 校验 Access JWT；`api/gh/[[path]].ts` 是给网页用的 GitHub 代理；`mcp/[secret].ts` 是给 claude.ai 用的 MCP endpoint，
  逻辑在 `src/server/mcp.ts`。MCP 的 `INSTRUCTIONS` 是 plan.md 规则的压缩版，改 plan.md 的约定时同步改它。
  `src/data/github.ts` 也会被 Worker 引用，不要在里面用 DOM 专有的 API。
- **`src/components/`**：React + Tailwind v4 + zustand。
  - `Gantt.tsx` 甘特图（分组侧轨、行打包、Bar）；`DayPanel.tsx` 日视图 + 小时表 + todo；`MonthMini.tsx` 5 周滚动日历
  - `SidePanel.tsx` 需处理 / milestone / 最近 7 天 / 最近改动；`TaskDrawer.tsx`、`TrackDrawer.tsx` 详情抽屉
  - `Modals.tsx` 图例（直接渲染真 `<Bar>`）/ 设置 / 已归档；`TopBar.tsx` 顶栏、快速添加
- **样式**：`src/index.css` 的 CSS 变量。neobrutalism：黑色描边、黄色荧光笔标今天、贴纸。
  用户明确说过：**甘特条不要阴影**，**文字不要压在变色背景上**，**不要单独占一行的组标题**，竖向空间要省。

## 开发流程

```bash
npm ci
npm run dev              # 本地开发；加 ?today=2026-10-29 可以固定日期
npm test                 # vitest，src/core 的单元测试
npm run build            # tsc + vite build
```

- 改界面后要看截图自查：`npm run build && npx vite preview`，用 Playwright 截桌面（1440×900）和手机（390×844），
  深色和浅色都看。Playwright 里拦截 `https://api.github.com/**` 返回本地数据，避免打真实 API。
- 线程多的情况要单独测（生成 40 条线程的假数据），分组、折叠、滚动都要看。
- push 前：`npm test && npm run build` 必须通过（注意管道会吞掉失败，用 `set -o pipefail`）。

## 部署

正在从 GitHub Pages 迁到 Cloudflare Pages（`plan.tuostmm.com`），步骤见 [deploy.md](../deploy.md)。迁移完成前两边都会部署：
push 到 `main` 触发 `.github/workflows/deploy.yml`（test + build + 发布到 GitHub Pages），Cloudflare Pages 也会自己构建。只改 `data/plan.json` 或 `*.md` 不会触发。
`.github/workflows/validate-data.yml` 在数据改动时跑 `npm run plan -- validate`。
部署后确认线上页面换成了新的构建（`dist/index.html` 里的 js 文件名出现在线上 HTML 里），再打开看一眼有没有报错。

## 提交

- 代码 commit 写清楚改了什么、为什么；数据 commit 用 `plan:` 前缀，二者分开。
- 改了数据模型：同步更新 `types.ts`、`schema.json`、`validate.ts`、测试和 plan.md 里的表。
