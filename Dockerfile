# ==========================================
# 冒险岛驮狼雪人 Boss 刷新时间管理系统 Dockerfile
# ==========================================

# 阶段一：构建前端静态产物
FROM node:20-alpine AS builder

WORKDIR /app

# 复制依赖配置并使用 --legacy-peer-deps 解决 Vite 与 esbuild peer 依赖冲突
COPY package*.json ./
RUN npm install --legacy-peer-deps

# 复制源码并构建前端静态资源到 /app/dist
COPY . .
RUN npm run build

# 阶段二：生产运行镜像
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=443

# 安装生产依赖与 tsx，同样指定 --legacy-peer-deps 防止依赖解析报错
COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps && npm install -g tsx

# 复制构建产物及服务端代码
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/server ./server
COPY --from=builder /app/src/assets ./src/assets
COPY --from=builder /app/metadata.json ./metadata.json

# 创建数据持久化及 SSL 证书挂载目录
RUN mkdir -p /app/data /app/certs

# 暴露端口 (443 HTTPS 安全端口, 80 HTTP 重定向端口, 3000 开发/直连端口)
EXPOSE 443 80 3000

# 声明持久化数据卷与证书卷
VOLUME ["/app/data", "/app/certs"]

# 启动服务端
CMD ["tsx", "server.ts"]
