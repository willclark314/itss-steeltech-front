# ITSS Steeltech 前端

ITSS Steeltech 前端管理系统，基于 Vue 3 + Element Plus 构建。

## 技术栈

| 依赖 | 版本 | 说明 |
|------|------|------|
| Node.js | 22.22.0 | 运行环境（Vite 8 要求 ^20.19.0 或 >=22.12.0） |
| npm | 10.9.4 | 包管理器 |
| Vue | ^3.5.34 | 前端框架 |
| Vite | ^8.0.12 | 构建工具 |
| Element Plus | ^2.14.1 | UI 组件库 |
| @element-plus/icons-vue | ^2.3.2 | Element Plus 图标 |
| Vue Router | ^5.1.0 | 路由管理 |
| unplugin-auto-import | ^21.0.0 | API 自动导入 |
| unplugin-vue-components | ^32.1.0 | 组件按需引入 |
| @vitejs/plugin-vue | ^6.0.6 | Vue SFC 支持 |

## 快速开始

```bash
# 安装依赖
npm install

# 启动后端（另开终端，见 itss-steeltech-back）
# python run.py

# 启动开发服务器
npm run dev

# 生产构建
npm run build

# 预览构建结果
npm run preview
```

开发服务器默认地址：http://localhost:5173

开发时 Vite 将 `/api` 代理到后端（默认 `http://localhost:5000`），需先启动 Flask 后端。

## 项目结构

```
src/
├── api/                # API 请求封装
├── layouts/            # 页面布局
├── models/             # 领域模型与类型定义
├── router/             # 路由配置与登录守卫
├── styles/             # 全局样式
├── utils/              # 工具函数（含 Token 读写）
├── views/              # 页面视图
├── App.vue
└── main.ts
```

## 路由

| 路径 | 页面 | 说明 |
|------|------|------|
| `/login` | 登录页 | 公开路由，无需登录 |
| `/home` | 首页 | 需登录后访问 |

路由守卫逻辑：

- 未登录访问受保护页面 → 重定向至 `/login`
- 已登录访问 `/login` → 重定向至 `/home`

## 认证与接口

Token 存储在 `localStorage`（键名：`itss_token`），登录成功后写入，退出登录时清除。后续 API 请求会自动在 Header 中携带 `Authorization: Bearer <token>`。

### 登录接口

```
POST /api/auth/login
Content-Type: application/json
```

请求体：

```json
{
  "username": "admin",
  "password": "123456"
}
```

响应体：

```json
{
  "token": "eyJ...",
  "user": { ... }
}
```

### 开发测试账号

| 用户名 | 密码 | 说明 |
|--------|------|------|
| admin | 123456 | 开发管理员 |
| user | 123456 | 测试用户 |

账号由后端 `ensure_dev_users()` 初始化，默认密码可通过 `DEFAULT_LOGIN_PASSWORD` 环境变量修改。

## 前后端联调

### 请求流向

```
开发环境（npm run dev）
  浏览器 → fetch /api/xxx → Vite 代理 → 后端 http://localhost:5000/api/xxx

生产环境（npm run build）
  浏览器 → fetch /api/xxx → Nginx 反向代理 → 后端服务
```

### 本地联调步骤

1. 启动后端（`itss-steeltech-back`）
2. 启动前端：`npm run dev`
3. 访问 http://localhost:5173

自定义后端地址时，创建 `.env.development.local`（已被 git 忽略）：

```env
VITE_API_PROXY_TARGET=http://192.168.1.100:5000
```

### 生产部署

生产环境没有 Vite 代理，需由 **Nginx** 将 `/api` 转发到后端：

```nginx
location /api/ {
    proxy_pass http://backend-server:5000/api/;
}
```

前端构建产物部署到 Nginx 静态目录，`VITE_API_BASE_URL` 保持 `/api` 即可同源访问。

### 联调常见问题

| 现象 | 原因 | 处理 |
|------|------|------|
| 404 | 后端路径不一致 | 对齐 `/api` 前缀和接口路径 |
| CORS 错误 | 未走代理，直接跨域请求后端 | 不要改 `VITE_API_BASE_URL` 为绝对地址 |
| 401 | Token 格式或鉴权逻辑不同 | 确认后端接受 `Authorization: Bearer <token>` |
| 连接拒绝 | 后端未启动或端口不对 | 检查 `VITE_API_PROXY_TARGET` |

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `VITE_API_BASE_URL` | `/api` | 后端 API 基础路径 |
| `VITE_API_PROXY_TARGET` | `http://localhost:5000` | 开发时代理目标地址 |

配置文件：`.env`、`.env.development`、`.env.example`（说明模板）
