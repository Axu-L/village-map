FROM node:20-slim

RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources \
    && sed -i 's|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN npm config set registry https://registry.npmmirror.com

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
RUN cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/

# ========== 生产环境变量 ==========
# JWT 鉴权密钥（生产环境必需，否则 jwt.ts 启动校验会抛错）
ENV JWT_SECRET=90efaf41943e9e56424103ce1ed5fb0b59ea15fe9b2deb385c22e19a5b8d5f0b
# 高德地图密钥（前端 JSAPI 安全密钥，构建时注入到客户端代码）
ENV NEXT_PUBLIC_AMAP_KEY=0725c389055177586ede0637887fcde2
ENV NEXT_PUBLIC_AMAP_SECRET=31b32c8992a245df88ff4a90aba5a1cf
# 运行端口
ENV PORT=3002
ENV HOSTNAME=0.0.0.0

# standalone 运行目录：cwd 为 standalone，使 process.cwd()/data/app.db 指向挂载点
WORKDIR /app/.next/standalone
EXPOSE 3002
CMD ["node", "server.js"]
