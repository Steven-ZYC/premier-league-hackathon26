# PitchPulse · 看球牛牛

足球赛后复盘网站：同一场比赛，紫色「专业版」用两队独立势头曲线看转折，黄色「球迷版」用中立／主队／客队三种立场读赛况。React + TypeScript + Vite，后端为轻量级 **Node.js 24 LTS + Express**，同一进程提供 `dist/` 和 `/api/*`，适配现有的 **Azure App Service Linux F1 (Free)**。保留原有 `handleApi()`、`shared/`、DeepSeek、缓存和限流逻辑。

界面提供简体中文、繁体中文和英文切换；原始赛况及 AI 生成内容保留来源语言。桌面端并排分析两队，窄屏下纵向排列；两种模式共享比赛、回放位置、播放状态与速度。
示例球队、比赛对阵名称和赛事名称也随界面语言切换。自定义比赛可在「名称翻译」中选填英文名称；JSON 对应字段为球队 `englishName`、比赛 `englishTitle`、赛事 `englishCompetition`，导出和重新导入会保留这些字段。未填写翻译时保留原始名称；原始赛况不受展示语言影响。搜索同时支持中英文名称及球队缩写。

## 本地运行

需要 Node.js **24 LTS**、npm 和 Git。

```bash
git clone https://github.com/Steven-ZYC/premier-league-hackathon26.git
cd premier-league-hackathon26
npm ci
npm run dev:full
```

打开终端显示的 `http://127.0.0.1:5173`。API 在 `127.0.0.1:7071`，本地开发服务仅绑定回环地址，以本地开发身份调用，无需安装 Azure Functions Core Tools。只体验前端也可使用 `npm run dev`；没有 API 时会明确显示 AI 未连接。

```bash
npm test
npm run typecheck
npm run build
npm run package:appservice
npm run test:production
# 与 Azure 相同的独立包；无 node_modules / 编译器 / Functions host
cd release
PORT=8080 NODE_ENV=production npm start
```

`npm run preview` 只预览静态产物；`npm start` 启动已构建的生产服务（默认 8080，遵循 `PORT`，绑定 `0.0.0.0`）。生产模式不加载 `.env`、不编译、不安装依赖，也没有本地免登录旁路。本地完整业务调试使用仅绑定回环地址的 `dev:full`；请勿将该开发服务部署到云端。

## 配置 DeepSeek

```bash
cp .env.example .env
```

