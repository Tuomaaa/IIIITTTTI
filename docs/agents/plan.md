# 操作日程（plan agent）

你在帮用户维护 `data/plan.json`：他们的线程、甘特条、todo、时间块和 milestone。
网页会实时读这个文件，改完 commit + push 到 `main`，用户刷新就能看到。

## 每次开始

```bash
npm ci                         # 新容器里先装依赖
npm run plan -- summary        # 今天的简报：需处理 / 聚焦 / 时间块 / todo / 进行中 / milestone / 推迟
```

先跑 `summary`，把「需处理」里的东西主动提出来，再做用户要的事。
"今天"按 `meta.tz`（目前 `America/Indiana/Indianapolis`）算；CLI 可以用 `--today YYYY-MM-DD` 覆盖。

## 改数据

优先用 CLI，它会自动校验、格式化，并维护推迟记录：

```bash
npm run plan -- help                                   # 全部命令
npm run plan -- add-track --id surf-exp --name "SURF · 实验" --color "#10b981" --group SURF
npm run plan -- add "改 intro #文献 明天"               # 和网页快速添加同一套语法
npm run plan -- add-task --track surf-exp --title "消融实验" --start 2026-11-05 --end 2026-11-14 --focus 2026-11-06,2026-11-07
npm run plan -- add-block --date 2026-10-30 --start 14:00 --end 15:30 --title "组会" --track surf-exp --kind event
npm run plan -- add-milestone --track surf-exp --title "Milestone 1" --date 2026-11-04 [--hard]
npm run plan -- done td-05                             # task / todo / milestone 通用
npm run plan -- push tk-stat --to 2026-11-02 --reason "数据没清完" --by agent
npm run plan -- set tk-exp1 title="复现 baseline v2" note=   # 改任意字段，空值 = 删除该字段
npm run plan -- archive surf-exp                       # 归档整条线程（unarchive / pause / unpause 同理）
npm run plan -- validate
```

批量改的时候也可以直接编辑 JSON，但 commit 前一定要跑 `npm run plan -- fmt`（会顺便校验）。
**不要手改 `slips` / `baseline`**，推后一律走 `push`，否则推迟统计会失真。

## 数据模型

| 实体 | 关键字段 | 说明 |
|---|---|---|
| track | id, name, color, group?, paused?, archived? | 一条并行的线程。同一 `group` 的线程在甘特图左侧共用一条竖向侧轨，可折叠（组内显示时去掉名字里的「组名 · 」前缀）。`paused` 收进底部「暂停」组；`archived` 从甘特图、需处理、统计里全部隐藏 |
| task | trackId, start, end, focus[], progress?, hard?, milestoneId?, slips[], baseline? | 甘特条。`focus` = 打算做它的那几天（条底部色带的实心段） |
| milestone | trackId, date, hard? | ◆。hard = 硬 ddl |
| todo | date?, origDate?, taskId?, trackId?, done, est? | 没有 date = backlog。挂到 task 上会自动算进度、自动点亮那天的 focus |
| block | date, start, end, title, taskId?, kind | 一天里按小时的日程（focus / event / routine）。挂到 task 上同样会点亮 focus |

- id 约定：可读的 slug 最好（`tk-ml-hw5`、线程用 `surf-exp` 这种短名），CLI 不给 `--id` 时会随机生成。
- 线程颜色用对比明显的饱和色，避免纯红（红色留给过期）。
- 一个 task 最好挂上几个 todo：用户只要勾 todo，进度和甘特条就会自己动。
- **用户约定：有截止的东西（作业、quiz、report、提交）一律做成 hard milestone，不要做成 todo。** todo 对用户来说是没有时间限制的备忘录 / 软 ddl，不会显示在甘特图上。课程放在 `课程` group，每门课一条线程。

## 过期 / 推后协议（暂定，等用户看完 docs/overdue.md 再定稿）

1. **todo**：过了日期没做完会自动显示在今天（↻N 天）。拖到 ≥3 天就是 stale，要问用户：今天做 / 改期 / 升级成 task / 扔 backlog / 删除。
2. **soft task 过期**：不要默默推。告诉用户「X 过期 N 天，估计还剩 R 天，建议推到 D」
   （`npm run plan -- suggest <id>` 会算），用户同意后再 `push --by agent --reason ...`。
   一次推后默认不超过 `meta.maxPushDays`（2）天；超过就该重排（拆小、补 focus 天），而不是一口气推一大段。
3. **hard task / hard milestone**：不能推。只能完成、砍 scope，或者跟用户确认后标记 missed（写进 note）。
4. **同一个 task 推了 ≥3 次**：不要再推。提议拆成更小的 task 或者砍 scope。
5. 每次推后都必须写 `reason`，哪怕很短。这是给用户的负反馈，网页上会一直显示。

## 提交

```bash
git add data/plan.json && git commit -m "plan: <做了什么>" && git push origin main
```

只改 `data/plan.json`。如果觉得需要改代码（比如想要一个 CLI 没有的命令），停下来，按 [dev.md](dev.md) 处理或者先问用户。
