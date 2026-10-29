# CLAUDE.md

这个 repo 是用户的多线程任务管理网站（Calendar + Gantt + To-do 三合一），部署在 GitHub Pages。
**用户自己基本不手动维护，主要靠 agent（你）来改数据**。这个文件告诉你怎么做。

## 一句话架构

- `data/plan.json` 是唯一的数据源（source of truth）。网页通过 GitHub Contents API 实时读它，
  所以改完 commit + push 到 `main`，用户刷新网页就能看到，不需要重新 deploy。
- `src/core/` 是纯函数逻辑（类型、派生状态、编辑操作、快速添加语法、校验），网页和 CLI 共用。
- `scripts/plan.ts` 是给你用的 CLI。`data/schema.json` 是 JSON Schema。
- 网页代码在 `src/components/`，React + Tailwind v4 + zustand。

## 每次开始干活

```bash
npm ci                         # 新容器里先装依赖
npm run plan -- summary        # 读一遍今天的简报：需处理 / 聚焦 / 时间块 / todo / 进行中 / milestone / 推迟
```

用户跟你聊日程时，先跑 `summary`，把「需处理」里的东西主动提出来，再做用户要的事。
"今天"按 `meta.tz`（目前 `America/Indiana/Indianapolis`）算；CLI 可以用 `--today YYYY-MM-DD` 覆盖。

## 改数据

优先用 CLI，它会自动校验、格式化，并维护推迟记录：

```bash
npm run plan -- help                                   # 全部命令
npm run plan -- add "改 intro #文献 明天"               # 和网页快速添加同一套语法
npm run plan -- add-task --track surf-exp --title "消融实验" --start 2026-11-05 --end 2026-11-14 --focus 2026-11-06,2026-11-07
npm run plan -- add-block --date 2026-10-30 --start 14:00 --end 15:30 --title "组会" --track surf-exp --kind event
npm run plan -- done td-05                             # task / todo / milestone 通用
npm run plan -- push tk-stat --to 2026-11-02 --reason "数据没清完" --by agent
npm run plan -- set tk-exp1 title="复现 baseline v2" note=   # 改任意字段，空值 = 删除该字段
npm run plan -- validate
```

也可以直接编辑 JSON（批量改的时候更快），但 commit 前一定要跑 `npm run plan -- fmt`（会顺便校验）。
**不要手改 `slips` / `baseline`**，推后一律走 `push`，否则推迟统计会失真。

数据模型（完整定义见 `src/core/types.ts`）：

| 实体 | 关键字段 | 说明 |
|---|---|---|
| track | id, name, color, group?, paused? | 一条并行的线程。15 条左右 |
| task | trackId, start, end, focus[], progress?, hard?, milestoneId?, slips[], baseline? | 甘特条。`focus` = 打算做它的那几天（实心格） |
| milestone | trackId, date, hard? | ◆。hard = 硬 ddl |
| todo | date?, origDate?, taskId?, trackId?, done, est? | 没有 date = backlog。挂到 task 上会自动算进度、自动点亮那天的 focus |
| block | date, start, end, title, taskId?, kind | 一天里按小时的日程。挂到 task 上同样会点亮 focus |

id 约定：`tr-` / `tk-` / `ms-` / `td-` / `bk-` 前缀；可读的 slug 更好（`tk-ml-hw5`），CLI 不给 `--id` 时会随机生成。

## 过期 / 推后协议（暂定，等用户看完 docs/overdue.md 再定稿）

1. **todo**：过了日期没做完会自动显示在今天（↻N 天）。拖到 ≥3 天就是 stale，要问用户：今天做 / 改期 / 升级成 task / 扔 backlog / 删除。
2. **soft task 过期**：不要默默推。告诉用户「X 过期 N 天，估计还剩 R 天，建议推到 D」
   （`npm run plan -- suggest <id>` 会算），用户同意后再 `push --by agent --reason ...`。
   一次推后默认不超过 `meta.maxPushDays`（2）天；超过就该重排（拆小、补 focus 天），而不是一口气推一大段。
3. **hard task / hard milestone**：不能推。只能完成、砍 scope，或者跟用户确认后标记 missed（写进 note）。
4. **同一个 task 推了 ≥3 次**：不要再推。提议拆成更小的 task 或者砍 scope。
5. 每次推后都必须写 `reason`，哪怕很短。这是给用户的负反馈，网页上会一直显示。

## 提交

- 数据改动：`git commit -m "plan: <做了什么>"`，直接 push 到 `main`。`data/plan.json` 的改动不会触发重新部署。
- 代码改动：跑 `npm test && npm run build` 通过再 push；push 到 `main` 会自动部署到 GitHub Pages。
- `meta.demo: true` 表示现在还是示例数据。用户给了真实安排后，换掉示例数据并把 `demo` 设成 `false`。
