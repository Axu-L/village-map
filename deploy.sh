#!/bin/bash

set -e

APP_NAME="village-map"
PORT=3002
DATA_DIR="/usr/local/nginx/html/village-map/data"
UPLOAD_DIR="/usr/local/nginx/html/village-map/uploads"

mkdir -p "$DATA_DIR" "$UPLOAD_DIR"

echo "=== 构建镜像 ==="
docker build -t "$APP_NAME" .

echo "=== 删除旧容器 ==="
docker rm -f "$APP_NAME" 2>/dev/null || true

echo "=== 启动新容器 ==="
docker run -d \
  --name "$APP_NAME" \
  --restart always \
  -p "$PORT":3002 \
  -v "$DATA_DIR:/app/.next/standalone/data" \
  -v "$UPLOAD_DIR:/app/.next/standalone/public/uploads" \
  "$APP_NAME"

echo "=== 等待启动 ==="
sleep 3

echo "=== 容器状态 ==="
docker ps --filter name="$APP_NAME"

echo ""
echo "部署完成！访问地址: https://www.axuxtl.xyz/village-map"
echo "查看日志: docker logs -f $APP_NAME"
