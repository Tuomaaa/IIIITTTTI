# AGENTS.md

这个 repo 是用户的多线程任务管理网站（Calendar + Gantt + To-do 三合一），部署在 GitHub Pages：
<https://tuomaaa.github.io/IIIITTTTI/>。用户自己基本不手动维护，靠 agent 来改。

**先判断这次的任务属于哪一类，然后只读对应的那份说明：**

| 任务 | 例子 | 读这个 |
|---|---|---|
| **操作日程**：增删改线程、task、todo、时间块、milestone，推后，归档，汇报今天的情况 | "帮我把下周的安排加上""HW5 周五交""这个推两天""今天干嘛" | [docs/agents/plan.md](docs/agents/plan.md) |
| **维护网站**：改界面、加功能、修 bug、改数据模型或 CLI、部署问题 | "甘特图太挤了""加个导出功能""页面打不开" | [docs/agents/dev.md](docs/agents/dev.md) |

两类都沾（比如"加一个新字段，并把现有数据填上"）：先按 dev.md 改代码和 schema，再按 plan.md 改数据，分两个 commit。

共同规则：
- 数据只在 `data/plan.json` 一个地方，格式见 `src/core/types.ts` 和 `data/schema.json`。
- 直接 push 到 `main`。数据改动不会触发重新部署；代码改动会自动部署。
- 想让别的项目目录里的本地 agent 也能改日程：按 [docs/agents/local-setup.md](docs/agents/local-setup.md) 装一个 user-level skill。
- 过期 / 推后规则的设计讨论在 `docs/overdue.md`（草案，等用户定稿）。
- 用户偏好：中文交流，专业名词可以用英文；不用 em dash。
