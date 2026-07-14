# 村智图 VillageMap 部署文档

## 一、环境要求

| 项 | 要求 |
|----|------|
| 操作系统 | Linux（ CentOS / Ubuntu / Debian 均可） |
| Docker | 20.10+ |
| Nginx | 已配置反向代理（见 `nginx.conf`） |
| 端口 | 3002（容器内部，nginx 代理到 443） |
| 访问地址 | `https://www.axuxtl.xyz/village-map` |

## 二、打包说明（开发机执行）

在项目根目录执行：

```bash
tar -czf village-map.tar.gz . \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.trae' \
  --exclude='.git' \
  --exclude='village-map.tar.gz' \
  --exclude='village-map*.zip' \
  --exclude='.env.local' \
  --exclude='public/uploads/*' \
  --exclude='*.log' \
  --exclude='tsconfig.tsbuildinfo'
```

**包含内容：**
- 源码：`src/`、`public/`、`scripts/`
- 配置：`package.json`、`package-lock.json`、`next.config.ts`、`tsconfig.json`、`postcss.config.mjs`、`eslint.config.mjs`、`drizzle.config.json`
- 部署：`Dockerfile`、`.dockerignore`、`deploy.sh`、`nginx.conf`
- 数据：`data/app.db`（含 admin 用户 + 示例住户数据）
- 环境模板：`.env.example`

**已排除：** `node_modules`、`.next`、`.env.local`（含密钥）、`uploads/*`、`.git`、`.trae`、`*.log`

> **注意：** `data/app.db` 已包含在压缩包内，**无需单独上传数据库**。部署脚本会自动挂载到容器。

## 三、上传到服务器

在开发机执行（替换 `你的服务器IP`）：

```bash
scp village-map.tar.gz root@你的服务器IP:/usr/local/nginx/html/
```

## 四、服务器部署

SSH 登录服务器后执行：

```bash
# 1. 解压
cd /usr/local/nginx/html
tar -xzf village-map.tar.gz -C village-map
cd village-map

# 2. 首次部署：创建上传目录（已存在则跳过）
mkdir -p public/uploads

# 3. 给部署脚本执行权限
chmod +x deploy.sh

# 4. 一键部署
./deploy.sh
```

`deploy.sh` 会自动完成：
- `docker build` 构建镜像（基于 `Dockerfile`，node:20-slim）
- 删除旧容器
- 启动新容器（端口 3002，自动重启）
- 挂载数据卷：
  - `data/` → 容器 `/app/.next/standalone/data`（SQLite 数据库）
  - `public/uploads/` → 容器 `/app/.next/standalone/public/uploads`（上传图片）

## 五、验证部署

```bash
# 查看容器状态
docker ps --filter name=village-map

# 查看启动日志（看到 "Ready in xxx ms" 即成功）
docker logs -f village-map

# 本机健康检查
curl http://127.0.0.1:3002/village-map/api/health
# 应返回：{"ok":true}
```

访问 `https://www.axuxtl.xyz/village-map`，使用默认账号登录：

| 用户名 | 密码 |
|--------|------|
| `admin` | `admin123` |

## 六、Nginx 配置

`nginx.conf` 中已配置 `/village-map` 反向代理到 `127.0.0.1:3002`：

```nginx
# ========== 村智图（Next.js standalone 3002） ==========
location ^~ /village-map {
    proxy_pass http://127.0.0.1:3002;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 300s;
}
location /village-map/ {
    proxy_pass http://127.0.0.1:3002;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 300s;
}
```

首次部署需把 `nginx.conf` 复制到 nginx 配置目录并重载：

```bash
cp nginx.conf /usr/local/nginx/conf/nginx.conf
nginx -t          # 测试配置
nginx -s reload   # 重载
```

## 七、Dockerfile 说明

Dockerfile 内已硬编码生产环境变量（无需额外配置）：

| 环境变量 | 说明 |
|----------|------|
| `JWT_SECRET` | JWT 鉴权密钥（生产环境必需） |
| `NEXT_PUBLIC_AMAP_KEY` | 高德地图 JSAPI Key |
| `NEXT_PUBLIC_AMAP_SECRET` | 高德地图 JSAPI 安全密钥 |
| `PORT` | 运行端口（3002） |
| `HOSTNAME` | 监听地址（0.0.0.0） |

构建流程：
1. `node:20-slim` 基础镜像（阿里云镜像源加速）
2. `npm install` 安装依赖（npmmirror 加速）
3. `npm run build` 生成 standalone 产物
4. 复制 `static` 和 `public` 到 standalone
5. `WORKDIR /app/.next/standalone`，运行 `node server.js`

## 八、数据持久化

| 数据 | 宿主机路径 | 容器路径 | 说明 |
|------|-----------|---------|------|
| 数据库 | `/usr/local/nginx/html/village-map/data/app.db` | `/app/.next/standalone/data/app.db` | SQLite，含 users/households/visits/members 表 |
| 上传图片 | `/usr/local/nginx/html/village-map/uploads/` | `/app/.next/standalone/public/uploads/` | 走访照片 |

**备份：** 直接备份宿主机的 `data/` 和 `uploads/` 目录即可。

## 九、更新部署

代码更新后，重新打包上传，再次执行 `./deploy.sh` 即可。容器会重建镜像并替换旧容器，数据卷保留不丢。

## 十、常见问题

### Q1: 容器启动后访问 502
检查容器是否运行：`docker ps`。若未运行，查日志：`docker logs village-map`。

### Q2: 登录提示"登录已过期"
检查 Dockerfile 中 `JWT_SECRET` 是否设置。该变量生产环境必需。

### Q3: 地图加载不出来
检查 `NEXT_PUBLIC_AMAP_KEY` 和 `NEXT_PUBLIC_AMAP_SECRET` 是否正确（高德开放平台申请）。

### Q4: 上传图片显示不了
检查 `public/uploads/` 目录权限，确保容器可读写：`chmod -R 755 public/uploads`。