在 `.env` 填入 `DEEPSEEK_API_KEY`，按需要调整 `DEEPSEEK_MODEL`，重启 `npm run dev:full`。默认模型为 `deepseek-flash`，请求发送到官方 `https://api.deepseek.com/chat/completions`，使用 JSON Output 并再次校验结构。模型名称可随 DeepSeek 服务调整，参见 [DeepSeek 官方 API 文档](https://api-docs.deepseek.com/api/create-chat-completion/)。

密钥只由服务端读取；不要添加 `VITE_` 前缀，不要提交 `.env`。DeepSeek API 的使用费用由其服务单独计费，**Azure 免费托管不包含模型费用**。未配置密钥时，导入、事件核对、图表、回放及规则解说仍可使用；不会伪造 AI 预测。

## 部署到现有 Azure App Service F1

目标地址：<https://pl-hackathon-web-bmetckfaa9e4awhg.germanywestcentral-01.azurewebsites.net>，Germany West Central，Azure for Students，Linux / Node.js 24 LTS / F1。以下步骤仅配置**已经存在**的 Web App；仓库中的部署流程不创建资源、不更改 SKU，也不配置任何额外 Azure 服务。

### 1. Azure Portal：运行时与环境变量

进入现有 Web App → Configuration / General settings（新版 Portal 可能位于 Settings → Configuration / Stack settings）：

| 项目                       | 值                         |
| -------------------------- | -------------------------- |
| Operating System / Runtime | Linux / Node.js 24 LTS     |
| Startup Command            | `npm start`                |
| Always On                  | Off（F1 不支持；不要升级） |
| HTTPS Only                 | On                         |
| App Service plan           | 保持 F1 (Free)             |

进入 Settings → Environment variables → App settings，添加并保存：

| 名称                             | 值 / 说明                                        |
| -------------------------------- | ------------------------------------------------ |
| `NODE_ENV`                       | `production`                                     |
| `DEEPSEEK_API_KEY`               | 个人真实密钥，仅在此处填入；可先留空测试安全降级 |
| `DEEPSEEK_MODEL`                 | 默认 `deepseek-flash`，可改为你的账户支持的模型  |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | `false`                                          |
| `ENABLE_ORYX_BUILD`              | `false`                                          |

`PORT` 由 Azure 注入，不需要手动设置。不要创建 `VITE_DEEPSEEK_API_KEY`，不要把模型密钥添加到 GitHub Actions 的前端构建环境。`WEBSITE_AUTH_ENABLED` 和 `WEBSITE_SITE_NAME` 是 Azure **只读平台变量**，代码据此判断能否信任认证上下文；**不要手动创建或覆盖**它们，也不要以此方式在公开的独立服务器上模拟 Azure。

可选的容器启动探针：`WEBSITE_WARMUP_PATH=/api/health`、`WEBSITE_WARMUP_STATUSES=200`。它仅用于启动检查，不是 Always On；不要设置定时请求来阻止 F1 休眠。不要启用 Application Insights、额外 Functions、数据库、存储账户或其他收费服务。

### 2. GitHub OAuth 与 Easy Auth

1. GitHub → Settings → Developer settings → OAuth Apps → New OAuth App。
2. Homepage URL 填入上面的完整 HTTPS 站点地址。Authorization callback URL **完整填写**：

   ```text
   https://pl-hackathon-web-bmetckfaa9e4awhg.germanywestcentral-01.azurewebsites.net/.auth/login/github/callback
   ```

3. 保存 OAuth App，取得 Client ID 和 Client secret。**此 secret 与 DeepSeek API Key、部署用 OIDC 身份是三件不同的事**。
4. Azure Web App → Settings → Authentication → Add identity provider → GitHub，填入 OAuth Client ID / Client secret。Portal 会将 secret 存为服务端设置 `GITHUB_PROVIDER_AUTHENTICATION_SECRET`，不要写进仓库。
5. Authentication settings：**App Service authentication = Enabled**；Restrict access / Unauthenticated requests 选择 **Allow unauthenticated access / Allow anonymous requests (no action)**；Require HTTPS 保持开启。不要选择全站强制登录，否则首页也会跳转。保留 Token store 开启，以便 `/.auth/me` 验收。
6. 使用 `/.auth/login/github?post_login_redirect_uri=/` 登录；`/.auth/logout?post_logout_redirect_uri=/` 退出。现有 UI 的 GitHub 登录链接可继续工作。

公开首页与 `/api/health` 不需要登录；`POST /api/predict`、`POST /api/commentary`、`POST /api/parse` 在应用中检查认证，未登录返回 JSON `401 AUTH_REQUIRED`。生产适配器只在 Azure 的只读认证开关为 `True`、并有站点标识时读取 Easy Auth `auth_typ` / `claims`，以稳定的 nameidentifier claim 作为限流与缓存身份。只接受已有的 GitHub / Microsoft Entra (`aad`) 提供者；不会把旧 SWA `userId/userRoles` JSON 当作新身份。客户端 JSON 中的 `local/userId/principal`、替代身份头、客户端 IP、原始 Bearer 字符串都不能绕过认证。禁用 Easy Auth 或本地启动生产包时，即使伪造 `X-MS-CLIENT-PRINCIPAL` 也返回 401。

Azure Easy Auth 入口会移除／替换外部请求自行提供的身份头；**应用容器不能另行开放绕过该入口的直连路径**。代码不会自行实现 OAuth 或验证 GitHub access token，也不会信任未经平台验证的 token。没有真实 Azure 入口的本地模拟测试不能证明云端入口配置正确，必须执行文末伪造身份头验收。[微软身份上下文文档](https://learn.microsoft.com/en-us/azure/app-service/configure-authentication-user-identities)、[只读认证变量](https://learn.microsoft.com/en-us/azure/app-service/reference-app-settings#authentication--authorization)、[GitHub 提供者配置](https://learn.microsoft.com/en-us/azure/app-service/configure-authentication-provider-github)。

### 3. GitHub Actions：优先 OIDC

保留 `.github/workflows/ci.yml` 的 push / pull request 校验，统一使用 Node 24，并增加生产启动测试。旧部署文件已改名为 `.github/workflows/azure-static-web-apps.yml.disabled`，GitHub 不再加载它；删除旧 `AZURE_SWA_ENABLED` 变量和旧 SWA 部署 token，并在 Actions 页面检查是否还有 Portal 生成的其他 SWA 部署流程，若有一并停用。

新流程：`.github/workflows/azure-app-service.yml`。

- **build job**：`npm ci` → 现有与安全测试 → TypeScript → Vite / esbuild 构建 → 生产包 → `npm start` 冒烟测试 → ZIP artifact。
- **deploy job**：仅 `main` 且 `AZURE_APP_SERVICE_ENABLED=true` 时执行。使用 GitHub `production` Environment 和 OIDC；先只读检查现有目标必须为 F1 / Linux Node 24，并且两个云端构建设置均为 false，否则停止。随后只上传 ZIP，不执行资源创建、扩容或 Azure 端编译。
- ZIP 只包含 `dist/`、已打包 Express / API / shared 的 `build/server.cjs`、最小 `package.json` 和 `.deployment`。没有运行时 npm 安装、`node_modules`、TypeScript、Vite、Azure Functions host 或秘密文件。Express 及其依赖已编入 CommonJS bundle。

一次性 OIDC 配置（需要账户具备相应 Entra / IAM 权限；仓库不会自动创建身份或分配权限）：

1. GitHub Repository → Settings → Environments，新建 **`production`**，限制部署分支为 `main`；需要时添加人工审批。
2. 在 Microsoft Entra 中使用现有的部署 App registration / service principal，或由你手动注册一个免费身份。在 Certificates & secrets → Federated credentials → GitHub Actions，组织 `Steven-ZYC`、仓库 `premier-league-hackathon26`，Entity type 选择 **Environment**，Environment 填 **`production`**。
3. 联合信任必须匹配：issuer `https://token.actions.githubusercontent.com`；subject `repo:Steven-ZYC/premier-league-hackathon26:environment:production`；audience `api://AzureADTokenExchange`。本流程用了 Environment，不能误填分支 subject `...:ref:refs/heads/main`。
4. Azure IAM 给该身份现有 Web App 范围的 **Website Contributor**，并给现有 App Service Plan 范围的 **Reader**（只读 F1 检查需读取 plan）。不必分配订阅范围 Owner / Contributor。
5. GitHub → Settings → Secrets and variables → Actions：

   | 类型     | 名称                        | 内容                                                                                          |
   | -------- | --------------------------- | --------------------------------------------------------------------------------------------- |
   | Secret   | `AZURE_CLIENT_ID`           | OIDC 部署身份 Client ID                                                                       |
   | Secret   | `AZURE_TENANT_ID`           | 所属 Tenant ID                                                                                |
   | Secret   | `AZURE_SUBSCRIPTION_ID`     | 现有 Azure for Students Subscription ID                                                       |
   | Variable | `AZURE_RESOURCE_GROUP`      | 现有 Web App 所属资源组的真实名称                                                             |
   | Variable | `AZURE_WEBAPP_NAME`         | Azure Overview 中的资源 Name；默认 `pl-hackathon-web`，请核对后填写；**不是带随机后缀的域名** |
   | Variable | `AZURE_APP_SERVICE_ENABLED` | 完成 Portal 设置后填 `true`                                                                   |

6. 合并代码到 `main` 后进入 Actions → Deploy Azure App Service F1 → Run workflow，或推送 `main` 自动部署。确保只有这一个 App Service 部署流程在运行；不要同时使用 Deployment Center 自动生成的第二个流程。`azure/webapps-deploy` 只部署到现有生产站点，F1 不使用 deployment slot。

如果 Azure for Students 租户不允许配置 OIDC，可由你明确选择 Publish Profile 备选：在现有 Web App 的 Configuration / General settings 开启 **SCM Basic Auth Publishing Credentials**（仅此备选需要），Overview → Download publish profile；将完整 XML 存为 GitHub Secret **`AZURE_WEBAPP_PUBLISH_PROFILE`**。在 deploy job 中移除 `azure/login` 和依赖 Azure CLI 登录的只读预检步骤，手动核对 F1 / Node 24 / 禁用云端构建后，给 `azure/webapps-deploy@v3` 增加 `publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}`。此备选不使用 OIDC 三个 ID，也不需要 `id-token: write`；其余构建和上传步骤保持不变。Profile 含密码，绝不提交 XML、粘贴日志或发送给其他人。默认工作流**只实现 OIDC，不会静默退回密码认证**。[微软 GitHub Actions 部署说明](https://learn.microsoft.com/en-us/azure/app-service/deploy-github-actions)。

### 4. F1 的运行边界

F1 是共享计算，当前公布的限额为每天 60 CPU 分钟、1 GB 内存、1 GB 存储；不支持 Always On，空闲后可能休眠和冷启动，不能承诺持续在线的生产 SLA。[官方 Linux 计划说明](https://azure.microsoft.com/en-us/pricing/details/app-service/linux/)。这里只运行单个 Node 进程，V8 old-space 上限 256 MB（不等于整个进程 RSS 上限），请求体上限 250,000 字节，拒绝压缩请求体以控制解压内存开销；静态文件直接发送，带哈希的 assets 长缓存。

保留每身份每实例每分钟 12 次实际上游 AI 请求、20 分钟 / 最多 200 条缓存、最多 1,000 个身份限流桶及相同请求合并。**内存状态在休眠、重启、发布后重置，不是持久预算控制**。不启用额外数据库或缓存服务；模型费用仍由 DeepSeek 单独计费，可在 DeepSeek 账户自行设置支出额度。当前浏览器的比赛数据仍保存在 localStorage。

## 数据与导入

- 三场内置比赛均为 **虚构演示数据**，不对应真实赛果，包含进球、追平、红牌、VAR 等转折；每场至少 20 条事件。
- 比赛保存在当前浏览器的 localStorage，清除浏览器数据会丢失；没有跨设备同步或公共比赛数据库。可导出整场 JSON 并重新导入。
- 支持粘贴或上传 UTF-8 TXT、JSON。规则解析保留每条原文，未知动作或不明确球队需要核对；同分钟射门／扑救会提示可能重复。导入预览可编辑时间、阶段、球队、球员、类型、关联事件与原文，确认后保存。
- `45+2` 位于上半场；其后才是下半场 `46`。同分钟事件使用输入顺序，游标是事件序号，没有凭空补秒数。
- 原文只作为输入数据；AI 解析结果也需要通过结构校验和人工核对。不要将无法确认的球队或球员归属猜成事实。

TXT 示例（每行一条）：

```text
0 开场，比赛开始
12 主队进球
38 客队进球，扳平比分
45+2 主队角球
下半场
46 客队射门偏出
67 主队射门被门将扑出
90+3 终场，比赛结束
```

JSON 使用 `shared/types.ts` 的 `Match` 结构；可先导出一场演示比赛作为完整模板。最小结构如下，未提供的统计字段应省略：

```json
{
  "id": "my-match",
  "title": "我的复盘",
  "competition": "自定义赛事",
  "date": "2026-10-28",
  "home": { "name": "主队", "short": "H", "color": "#8958ff" },
  "away": { "name": "客队", "short": "A", "color": "#f6d52a" },
  "coverage": "excerpt",
  "source": "个人记录",
  "rawInput": "12 主队进球",
  "demo": false,
  "events": [
    {
      "id": "e1",
      "period": 1,
      "displayTime": "12",
      "order": 0,
      "activeMinute": 12,
      "team": "home",
      "type": "goal",
      "rawText": "12 主队进球",
      "confirmed": true
    }
  ],
  "duration": 90
}
```

可选 `finalStats:{home:{...},away:{...}}` 和 `snapshots:[{cursor:事件索引,home:{...},away:{...}}]`。支持进球、射门、射正、角球、犯规、黄红牌、传球、成功传球、传球成功率、控球率和明确导入的 xG。终场统计只在终场总览显示；快照只在到达对应事件后可用；缺失字段显示「未提供」。节选记录的计数标为「至少／已记录」，不冒充完整统计。

## 势头规则

```text
M_T(t) = clamp(50 + Σ[w_T(e) × 2^(-Δactive(t,e)/3)], 0, 100)
```

只使用当前游标及以前、最近 8 个有效比赛分钟的已确认事件。50 为中性、半衰期 3 分钟，两队独立，不要求相加为 100。这是未校准的可解释原型指标，**不是胜率、xG 或交易价格**。集中参数位于 `shared/engine.ts`。

| 事件       | 所属队 | 对手 |
| ---------- | -----: | ---: |
| 进球       |    +12 |   -6 |
| 射正未进   |     +5 |   -2 |
| 射偏／封堵 |     +2 |    0 |
| 角球       |     +1 |    0 |
| 红牌       |     -8 |   +3 |

乌龙球按实际受益方计分；点球判罚本身不加权，执行成功用进球、执行未进保留事实并不给进球权重。VAR 取消在判罚时撤销相关进球的剩余信号和比分，早先回放仍保留当时已知状态。关联射门／扑救不重复计分；进球关联的射门由进球贡献替代。红牌后的场上人数持续记录，不因势头信号衰减恢复。无事件时回归 50 代表旧信号衰减；明确缺失区间会断线。

## AI 边界与验证

`/api/predict`、`/api/commentary` 和 `/api/parse` 分别负责方向预测、改写和解析。预测与解说的服务端重新建立白名单上下文，过滤到当前事件；不会向模型传入整场原始输入、未来事件、终场统计、尚未揭晓的终场比分或来源／标题中的附加文本。解说即使在终场调用，也只发送目标事件及以前的上下文。解析接口仅在用户主动选择 AI 解析时接收待解析原文，结果仍须核对。

预测固定在生成时的游标、球队与输入版本，缓存还包含服务端计算的完整输入摘要及模型；改变未来输入也会让旧缓存失效。揭晓用同一公式计算下一有效事件后的实际指数，绝对差值小于 0.5 记为持平。无密钥返回明确的 `503 AI_UNAVAILABLE`，规则解说与真实 AI 输出分别标注；模型失败不阻断基础复盘。

`tests/engine.test.ts` 覆盖阶段排序、同分钟顺序、VAR、去重、缺失统计、前缀不受未来改动影响；`tests/api.test.ts` 使用模拟响应验证请求中的未来隔离、身份、无密钥降级、输出格式、缓存失效与限流。模拟测试不等于真实 DeepSeek 在线验证；真实联调需配置个人密钥。

## 首次云端部署后验收清单

以下是**真实部署后待执行**的验收，不能用本地／模拟测试替代。没有 Azure 凭据、OAuth 配置或真实 DeepSeek key 时，不宣称完成云端部署／登录／模型在线验证。

1. **首页与刷新**：打开目标域名，匿名可见三场演示、简繁英切换和手机布局；进入复盘再刷新，仍为正常页面。Network 中 `/assets/*` 返回 JS / CSS，缺失资源、未知 `/api/*` 返回 404，不能回退为首页 HTML。
2. **健康**：匿名 GET `/api/health` 返回 `200`，JSON 为 `ok:true`、`authRequired:true`、正确的 `aiConfigured/model`，没有 API key 或 OAuth token。
3. **匿名与伪造认证**：无 Cookie 的 POST `/api/predict`、`/api/commentary`、`/api/parse` 均返回 `401 AUTH_REQUIRED`。特别测试下方伪造的 Easy Auth principal，**仍必须 401**；若可绕过，先停止开放 AI 并检查 Easy Auth 配置和入口。
4. **GitHub 登录／退出**：访问 `/.auth/login/github?post_login_redirect_uri=/`，在 GitHub 授权后回到首页。登录后 `/.auth/me` 返回 Easy Auth **数组**，包含 `provider_name` / `user_id` / `user_claims`（不是 SWA 的 `clientPrincipal`；其中可能带 token，不要公开截图或日志）。退出 `/.auth/logout?post_logout_redirect_uri=/` 后，API 再次 401。
5. **无密钥降级**：临时移除 `DEEPSEEK_API_KEY`，保存并重启；登录后 AI 解析、预测或解说返回 `503 AI_UNAVAILABLE`，规则导入、图表和基础回放继续可用；不会生成假的 AI 预测。
6. **真实 DeepSeek**：配置真实 key，保存重启，health 显示已配置；登录后在比赛中途生成一条 AI 解说和方向预测，Network 中对应 POST 返回 200，标记真实 AI。重复相同请求验证 `cached:true`，继续到下一有效事件比较实际方向。不要把规则解说或模拟响应当作在线模型验收。
7. **失败与限流**：无效 key 应返回通用 `502 AI_UPSTREAM_ERROR`，不显示上游响应原文。单一身份一分钟发起超过 12 次**不同的、未命中缓存的**上游调用，第 13 次返回 429；重复命中缓存不消耗上游额度。不要为了验收持续耗费模型额度。
8. **内容与安全**：检查浏览器下载的所有前端 chunks、HTTP 响应和应用日志没有真实 key；`/.env`、`/package.json`、`/build/server.cjs` 不能下载。确认 Azure 日志只显示 `npm start` / Node 启动，没有 `npm install`、`vite build`、`tsc`、Oryx 构建或 Functions host。
9. **业务回归**：导入带 `45+2`、同分钟动作、关联扑救和 VAR 的 TXT／JSON，核对保存，切换两种模式保留游标，终场自动停止；早期回放不出现终场统计。导出／重新导入、localStorage 恢复、改动事件后 AI 缓存失效均可用。
10. **费用与恢复**：Portal 确认仍为 F1、Always On 关闭、无新增收费资源。空闲休眠／重启后允许冷启动，首页和 health 恢复；内存缓存／限流重新计时。不要为消除冷启动自动升级套餐。

无 Cookie 的 Linux 终端检查（响应中只应有普通健康信息／401）：

```bash
base='https://pl-hackathon-web-bmetckfaa9e4awhg.germanywestcentral-01.azurewebsites.net'
curl -i "$base/api/health"
curl -i -X POST "$base/api/predict" -H 'Content-Type: application/json' --data '{}'
# 这是公开的伪造测试身份，不是真实 token；平台必须移除／替换它。
forged=$(node -e 'process.stdout.write(Buffer.from(JSON.stringify({auth_typ:"github",claims:[{typ:"http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",val:"forged"}]})).toString("base64"))')
curl -i -X POST "$base/api/parse" -H 'Content-Type: application/json' \
  -H "X-MS-CLIENT-PRINCIPAL: $forged" \
  --data '{"local":true,"userId":"github:forged","home":"Home","away":"Away","raw":"12 Home goal","useAI":true}'
```

`tests/server.test.ts` 验证 Easy Auth 格式、只读开关关闭时拒绝伪造身份、请求体限制、错误保密和 HTTP 限流；`tests/production.test.mjs` 在不含 `node_modules` 的真实发布目录用 `npm start` 启动，验证端口、首页、静态资源、SPA 回退、API、敏感文件隔离和关闭认证时的 Header 伪造。原有引擎、翻译和 API 测试继续保留；DeepSeek 使用模拟响应，不花费真实模型额度。上游请求超时仍为 35 秒。

代码入口：`src/` 前端，`shared/` 数据和计算，`api/src/` 复用的业务服务，`server/` Express 与 Easy Auth 适配，`scripts/dev-server.ts` 本地完整开发服务。

## 静态资源与语言

球队徽章来自 [football-data.org](https://www.football-data.org/)，仅用于球队识别；品牌权利属于各球队。字体使用 Google Fonts，网络不可用时回退到系统字体。繁体界面通过 [OpenCC JavaScript](https://github.com/nk2028/opencc-js) 在首次切换时按需加载转换词典；原始赛况保留来源文字。
