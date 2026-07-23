# 村智图 - 部署文档

花园村重点人群数字化管理平台（VillageMap）部署指南。

## 一、项目结构

```
village-map/
├── src/                    # 源码
│   ├── app/                # Next.js App Router 页面与 API
│   ├── components/          # React 组件
│   ├── db/                  # 数据库（SQLite + Drizzle ORM）
│   ├── lib/                 # 工具函数
│   └── types/               # 类型定义
├── public/                 # 静态资源
├── Dockerfile              # Docker 构建文件
├── deploy.sh               # 一键部署脚本
├── .dockerignore           # Docker 构建忽略列表
├── nginx.conf              # nginx 配置参考
├── next.config.ts          # Next.js 配置（basePath=/village-map）
├── package.json
└── .env.local              # 环境变量
```

## 二、打包

本地打包为 `.tar.gz`（已排除 node_modules、.next、data、uploads、.git、.trae）：

```bash
tar -czf village-map-deploy.tar.gz \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='data' \
  --exclude='public/uploads/*' \
  --exclude='.git' \
  --exclude='.trae' \
  --exclude='mobile-screenshots' \
  --exclude='village-map-deploy.tar.gz' \
  -C /workspace .
```

生成文件：`village-map-deploy.tar.gz`

## 三、部署步骤

### 1. 上传 tar.gz 到服务器

本地终端：

```bash
scp village-map-deploy.tar.gz root@你的服务器IP:/usr/local/nginx/html/
```

### 2. 服务器上解压

SSH 登录服务器后：

```bash
cd /usr/local/nginx/html
rm -rf village-map-old 2>/dev/null
[ -d village-map ] && mv village-map village-map-old
mkdir -p village-map
tar -xzf village-map-deploy.tar.gz -C village-map
cd village-map
```

> 保留 `village-map-old` 作为回滚备份。确认新版本正常后可删除。

### 3. 一键部署

```bash
chmod +x deploy.sh
./deploy.sh
```

`deploy.sh` 会自动完成：
1. 构建 Docker 镜像
2. 删除旧容器
3. 启动新容器（含数据持久化挂载）
4. 端口映射：宿主机 3002 → 容器 3002

数据持久化挂载：
- 数据库：`/usr/local/nginx/html/village-map/data` → `/app/.next/standalone/data`
- 上传文件：`/usr/local/nginx/html/village-map/uploads` → `/app/.next/standalone/public/uploads`

### 4. 验证启动

```bash
docker logs -f village-map
```

看到 `Ready in xxx ms` 即成功。

### 5. 配置 nginx 反向代理

在 `nginx.conf` 的 `server`（443 ssl）块中添加村智图配置（仓库 `nginx.conf` 已包含，参考用）：

```nginx
# ========== 村智图（Next.js standalone 3002） ==========
# 上传图片由 nginx 直接服务静态文件，不经过 Next.js 容器
# （避免 middleware/standalone 静态服务在反代场景下的 403 问题）
location /village-map/uploads/ {
    alias /usr/local/nginx/html/village-map/uploads/;
    expires 7d;
    add_header Cache-Control "public, noindex";
    add_header X-Robots-Tag "noindex, noarchive";
}
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
```

说明：
- `location ^~ /village-map` 用 `^~` 前缀匹配，优先级高于正则，能同时覆盖 `/village-map`、`/village-map/`、`/village-map/login` 等所有子路径，无需再写一个 `/village-map/`。
- 上传文件走 `alias` 直接由 nginx 读取磁盘，不经容器，避免 standalone 模式下静态资源 403。

重载 nginx：

```bash
nginx -t && nginx -s reload
```

### 6. 访问

浏览器打开：

```
https://www.axuxtl.xyz/village-map/login
```

演示账号：
- 用户名：`admin`
- 密码：`admin123`

## 四、环境变量

`.env.local` 内容（构建时注入）：

```bash
NEXT_PUBLIC_AMAP_KEY=0725c389055177586ede0637887fcde2
NEXT_PUBLIC_AMAP_SECRET=31b32c8992a245df88ff4a90aba5a1cf
```

如需更换高德地图 Key，修改 `.env.local` 后重新打包部署即可。

## 五、数据备份

数据库文件位于服务器：

```
/usr/local/nginx/html/village-map/data/app.db
```

备份：

```bash
cp /usr/local/nginx/html/village-map/data/app.db /usr/local/nginx/html/village-map/data/app.db.bak.$(date +%Y%m%d)
```

上传文件位于：

```
/usr/local/nginx/html/village-map/uploads/
```

## 六、后续更新

代码修改后重新打包上传，然后执行：

```bash
cd /usr/local/nginx/html/village-map
./deploy.sh
```

`deploy.sh` 会重新构建镜像并重启容器，数据库和上传文件不会丢失（已通过挂载持久化）。

## 七、常用命令

```bash
# 查看容器状态
docker ps --filter name=village-map

# 查看实时日志
docker logs -f village-map

# 进入容器
docker exec -it village-map sh

# 停止容器
docker stop village-map

# 重启容器
docker restart village-map

# 删除容器
docker rm -f village-map

# 手动重新构建并部署
cd /usr/local/nginx/html/village-map
docker build -t village-map .
docker rm -f village-map
docker run -d \
  --name village-map \
  --restart always \
  -p 3002:3002 \
  -v /usr/local/nginx/html/village-map/data:/app/.next/standalone/data \
  -v /usr/local/nginx/html/village-map/uploads:/app/.next/standalone/public/uploads \
  village-map
```

## 八、回滚

```bash
cd /usr/local/nginx/html
docker rm -f village-map
rm -rf village-map
mv village-map-old village-map
cd village-map
./deploy.sh
```
