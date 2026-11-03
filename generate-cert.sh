#!/bin/bash
# ========================================================
# 快速生成局域网 / 本地测试使用的自签名 HTTPS 证书脚本
# ========================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERTS_DIR="${SCRIPT_DIR}/certs"

mkdir -p "${CERTS_DIR}"

echo "正在生成自签名 SSL 证书..."
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "${CERTS_DIR}/server.key" \
  -out "${CERTS_DIR}/server.crt" \
  -subj "/C=CN/ST=Shanghai/L=Shanghai/O=SnowmanTracker/OU=MapleStory/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:0.0.0.0"

chmod 600 "${CERTS_DIR}/server.key"
chmod 644 "${CERTS_DIR}/server.crt"

echo "✅ 自签名 SSL 证书生成成功："
echo "   证书文件: ${CERTS_DIR}/server.crt"
echo "   私钥文件: ${CERTS_DIR}/server.key"
echo "您现在可以使用 'docker compose up -d' 启动 HTTPS 服务！"
