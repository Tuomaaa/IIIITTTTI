# 多线程 · Planner

日历 + 甘特图 + to-do 三合一的个人多任务管理页面，部署在 GitHub Pages：
<https://tuomaaa.github.io/IIIITTTTI/>

- **数据**：`data/plan.json`（格式见 `data/schema.json` 和 `src/core/types.ts`）。网页通过 GitHub API 实时读取，改数据不需要重新部署。
- **改数据**：主要由 agent 通过 `npm run plan -- <命令>` 完成，说明见 [CLAUDE.md](CLAUDE.md)。网页上填了 token 之后也能勾 todo、推后、快速添加。
- **过期 / 推后规则**：见 [docs/overdue.md](docs/overdue.md)。
- **多端**：手机打开同一个网址，浏览器菜单里「添加到主屏幕」。

```bash
npm ci
npm run dev        # 本地开发；加 ?today=2026-10-29 可以固定日期
npm test           # 单元测试
npm run build      # 类型检查 + 构建
npm run plan -- summary
```
