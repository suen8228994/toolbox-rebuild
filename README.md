# Toolbox 多功能工具箱

完整的 Toolbox 应用程序，包含 NestJS 后端和 Electron 前端。

## 项目结构

```
toolbox-rebuild/
├── backend/              # NestJS 后端
│   ├── src/
│   │   ├── controllers/  # 控制器
│   │   ├── services/     # 服务
│   │   ├── modules/      # 模块
│   │   ├── utils/        # 工具函数
│   │   └── main.ts       # 入口文件
│   ├── resources/        # 资源文件
│   ├── package.json
│   └── tsconfig.json
├── frontend/             # Electron 前端
│   ├── src/
│   │   ├── main.js       # Electron 主进程
│   │   ├── preload.js    # 预加载脚本
│   │   └── renderer/     # 渲染进程
│   └── package.json
└── package.json          # 根配置
```

## 功能特性

### 批量任务
1. **亚马逊批量测活** - 批量检测 Amazon 账号存活状态
2. **亚马逊批量注册** - 批量注册 Amazon 新账号

### 其他工具
3. **Cookie转换** - Cookie 格式转换工具
4. **Roxy转HubStudio** - RoxyBrowser 到 HubStudio 格式转换
5. **小火箭二维码生成** - Shadowrocket 配置二维码生成器
6. **微软邮箱取软** - Microsoft 邮箱验证码获取

## 技术栈

### 后端
- NestJS 10.x
- Socket.IO 4.6
- TypeScript
- Microsoft Graph API
- Sharp (图像处理)

### 前端
- Electron 28.x
- Socket.IO Client
- Particles.js (粒子背景效果)
- 原生 JavaScript

## 安装

### 方式一：一键安装所有依赖
```bash
npm install
```

### 方式二：分别安装
```bash
# 安装后端依赖
npm run install:backend

# 安装前端依赖
npm run install:frontend
```

## 启动

### 方式一：同时启动前后端
```bash
npm start
```

### 方式二：分别启动

**启动后端服务器**
```bash
npm run start:backend
```

**启动前端应用**
```bash
npm run start:frontend
```

### 开发模式

**后端开发模式（带热重载）**
```bash
npm run dev:backend
```

**前端开发模式（带调试工具）**
```bash
npm run dev:frontend
```

## 构建

```bash
# 构建后端
npm run build:backend
```

## API 端点

### HTTP API (http://localhost:6790/api)

**地址服务**
- `POST /api/address/postal` - 根据邮编生成地址
- `GET /api/address/random` - 生成随机地址

**邮件服务**
- `POST /api/email/all` - 获取所有邮件
- `POST /api/email/latest` - 获取最新邮件
- `POST /api/email/inbox/latest` - 获取收件箱最新邮件
- `POST /api/email/inbox/all` - 获取收件箱所有邮件
- `POST /api/email/trash/all` - 获取垃圾邮件

### WebSocket 事件 (ws://localhost:6790)

**客户端发送**
- `task.start` - 启动任务
- `task.stop` - 停止任务
- `task.config` - 更新任务配置
- `response.card.info` - 返回卡片信息
- `response.email.info` - 返回邮件信息
- `response.phone.info` - 返回电话信息
- `response.proxy.info` - 返回代理信息

**服务器发送**
- `backend.task.runState` - 任务运行状态
- `run.task.log` - 任务日志
- `request.card.info` - 请求卡片信息
- `request.email.info` - 请求邮件信息
- `request.phone.info` - 请求电话信息
- `request.proxy.info` - 请求代理信息

## 配置说明

### 任务配置参数

**批量测活配置**
```javascript
{
  type: 'checklive',
  platformClient: 'hubstudio', // 或 'roxybrowser'
  complicating: 4,              // 并发数量
  singleCount: 6,               // 单次测活卡数
  colorWaitTime: 150000,        // 颜色等待时间(ms)
  sort: 'top-bottom',           // 排列顺序
  arrange: true,                // 自动排列窗口
  status: 'running'             // 任务状态
}
```

**批量注册配置**
```javascript
{
  type: 'register',
  platformClient: 'hubstudio',
  complicating: 4,
  passwordRule: 'email-password',
  bindAddress: true,
  failedDeleteEnvironment: false,
  status: 'running'
}
```

## 资源文件

项目包含以下资源文件（已从原项目复制）：
- `task.worker.js` - 任务 Worker 脚本 (8.5MB)
- `build/` - Sharp 图像处理库
- `client-dist/` - Socket.IO 客户端
- `vendor/` - libvips 依赖
- `appIcon.png` - 应用图标

## 注意事项

1. **端口占用**: 后端默认使用 6790 端口，请确保端口未被占用
2. **资源文件**: 首次运行需要确保 resources 目录下的文件完整
3. **Node版本**: 建议使用 Node.js 18.x 或更高版本
4. **依赖安装**: 如遇到安装失败，请尝试清除缓存后重新安装
   ```bash
   npm cache clean --force
   npm install
   ```

## 开发说明

### 添加新功能

1. **添加后端服务**
   - 在 `backend/src/services/` 创建服务文件
   - 在 `backend/src/controllers/` 创建控制器
   - 在 `backend/src/modules/app.module.ts` 注册服务

2. **添加前端工具**
   - 在 `frontend/src/renderer/js/tools.js` 添加工具配置
   - 实现工具特定的事件监听器
   - 更新 UI 界面

### 调试

- 后端日志会输出到控制台
- 前端可按 `F12` 打开开发者工具
- Socket.IO 连接状态显示在底部状态栏

## 故障排除

**后端启动失败**
```bash
# 检查端口占用
netstat -ano | findstr :6790

# 重新编译后端
cd backend
npm run build
```

**前端无法连接后端**
- 确保后端已启动并运行在 6790 端口
- 检查防火墙设置
- 查看浏览器控制台的错误信息

**资源文件缺失**
- 确保 `backend/resources/` 目录包含所有必需文件
- 从原项目重新复制资源文件

## 许可证

MIT License

## 更新日志

### v1.0.0 (2025-12-08)
- 初始版本发布
- 完整实现所有核心功能
- NestJS 后端架构
- Electron 前端界面
- Socket.IO 实时通信
- 粒子背景效果
- 所有 6 个主要工具功能

## 联系方式

如有问题或建议，请提交 Issue。

---

**Happy Coding! 🚀**
