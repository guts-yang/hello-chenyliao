# gutsyang Personal Site

这是 gutsyang 的双语个人主页 / 作品集，用来展示个人简介、项目作品、实践经历、荣誉与 AI 助手。

项目已收敛为核心展示站点：前端内容主要来自 `lib/profile.ts` 的静态资料，保留可选 Go backend 支撑 AI 对话和会话历史，不再包含 Blog、Contact Form、Supabase 或 Next Admin/CMS UI。

## 核心功能

- Bento 风格首页：Profile、项目、经历、荣誉、教育和时间线集中展示。
- 项目 / 经历详情页：支持双语内容、目录、前后导航和 Open Graph 图片。
- AI 助手：访客可以用自然语言询问 profile、projects、experiences 和 resume 信息。
- 视觉体验：暗色主题、极光背景、动态文字、Reveal/Tilt 等轻量动效。
- 国际化：`/zh` 与 `/en` 双语路由。

## 技术栈

- Frontend: Next.js 15, React 18, TypeScript, App Router
- Styling: Tailwind CSS, Framer Motion, Radix Dialog, Lucide Icons
- i18n/theme: next-intl, next-themes
- AI/backend: DeepSeek API with optional Go backend proxy

## 目录说明

```text
app/
  [locale]/                 # 首页、项目详情、经历详情
  api/chat/                 # AI 聊天流式接口
  api/ai/sessions/          # AI 会话历史代理
  api/og/[type]/[slug]/     # Open Graph 图片
components/
  bento/                    # 首页卡片
  chat/                     # AI 助手 UI
  detail/                   # 详情页布局
  motion/                   # 核心动效
lib/
  ai/                       # AI prompt 与工具
  content/                  # 静态内容读取 facade
  profile.ts                # 个人资料、项目和经历数据
messages/                   # 中英文文案
backend/                    # 可选 Go API，用于 AI 会话和代理
```

## 本地启动

安装依赖：

```bash
npm install
```

复制环境变量：

```bash
cp .env.example .env.local
```

启动前端：

```bash
npm run dev
```

打开 <http://localhost:3000>，会自动跳转到带 locale 的首页。

如果需要完整 AI 会话能力，可以另开终端启动 Go backend：

```bash
npm run dev:backend
```

不配置 `DEEPSEEK_API_KEY` 时，AI 会走本地演示模式；生产环境建议配置真实 key。

## 常用命令

```bash
npm run dev          # Next.js 开发服务
npm run build        # 生产构建
npm run start        # 启动生产构建
npm run lint         # ESLint
npm run typecheck    # TypeScript 检查
npm run test:backend # 可选 Go backend 测试
```

## 部署

前端部署至少需要：

```bash
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

如启用 AI/backend：

```bash
GO_API_URL=https://api.your-domain.com
GO_API_INTERNAL_URL=http://127.0.0.1:8081
APP_ORIGIN=https://your-domain.com
DEEPSEEK_API_KEY=...
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
```

## License

MIT
