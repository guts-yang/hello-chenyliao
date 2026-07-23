# gutsyang Personal Site

这是 gutsyang 的双语个人主页 / 作品集，用来展示个人简介、项目作品、实践经历、荣誉与 AI 助手。

架构为「个人站精简版 rainbow」：`config/` + `server/`（Go 模块化单体）+ `web/`（Vue 3 SPA）+ `utils/`。数据使用 MySQL，缓存/限流使用 Redis，媒体走可替换 ObjectStore（默认本地 `uploads/`，预留 S3）。

## 核心功能

- Bento 风格首页：Profile、项目、经历、荣誉、教育和时间线集中展示。
- 项目 / 经历详情页：支持双语内容、目录、前后导航；SPA 动态更新 document title/meta（社交抓虫见下方说明）。
- AI 助手：访客可用自然语言询问 profile、projects、experiences 和 resume；会话持久化到 MySQL（无 DB 时内存回退）。
- Admin REST API：登录、CSRF、CMS CRUD、审计、翻译、媒体上传（暂无 Admin UI）。
- 国际化：`/zh` 与 `/en` 双语路由。

## 技术栈

- Frontend: Vue 3, Vite, Vue Router, Pinia, TypeScript, TDesign Vue Next, vue-i18n
- Backend: Go 模块化单体（`server/cmd/server`）
- Data: MySQL 8 + Redis 7
- Media: local ObjectStore（预留 S3）
- AI: DeepSeek（流式 NDJSON + tool calling）

## 目录说明

```text
config/
  app.yaml                 # Go 非密钥默认配置
  env.example              # 环境变量模板
  docker-compose.yml       # 本地 MySQL + Redis
  database/migrations/     # MySQL schema（与 server embed 同步）
server/
  cmd/server/              # 唯一可部署后端入口
  internal/                # auth / content / chat / ai / media / server ...
  migrations/              # embed 用 SQL
web/
  src/                     # Vue SPA（页面、组件、stores、i18n）
utils/                     # 无业务耦合的通用工具
```

## 本地启动

```bash
# 前端依赖
npm install

# 环境变量
cp config/env.example .env

# 可选：启动 MySQL + Redis（需本机 Docker）
npm run db:up
npm run db:migrate

# 终端 1：Go API（默认 :8080）
cd server && go run ./cmd/server

# 终端 2：Vue 开发服（默认 :5173，/api 代理到 :8080）
npm run dev
```

打开 <http://localhost:5173>，会跳转到带 locale 的首页。

不配置 `DEEPSEEK_API_KEY` 时，AI 走本地演示模式。不配置 `DATABASE_URL` / MySQL 不可达时，会话与鉴权使用内存回退（重启丢失）。不配置 Redis 时，限流与缓存走进程内实现。

## 常用命令

```bash
npm run dev                 # Vue 开发服务（web workspace）
npm run build               # 生产构建前端
npm run lint                # ESLint
npm run typecheck           # Vue/TS 检查
npm run test:server         # Go 测试（需在 server/ 或设置 GO 工作目录）
npm run db:up               # 启动本地 MySQL + Redis
npm run db:down             # 停止基础设施
npm run db:migrate          # 应用数据库迁移（Go）
npm run db:migrate:status   # 查看迁移状态
npm run auth:hash -- <pwd>  # 生成 bcrypt hash
```

在 `server/` 目录：

```bash
make run                    # 启动 API
make test                   # go test ./...
make migrate                # migrate up
go run ./cmd/server hash <password>
```

## 部署

推荐生产拓扑：**Vue 静态资源 + Go API，同源反代 `/api`（以及 `/uploads`）**，这样 Admin CSRF Cookie 与 Chat Owner Cookie 最简单。

示例 Nginx：

```nginx
location /api/ {
  proxy_pass http://127.0.0.1:8080;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
location /uploads/ {
  proxy_pass http://127.0.0.1:8080;
}
location / {
  root /var/www/hello-gutsyang;
  try_files $uri $uri/ /index.html;
}
```

若前端托管在 Vercel：

1. Project Root Directory 设为 `web`（或仓库根 + workspace 安装）。
2. 必须配置同域 `/api` 反代到 Go，或显式 CORS + Cookie 方案；仅静态托管时 AI/Admin cookie 会失效。
3. 至少配置：`APP_ORIGIN`、`DATABASE_URL`、`DEEPSEEK_*`、可选 `REDIS_ADDR`。
4. **数据库迁移在部署前由 CI / 本地显式执行**（`go run ./cmd/server migrate up`），不要在进程启动热路径里隐式迁移生产库（开发可自动）。

## Open Graph 说明

纯 SPA 下，未执行 JS 的社交抓虫只能读到 `web/index.html` 的基础 meta；详情页动态 title/description 对抓虫不可见。需要路由级分享卡片时，请在网关做预渲染 / SSR。

## 学 rainbow / 故意没学

- **学了**：单一 `cmd/server`、领域分包、配置外置、前后端分离、MySQL+Redis+对象存储端口。
- **没学**：tRPC、北极星、Kafka、多微服务、七彩石配置中心产品能力、完整 Admin UI。
