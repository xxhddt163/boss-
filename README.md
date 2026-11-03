# 冒险岛驮狼雪人 Boss 刷新时间管理系统 (Docker & HTTPS 独立运行指南)

本系统支持全服 1～60 频道驮狼雪人 Boss 击杀刷新监控、多人接单协同、实时倒计时、自动并发防重，采用 **纯原生 Node.js 独立容器运行 HTTPS + WSS（无需 Nginx 反向代理）**。

---

## 目录结构

```text
snowman-tracker/
├── Dockerfile              # Node.js + React 前后端一体化构建镜像
├── docker-compose.yml      # 单容器原生 HTTPS 运行编排 (无需 Nginx)
├── generate-cert.sh        # 自签名 SSL 证书一键生成脚本
├── certs/                  # 存放 server.crt 与 server.key 证书文件
├── data/                   # 宿主机数据库持久化目录 (db.json 与快照)
├── src/                    # 前端 React 源码
├── server.ts               # 后端 Express + WebSocket 服务端 (原生支持 HTTPS)
└── package.json
```

---

## 运行步骤（极简 3 步）

### 第一步：准备 SSL 证书
将您的 SSL 证书放入项目目录下的 `certs/` 文件夹中：
- 证书公钥：`certs/server.crt`
- 证书私钥：`certs/server.key`

> 💡 **局域网测试或无正式域名时：**
> 在终端执行自带的自签名证书生成脚本：
> ```bash
> bash generate-cert.sh
> ```
> 脚本会自动生成有效期 1 年的自签名证书放入 `certs/` 目录。

### 第二步：一键启动 Docker Compose
在项目根目录运行：
```bash
docker compose up -d --build
```
> Docker 将自动完成多阶段构建，并在容器内通过原生 Node.js 监听 `443` HTTPS 端口（支持 WebSocket WSS 加密实时推送），同时在 `80` 端口自动重定向到 HTTPS。

### 第三步：访问系统
- 在浏览器打开：`https://您的服务器IP或域名`
- 若直接输入 `http://...`，系统会自动跳转至 `https://`
- 登录默认管理员账号：
  - **用户名**：`admin`
  - **初始密码**：`admin`（首次登录系统将强制提示修改密码）

---

## 常用运维命令

- **查看运行日志**：
  ```bash
  docker compose logs -f
  ```
- **停止服务**：
  ```bash
  docker compose down
  ```
- **重启服务**：
  ```bash
  docker compose restart
  ```
- **数据安全性**：
  所有频道的击杀记录与接单状态均实时持久化保存在宿主机本地的 `./data/db.json` 文件中，容器更新或重建数据绝对不丢失。
