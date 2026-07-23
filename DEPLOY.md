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

提供两种打包方式，根据需要选择：

### 方式 A：含数据库（首次部署用）

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

> **适用场景：** 首次部署，或需要重置数据库时使用。更新部署时**不要用这个包**，会覆盖线上数据库。

### 方式 B：不含数据库（更新部署用，推荐）

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
  --exclude='data' \
  --exclude='*.log' \
  --exclude='tsconfig.tsbuildinfo'
```

**比方式 A 多排除：** `data`（数据库目录）

> **适用场景：** 日常更新部署。解压不会覆盖线上数据库和上传图片，数据安全。

### 两种方式对比

| 项 | 方式 A（含数据库） | 方式 B（不含数据库） |
|---|---|---|
| `data/app.db` | 包含 | 不包含 |
| 首次部署 | 可用 | 可用（容器启动自动建表，但无初始数据） |
| 更新部署 | 会覆盖线上数据库 | 不覆盖，数据安全 |
| 推荐用途 | 首次部署 / 数据库重置 | 日常更新（推荐） |

> **建议：** 首次部署用方式 A，后续更新都用方式 B。

## 三、上传到服务器

在开发机执行（替换 `你的服务器IP`）：

```bash
scp village-map.tar.gz root@你的服务器IP:/usr/local/nginx/html/
```

## 四、服务器部署

SSH 登录服务器后执行：

```bash
# 1. 解压（-C 指定的目录必须先存在）
cd /usr/local/nginx/html
mkdir -p village-map
tar -xzf village-map.tar.gz -C village-map
cd village-map

# 2. 首次部署：创建上传目录（已存在则跳过）
mkdir -p uploads

# 3. 给部署脚本执行权限
chmod +x deploy.sh

# 4. 一键部署
./deploy.sh

# 5. 更新 nginx 配置并重载（首次部署或 nginx.conf 有变更时）
cp nginx.conf /usr/local/nginx/conf/nginx.conf
nginx -t          # 测试配置语法
nginx -s reload   # 重载生效
```

`deploy.sh` 会自动完成：
- `docker build` 构建镜像（基于 `Dockerfile`，node:20-slim）
- 删除旧容器
- 启动新容器（端口 3002，自动重启）
- 挂载数据卷：
  - `data/` → 容器 `/app/.next/standalone/data`（SQLite 数据库）
  - `uploads/` → 容器 `/app/.next/standalone/public/uploads`（上传图片）

### 上传图片说明

**重要：** `tar.gz` 包不含 `public/uploads/` 下的图片（属于用户数据，与代码分离）。

- **首次部署**：若需迁移已有图片，在开发机单独 scp 上传：
  ```bash
  scp -r public/uploads/* root@服务器IP:/usr/local/nginx/html/village-map/uploads/
  ```
- **nginx 直接服务图片**：`nginx.conf` 中 `/village-map/uploads/` 的 location 用 `alias` 直接读取宿主机 `/usr/local/nginx/html/village-map/uploads/` 下的文件，不经过 Next.js 容器，避免反代场景下的 403 问题。
- **新上传的图片**：通过走访表单上传，由容器写入挂载的 `uploads/` 目录，nginx 自动可读。

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
