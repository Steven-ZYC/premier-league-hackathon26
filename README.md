# PitchPulse · 看球牛牛

足球赛后复盘网站：同一场比赛，紫色「专业版」用两队独立势头曲线看转折，黄色「球迷版」用中立／主队／客队三种立场读赛况。React + TypeScript + Vite，后端为 Azure Static Web Apps 的 Managed Azure Functions，适配 **Free** 托管计划。

界面提供简体中文、繁体中文和英文切换；原始赛况、球队名称及 AI 生成内容保留来源语言。桌面端并排分析两队，窄屏下纵向排列；两种模式共享比赛、回放位置、播放状态与速度。

## 本地运行

需要 Node.js **22.12+**、npm 和 Git。

```powershell
git clone https://github.com/Steven-ZYC/premier-league-hackathon26.git
cd premier-league-hackathon26
npm ci
npm run dev:full
```

打开终端显示的 `http://127.0.0.1:5173`。API 在 `127.0.0.1:7071`，本地开发服务仅绑定回环地址，以本地开发身份调用，无需安装 Azure Functions Core Tools。只体验前端也可使用 `npm run dev`；没有 API 时会明确显示 AI 未连接。

```powershell
npm test
npm run build
npm ci --prefix api
npm run build --prefix api
```

`npm run preview` 预览静态生产产物；需要完整 AI API 时使用 `dev:full` 或部署到 Azure。

## 配置 DeepSeek

```powershell
Copy-Item .env.example .env
```

