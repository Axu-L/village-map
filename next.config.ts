import type { NextConfig } from "next";

// 部署子路径，与 nginx location 配置一致
// 修改此处时，nginx 的 location /village-map 也要同步修改
const BASE_PATH = "/village-map";

const nextConfig: NextConfig = {
  // standalone 模式：输出独立运行包，无需 node_modules，适合服务器部署
  output: "standalone",
  // 部署在子路径下
  basePath: BASE_PATH,
  // 静态资源走子路径
  assetPrefix: `${BASE_PATH}/`,
  // better-sqlite3 是原生模块，无需 webpack 处理
  serverExternalPackages: ["better-sqlite3"],
  // 把 basePath 暴露给客户端和服务端代码，便于 fetch 和静态资源 URL 拼接
  env: {
    NEXT_PUBLIC_BASE_PATH: BASE_PATH,
  },
  // 明确指定 Turbopack 根目录，避免 workspace 推断失败
  turbopack: {
    root: __dirname,
  },
  // 允许预览沙箱域名访问开发资源（HMR / 客户端 JS），避免跨域阻塞导致页面无法水合
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "*.agent-sandbox-bj-d3-gw.trae.cn",
    "*.trae.cn",
    "*.agent-sandbox-bj-d3-gw.traecontent.cn",
    "*.traecontent.cn",
    "*.svc.cluster.local",
    "*.remote-agent.svc.cluster.local",
  ],
  // 安全响应头：全局基础防护 + 上传照片 noindex
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
        ],
      },
      {
        // 上传的照片禁止搜索引擎索引
        source: "/uploads/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, noarchive" },
        ],
      },
    ];
  },
};

export default nextConfig;
