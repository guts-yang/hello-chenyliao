# Web

React 18 + Vite 单页应用，使用 TypeScript、Tailwind CSS、framer-motion 与 lucide-react。视觉语言参考 Prisma：黑色电影感、暖奶油色、Noto Sans SC 与动效；内容为廖晨扬中文单语个人作品集。

```bash
npm install --prefix web
npm run dev --prefix web
npm run build --prefix web
```

开发服务器将 `/api` 代理到 `http://localhost:8080`，可通过 `VITE_API_PROXY_TARGET` 覆盖。生产环境也可用 `VITE_API_BASE_URL` 指定 API 地址。所有 API 请求均携带 cookie credentials。

## 路由

- 公开站：`/`、`/projects/:slug`、`/experience/:slug`（`/zh`、`/en` 旧路径兼容跳转）。
- 管理后台：`/admin/login`、`/admin`、`/admin/{section}`（profile、projects、experiences、honors、education、timeline、resume、media、visuals、settings、audit）。`/admin/visuals` 可上传、预览并保存首页视频和三类图标。后台不挂载公开 Navbar / Chat / ContentProvider。

后台写操作通过 `web/src/lib/adminApi.ts` 自动读取 CSRF cookie 并注入 `X-CSRF-Token`。公开内容 API 前缀为 `/api/public/*`；简历下载为 `/api/resume.pdf`。

## Open Graph

`index.html` 提供基础静态 Open Graph 元数据，客户端路由会动态更新页面标题和描述。本站是纯 SPA，未执行 JavaScript 的搜索引擎或社交平台抓虫只能读取基础元数据，无法获得每个详情路由的动态 OG 内容；若需要路由级分享卡片，应在网关增加预渲染或 SSR。