在 `.env` 填入 `DEEPSEEK_API_KEY`，按需要调整 `DEEPSEEK_MODEL`，重启 `npm run dev:full`。默认模型为 `deepseek-flash`，请求发送到官方 `https://api.deepseek.com/chat/completions`，使用 JSON Output 并再次校验结构。模型名称可随 DeepSeek 服务调整，参见 [DeepSeek 官方 API 文档](https://api-docs.deepseek.com/api/create-chat-completion/)。

密钥只由服务端读取；不要添加 `VITE_` 前缀，不要提交 `.env` 或 `api/local.settings.json`。DeepSeek API 的使用费用由其服务单独计费，**Azure 免费托管不包含模型费用**。未配置密钥时，导入、事件核对、图表、回放及规则解说仍可使用；不会伪造 AI 预测。

## 部署到 Azure Static Web Apps Free

1. 在 Azure Portal 创建 **Static Web App**，计划选择 **Free**，选择此 GitHub 仓库的 `main` 分支。仓库保持 Public。
2. 构建设置为前端目录 `/`、API 目录 `api`、输出目录 `dist`。仓库已有工作流，请保留一个实际部署流程，避免与 Portal 自动创建的流程重复触发。
3. 本仓库提供的部署流程会先执行根目录安装、测试和构建，再执行 API 安装和打包。API 使用 esbuild 将共享规则、解析器和服务打包为 `api/dist/functions.cjs`，无需在云端访问仓库外目录。
4. 若使用仓库中的 `.github/workflows/azure-static-web-apps.yml`：在 GitHub Repository Settings → Secrets and variables → Actions 添加 secret **`AZURE_STATIC_WEB_APPS_API_TOKEN`**（从 Azure 的部署令牌取得），以及 repository variable **`AZURE_SWA_ENABLED=true`**，随后手动运行工作流或推送 `main`。变量未配置时部署任务自动跳过，常规 CI 仍会执行。
5. Azure Static Web App → Environment variables / Configuration 添加 **`DEEPSEEK_API_KEY`** 和可选的 **`DEEPSEEK_MODEL=deepseek-flash`**。它们是 Functions 的服务端环境变量，不是 GitHub 前端构建变量。
6. 部署成功后，首页与离线复盘公开可用。AI 接口需要通过 `/.auth/login/github` 登录；退出用 `/.auth/logout`。`/api/health` 可匿名检查是否配置 AI，不暴露密钥。

`public/staticwebapp.config.json` 会被 Vite 复制到发布根目录，配置 SPA 回退、`node:22` Managed Functions 和 API 身份规则。[Azure 托管 API 说明](https://learn.microsoft.com/en-us/azure/static-web-apps/apis-functions)、[配置文件说明](https://learn.microsoft.com/en-us/azure/static-web-apps/configuration)、[用户身份头说明](https://learn.microsoft.com/en-us/azure/static-web-apps/user-information)。本项目未自动创建 Azure 云资源或订阅，也没有预置部署令牌。

Node.js 22 在 [SWA 官方托管 API 运行时表](https://learn.microsoft.com/en-us/azure/static-web-apps/languages-runtimes#api) 中受支持。工作流使用 Azure 部署令牌上传，不创建 PR 评论，因此 GitHub 权限保持 `contents: read`，不需要 `pull-requests: write`。`skip_api_build: true` 指向已经完成构建、包含 `host.json`、`package.json`、运行依赖和 `dist/functions.cjs` 的 `api/`；共享 TypeScript 已编入该 bundle，无须另行复制 `shared/` 到云端。[官方预构建部署说明](https://learn.microsoft.com/en-us/azure/static-web-apps/build-configuration#skip-building-the-api)。

生产 Functions 通过 Static Web Apps 边缘传入的 `x-ms-client-principal` 读取身份，配合路由的 `authenticated` 权限校验；请始终通过 SWA 托管入口使用，不要将同一函数作为可任意伪造身份头的独立公开服务。付费 AI 调用有每身份每实例每分钟 12 次的内存限流、20 分钟有界缓存及请求体上限。**内存限流不是跨实例的全局预算控制**；若开放大规模使用，应增加共享存储限流／网关预算控制。

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

## 首次云端部署后检查

以下是部署者需要在真实 SWA 地址上执行的检查，仓库的本地验证不替代云端结果：

1. 打开首页，确认三场虚构演示、语言切换和手机布局可用；刷新页面仍能访问。
2. 匿名访问 `/api/health`，预期 `200` 且 `aiConfigured` 与环境配置一致；响应中没有密钥。匿名 `POST /api/predict` 预期 `401`。
3. 通过 `/.auth/login/github` 登录；在 `/.auth/me` 核对返回有效 `clientPrincipal`。退出后 AI 路由再次返回 `401`。
4. 没有 DeepSeek 密钥时，登录后的 AI 调用应显示「尚未连接 AI」；规则导入、两种复盘模式和图表仍可使用。
5. 配置密钥后，从开场回放至比赛中途，生成一条真实 AI 解说并展开原文核对。检查 AI 标签、缓存标签和失败后的重试；不要把规则内容当作 AI 验证结果。
6. 中途选择球队并生成方向预测，继续到下一有效事件，再比较预测与实际方向；终场不能生成下一事件预测。不应显示未经校准的准确率或概率。
7. 导入带 `45+2`、同分钟动作、关联扑救和 VAR 取消的 TXT／JSON，核对后保存；切换两种模式保留游标，终场播放自动停止。终场统计不能出现在早期回放。
8. 导出 JSON、刷新后确认浏览器保存，再重新导入；编辑并保存事件后旧 AI 缓存失效。根据实际开放规模决定是否接入跨实例限流或独立模型支出预算。

服务端 DeepSeek 请求超时为 35 秒，避免长时间等待超出 SWA HTTP 请求窗口；上游错误会返回友好消息，用户可重试。尚未提供 Azure 地址和个人密钥时，只能完成本地与模拟验证。

代码入口：`src/` 前端，`shared/` 数据和计算，`api/src/` 云函数服务，`scripts/dev-server.ts` 本地完整开发服务。

## 静态资源与语言

球队徽章来自 [football-data.org](https://www.football-data.org/)，仅用于球队识别；品牌权利属于各球队。字体使用 Google Fonts，网络不可用时回退到系统字体。繁体界面通过 [OpenCC JavaScript](https://github.com/nk2028/opencc-js) 在首次切换时按需加载转换词典；原始赛况保留来源文字。
