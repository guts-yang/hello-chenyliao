# Web

Vue 3 + Vite 单页应用，使用 Vue Router、Pinia、TypeScript、TDesign Vue Next 和 vue-i18n。

```bash
npm install --prefix web
npm run dev --prefix web
npm run build --prefix web
```

开发服务器将 `/api` 代理到 `http://localhost:8080`，可通过 `VITE_API_PROXY_TARGET` 覆盖。生产环境也可用 `VITE_API_BASE_URL` 指定 API 地址。所有 API 请求均携带 cookie credentials。

## Open Graph

`index.html` 提供基础静态 Open Graph 元数据，客户端路由会动态更新页面标题和描述。本站是纯 SPA，未执行 JavaScript 的搜索引擎或社交平台抓虫只能读取基础元数据，无法获得每个详情路由的动态 OG 内容；若需要路由级分享卡片，应在网关增加预渲染或 SSR。
