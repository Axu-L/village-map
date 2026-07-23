import type { NextConfig } from "next";

// 部署子路径，可通过环境变量控制。
// 本地/nginx 部署保持 /village-map；Render/Vercel 等根域名部署设为空字符串。
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "/village-map";

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
  // 上传文件持久化到磁盘后，通过 /api/uploads 提供访问
  async rewrites() {
    return [
      {
        source: "/uploads/:path*",
        destination: "/api/uploads/:path*",
      },
    ];
  },
};

export default nextConfig;
