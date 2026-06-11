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

# 启动开发服务器
npm run dev

# 生产构建
npm run build

# 预览构建结果
npm run preview
```

开发服务器默认地址：http://localhost:5173

## 项目结构

```
src/
├── api/
│   ├── auth.js             # 登录接口
│   └── request.js          # API 请求封装（自动携带 Token）
├── layouts/
│   └── MainLayout.vue      # 主布局（侧边栏 + 顶栏 + 退出登录）
├── router/
│   └── index.js            # 路由配置与登录守卫
├── styles/
│   └── index.css           # 全局样式
├── mock/
│   └── index.js              # 开发环境 Mock 接口
├── utils/
│   └── auth.js             # Token 读写工具
├── views/
│   ├── HomeView.vue        # 首页
│   └── LoginView.vue       # 登录页
├── App.vue
└── main.js
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
  "token": "your-jwt-token"
}
```

## 脱离后端调试（Mock）

开发环境默认开启 Mock，无需启动后端即可调试登录等功能。

### 开关方式

在 `.env.development` 中配置：

```env
VITE_USE_MOCK=true   # 开启 Mock（默认）
VITE_USE_MOCK=false  # 关闭 Mock，走真实后端代理
```

关闭 Mock 后，Vite 会将 `/api` 代理到 `VITE_API_PROXY_TARGET`（默认 `http://localhost:5000`）。

### Mock 测试账号

| 用户名 | 密码 |
|--------|------|
| admin | 123456 |
| user | 123456 |

### 新增 Mock 接口

在 `src/mock/index.js` 的 `handlers` 中按 `"METHOD /path"` 格式添加：

```js
'GET /users': async () => {
  return [{ id: 1, name: '张三' }]
},
```

> Mock 仅在 `import.meta.env.DEV` 且 `VITE_USE_MOCK=true` 时生效，生产构建不会包含 Mock 逻辑。

## 前后端联调

开发阶段用 Mock，联调真实后端时只需切换模式，**业务代码（`src/api/`）无需修改**。

### 请求流向

```
Mock 模式（npm run dev）
  浏览器 → request.js → src/mock/index.js → 返回模拟数据

联调模式（npm run dev:api）
  浏览器 → fetch /api/xxx → Vite 代理 → 后端 http://localhost:5000/api/xxx

生产环境（npm run build）
  浏览器 → fetch /api/xxx → Nginx 反向代理 → 后端服务
```

### 本地联调步骤

**1. 启动后端**（确保接口前缀为 `/api`，或在代理中做路径映射）

**2. 启动前端联调模式**

```bash
npm run dev:api
```

该命令加载 `.env.api`（`VITE_USE_MOCK=false`），Vite 将 `/api` 代理到 `VITE_API_PROXY_TARGET`。

**3. 确认接口契约与 Mock 一致**

以登录为例，后端需提供：

```
POST /api/auth/login
请求: { "username": "...", "password": "..." }
响应: { "token": "..." }
```

Mock 里定义的接口路径、请求体、响应体应与后端 API 文档保持一致，这样从 Mock 切到联调时前端零改动。

### 切换方式汇总

| 方式 | 命令/配置 | 适用场景 |
|------|-----------|----------|
| Mock 开发 | `npm run dev` | 日常前端开发，无后端 |
| 联调后端 | `npm run dev:api` | 本地前后端联调 |
| 个人覆盖 | 创建 `.env.development.local` | 自定义后端地址，不提交 git |
| 生产构建 | `npm run build` | 部署上线（Mock 自动关闭） |

`.env.development.local` 示例（已被 git 忽略）：

```env
VITE_USE_MOCK=false
VITE_API_PROXY_TARGET=http://192.168.1.100:8080
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
| 404 | 后端路径与 Mock 不一致 | 对齐 `/api` 前缀和接口路径 |
| CORS 错误 | 未走代理，直接跨域请求后端 | 联调时用 `dev:api`，不要改 `VITE_API_BASE_URL` 为绝对地址 |
| 401 | Token 格式或鉴权逻辑不同 | 确认后端接受 `Authorization: Bearer <token>` |
| 连接拒绝 | 后端未启动或端口不对 | 检查 `VITE_API_PROXY_TARGET` |

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `VITE_API_BASE_URL` | `/api` | 后端 API 基础路径 |
| `VITE_USE_MOCK` | 开发环境 `true` | 是否使用 Mock 数据 |
| `VITE_API_PROXY_TARGET` | `http://localhost:5000` | 关闭 Mock 时的后端代理地址 |

配置文件：`.env`、`.env.development`、`.env.api`（联调）、`.env.example`（说明模板）

---

## 创建历史

### v0.2.0 — 2026-06-07

**新增开发环境 Mock，支持脱离后端调试**

#### 变更内容

1. 新增 `src/mock/index.js`，拦截 API 请求并返回模拟数据
2. `request.js` 在开发环境且 `VITE_USE_MOCK=true` 时走 Mock 层
3. 开启 Mock 时禁用 Vite 代理，避免请求转发到不存在的后端
4. 提供 admin / user 两个测试账号

---

### v0.1.0 — 2026-06-07

**新增登录功能**

#### 变更内容

1. 新增登录页 `src/views/LoginView.vue`（用户名/密码表单、校验、回车提交）
2. 新增认证工具 `src/utils/auth.js` 与登录接口 `src/api/auth.js`
3. 路由守卫：未登录拦截、已登录自动跳转
4. 主布局顶栏新增「退出登录」按钮
5. API 请求封装自动携带 Bearer Token

#### 新增文件

| 路径 | 说明 |
|------|------|
| `src/views/LoginView.vue` | 登录页视图 |
| `src/utils/auth.js` | Token 存取工具 |
| `src/api/auth.js` | 登录 API |

---

### v0.0.0 — 2026-06-07

**初始版本**，在空目录中搭建 Vue + Element Plus 前端框架。

#### 创建步骤

1. 使用 `create-vite` 脚手架初始化 Vue 3 项目（Vite 模板）
2. 安装 Element Plus 及图标库 `@element-plus/icons-vue`
3. 安装 Vue Router，配置基础路由与页面布局
4. 配置 `unplugin-auto-import`、`unplugin-vue-components` 实现 Element Plus 按需自动引入
5. 配置路径别名 `@` → `src/`
6. 集成中文 locale（`element-plus/dist/locale/zh-cn.mjs`）
7. 搭建主布局（侧边栏导航 + 顶栏 + 内容区）及首页示例
8. 添加 API 请求封装与环境变量配置

#### 初始功能

- 侧边栏 + 顶栏管理后台布局
- 首页示例（Element Plus 卡片、按钮、标签组件演示）
- 路由懒加载
- 全局 Element Plus 图标注册

#### 目录与文件

| 路径 | 说明 |
|------|------|
| `vite.config.js` | Vite 配置（插件、别名、开发服务器） |
| `jsconfig.json` | IDE 路径别名支持 |
| `src/router/index.js` | 路由定义 |
| `src/layouts/MainLayout.vue` | 主布局组件 |
| `src/views/HomeView.vue` | 首页视图 |
| `src/api/request.js` | Fetch 请求封装 |
| `src/styles/index.css` | 全局样式重置 |
