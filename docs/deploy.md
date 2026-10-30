# 部署到 Cloudflare Pages（plan.tuostmm.com）

目标：repo 改成 private，网页只有用户本人能打开，claude.ai 的 chat 通过 MCP connector 改日程。

## 结构

```
浏览器 ──Access 登录──▶ plan.tuostmm.com ──▶ functions/_middleware.ts（再验一次 Access JWT）
                                              ├─ 静态页面（dist/）
                                              └─ /api/gh/*  ──GITHUB_TOKEN──▶ GitHub Contents API
claude.ai connector ──▶ /mcp/<MCP_SECRET> ──GITHUB_TOKEN──▶ GitHub Contents API
```

- 网页仍然实时读写 `data/plan.json`，只是请求经过同源代理 `/api/gh`，token 在服务端。
  代理只放行 `data/plan.json` 的 GET / PUT 和它的 commits 列表。
- `/mcp/<secret>` 不在 Access 后面（connector 走不了 Access 登录），secret 本身就是鉴权。
  它跑的是 `src/core/commands.ts`，和 `npm run plan` 是同一套代码。
- middleware 对所有非 `/mcp/` 请求校验 Access JWT，包括静态文件。原因：JS bundle 里有构建时的
  `plan.json` 快照，而 `*.pages.dev` 地址不经过 Access。

## 第一次部署

按顺序做。前 7 步做完、确认能用之前，GitHub Pages 版本保持原样。

1. **GitHub token**：Settings → Developer settings → Fine-grained tokens → Generate。
   Repository access 只选 `Tuomaaa/IIIITTTTI`；Permissions → Contents 选 Read and write，其它都不给。
2. **MCP secret**：生成一个随机串（至少 32 字符），例如 `node -e "console.log(crypto.randomBytes(24).toString('hex'))"`。
3. **Pages 项目**：Cloudflare 控制台 → Workers & Pages → Create → Pages → Connect to Git → 选这个 repo。
   - Build command `npm run build`，output `dist`
   - Variables：`VITE_GH_PROXY` = `/api/gh`，`NODE_VERSION` = `22`
   - Secrets：`GITHUB_TOKEN`（第 1 步），`MCP_SECRET`（第 2 步）
   - Build watch paths：exclude `data/plan.json` 和 `**/*.md`（数据改动不用重新构建）
4. **域名**：项目 → Custom domains → 加 `plan.tuostmm.com`（zone 已经在这个账号里，会自动建 DNS）。
5. **Access（网页）**：Zero Trust → Access → Applications → Add → Self-hosted。
   - Domain：`plan.tuostmm.com`，路径留空
   - Policy：Allow，Include → Emails → 自己的邮箱
   - 建好后在应用的 Overview 里复制 **Application Audience (AUD) Tag**
6. **Access（MCP 放行）**：再加一个 Self-hosted 应用，Domain `plan.tuostmm.com`，Path `mcp`，
   Policy action 选 **Bypass**，Include → Everyone。
7. **补变量并重新部署**：Pages 项目加 `ACCESS_AUD`（第 5 步的 AUD）和 `ACCESS_TEAM_DOMAIN`
   （Zero Trust → Settings → Custom Pages 里的 team domain，形如 `xxx.cloudflareaccess.com`，不带 https）。
   然后 Deployments → 最新一次 → Retry deployment。

## 验证

- 打开 `https://plan.tuostmm.com`：先到 Access 登录页，登录后页面正常，右上角是「已同步」，勾一个 todo 能保存。
- 打开 `https://<项目名>.pages.dev`：应该是 403。
- MCP：
  ```bash
  curl -s -X POST https://plan.tuostmm.com/mcp/<MCP_SECRET> -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"summary","arguments":{}}}'
  ```
  返回今天的简报就通了。

## 接到 claude.ai

Settings → Connectors → Add custom connector，URL 填 `https://plan.tuostmm.com/mcp/<MCP_SECRET>`，鉴权留空。
新开一个 chat 说"今天干嘛"试一下。手机 App 用同一个账号，connector 会同步过去。

这个 URL 等于写权限，不要贴到别处。泄露了就换一个 `MCP_SECRET`、重新部署，再到 claude.ai 里改 URL。

## 切换（确认上面都正常之后）

1. repo → Settings → General → Change visibility → Private。
2. 删掉 `.github/workflows/deploy.yml`，repo → Settings → Pages 里关掉 GitHub Pages。
3. README.md、AGENTS.md 里的网址换成 `https://plan.tuostmm.com`。
4. 每台设备的网页「设置」里以前填过的 token 已经用不到了，可以清掉，然后到 GitHub 把那个旧 token 删了。

本地 `/gantt` skill 走 git，不受影响。repo 变成 private 后，`git pull` / `push` 用的还是本机的 git 凭据。

## 本地调试 Functions

```bash
VITE_GH_PROXY=/api/gh npm run build
npx wrangler@4 pages dev dist --binding INSECURE_SKIP_ACCESS=1 --binding GITHUB_TOKEN=<token> --binding MCP_SECRET=<32+ 字符>
```

`INSECURE_SKIP_ACCESS` 只能在本地用，绝对不要加到 Pages 项目上。
