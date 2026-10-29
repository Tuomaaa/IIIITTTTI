# 本地安装：让任意 folder 里的 Claude Code 都能改日程

> 给本地 Claude Code agent 的安装说明。用户会把这份文件丢给你，请按顺序做完，每一步做完简单汇报。
> 遇到和下面假设不一样的情况（路径已被占用、settings.json 格式不认识等），先停下来问用户，不要硬改。

目标：用户在**任何项目目录**里跟 Claude Code 说"HW5 周五交""今天干嘛"，agent 都能去改
`Tuomaaa/IIIITTTTI` 这个 repo 里的 `data/plan.json`，并且走 repo 自带的 CLI（会自动校验、维护推迟记录）。

下文用 `<PLAN_DIR>` 表示 clone 的位置，默认 `~/IIIITTTTI`。写进配置文件时一律展开成**绝对路径**
（比如 `/Users/xxx/IIIITTTTI`），不要留 `~`。

## 1. Clone repo 并装依赖

先看 `<PLAN_DIR>` 是否已存在：

- 不存在：`git clone https://github.com/Tuomaaa/IIIITTTTI.git <PLAN_DIR>`
- 已存在且是这个 repo（`git -C <PLAN_DIR> remote -v` 指向 `Tuomaaa/IIIITTTTI`）：`git -C <PLAN_DIR> pull`
- 已存在但不是这个 repo：停下来问用户换个路径。

然后：

```bash
npm ci --prefix <PLAN_DIR>
```

确认 `git -C <PLAN_DIR> push --dry-run origin main` 不报权限错误（用户需要对这个 repo 有 push 权限）。
如果报错，告诉用户去配置 git 凭据（`gh auth login` 或 SSH key），不要自己折腾 token。

## 2. 安装 user-level skill

创建文件 `~/.claude/skills/iiiittttti-plan/SKILL.md`，内容如下（把所有 `<PLAN_DIR>` 换成第 1 步确定的绝对路径）：

~~~~markdown
---
name: iiiittttti-plan
description: 用户的个人日程 / 任务管理（IIIITTTTI 网站，Calendar + Gantt + To-do）。当用户提到自己的日程、todo、ddl、作业截止、milestone、时间块、推后、归档线程，或问"今天干嘛""这周安排"时使用，不管当前在哪个项目目录里。不用于修改网站代码。
---

# IIIITTTTI 日程操作

用户的所有日程数据在 `<PLAN_DIR>/data/plan.json`（GitHub: Tuomaaa/IIIITTTTI，网页 https://tuomaaa.github.io/IIIITTTTI/ 实时读 `main` 上的这个文件）。
你当前所在的项目目录和它无关，**不要 `cd` 过去**，所有命令都用 `git -C` / `npm --prefix` 指向 `<PLAN_DIR>`。

## 每次操作的流程

1. **先同步**：
   ```bash
   git -C <PLAN_DIR> status --short
   git -C <PLAN_DIR> pull --rebase origin main
   ```
   `status` 有未提交改动时先停下来告诉用户，不要 stash / reset。
2. **读规则**：第一次用这个 skill（或本次对话还没读过）时，读 `<PLAN_DIR>/docs/agents/plan.md`。那里是数据模型、CLI 命令、过期 / 推后协议和用户约定的唯一来源，以它为准，这里不重复。
3. **看简报**：`npm --prefix <PLAN_DIR> run plan -- summary`，把「需处理」里的东西主动提出来。
4. **改数据**：一律用 CLI，例如
   ```bash
   npm --prefix <PLAN_DIR> run plan -- help
   npm --prefix <PLAN_DIR> run plan -- add "改 intro #文献 明天"
   npm --prefix <PLAN_DIR> run plan -- push tk-xxx --to 2026-11-02 --reason "..." --by agent
   ```
   `npm --prefix` 会在 `<PLAN_DIR>` 下执行，CLI 默认的 `data/plan.json` 相对路径是对的，不要另传 `--file`。
   推后、改 task 这类操作按 plan.md 的协议先跟用户确认。
5. **提交并推送**：
   ```bash
   git -C <PLAN_DIR> add data/plan.json
   git -C <PLAN_DIR> commit -m "plan: <做了什么>"
   git -C <PLAN_DIR> push origin main
   ```
   只提交 `data/plan.json`。push 被拒（远端有新提交）时：`pull --rebase` 再 push。
   如果 rebase 在 `plan.json` 上冲突，`git -C <PLAN_DIR> rebase --abort`，告诉用户，不要手动 merge 这个 JSON。

## 不要做的事

- 不要手改 `slips` / `baseline`，推后一律走 CLI 的 `push`。
- 不要从这里改网站代码、schema 或 CLI。用户要改网站时，告诉他们去 `<PLAN_DIR>` 里开一个 Claude Code session（按 `docs/agents/dev.md` 处理）。
- 不要 force push，不要改 `main` 以外的分支。

用户偏好：中文交流，专业名词可以用英文；不用 em dash。
~~~~

如果 `~/.claude/skills/iiiittttti-plan/` 已经存在，先给用户看旧内容再决定是否覆盖。

## 3. 减少 permission 弹窗

编辑 `~/.claude/settings.json`（**合并**进现有内容，不要覆盖整个文件；文件不存在就新建）：

```json
{
  "permissions": {
    "additionalDirectories": ["<PLAN_DIR>"],
    "allow": [
      "Bash(git -C <PLAN_DIR> status:*)",
      "Bash(git -C <PLAN_DIR> pull:*)",
      "Bash(git -C <PLAN_DIR> add data/plan.json)",
      "Bash(git -C <PLAN_DIR> commit:*)",
      "Bash(npm --prefix <PLAN_DIR> run plan:*)"
    ]
  }
}
```

`git push` 故意没放进 allow，每次推送前让用户看一眼。用户想全自动的话可以自己加上
`"Bash(git -C <PLAN_DIR> push origin main)"`。

已有的 `additionalDirectories` / `allow` 数组要追加，不要替换。改完确认文件仍是合法 JSON。

## 4. 验证

```bash
npm --prefix <PLAN_DIR> run plan -- validate
npm --prefix <PLAN_DIR> run plan -- summary
```

两条都正常输出就装好了。最后告诉用户：

- clone 的绝对路径；
- skill 和 settings 改了哪些地方；
- 新开一个 Claude Code session（skill 在新 session 才会加载），在任意目录里说"今天干嘛"试一下。
