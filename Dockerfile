FROM node:20-slim

RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources \
    && sed -i 's|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN npm config set registry https://registry.npmmirror.com

# ========== 生产环境变量（必须在 npm run build 之前设置） ==========
# jwt.ts 在模块加载时校验 JWT_SECRET，构建收集页面数据时会触发该校验
# NEXT_PUBLIC_* 会在构建时内联到客户端代码
ENV JWT_SECRET=90efaf41943e9e56424103ce1ed5fb0b59ea15fe9b2deb385c22e19a5b8d5f0b
ENV NEXT_PUBLIC_AMAP_KEY=0725c389055177586ede0637887fcde2
ENV NEXT_PUBLIC_AMAP_SECRET=31b32c8992a245df88ff4a90aba5a1cf

COPY package*.json ./
# better-sqlite3 是原生模块，无预编译二进制时需 node-gyp 编译。
# 用环境变量让 node-gyp 从国内镜像下载 node headers，避免访问 nodejs.org 超时（ETIMEDOUT）
# npm v10+ 已移除 disturl 配置项，改用 node-gyp 读取的 NODEJS_ORG_MIRROR
ENV NODEJS_ORG_MIRROR=https://npmmirror.com/mirrors/node
RUN npm install --foreground-scripts
COPY . .
RUN npm run build
RUN cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/

# 运行端口与监听地址
ENV PORT=3002
ENV HOSTNAME=0.0.0.0

# standalone 运行目录：cwd 为 standalone，使 process.cwd()/data/app.db 指向挂载点
WORKDIR /app/.next/standalone
EXPOSE 3002
CMD ["node", "server.js"]
