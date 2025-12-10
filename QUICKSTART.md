# Toolbox 快速开始指南

## 一、系统要求

- **操作系统**: Windows 10/11
- **Node.js**: 18.x 或更高版本
- **内存**: 建议 8GB 以上
- **磁盘空间**: 至少 500MB

## 二、安装步骤

### 方式一：使用安装脚本（推荐）

1. 双击运行 `install.bat`
2. 等待安装完成（约 3-5 分钟）
3. 看到"安装完成"提示即可

### 方式二：手动安装

```bash
# 1. 安装后端依赖
cd backend
npm install

# 2. 构建后端
npm run build

# 3. 安装前端依赖
cd ../frontend
npm install
```

## 三、启动应用

### 方式一：使用启动脚本（推荐）

**同时启动前后端（最简单）**
- 双击 `start-all.bat`

**分别启动**
1. 双击 `start-backend.bat` 启动后端
2. 双击 `start-frontend.bat` 启动前端

### 方式二：使用命令行

```bash
# 启动后端
cd backend
npm start

# 启动前端（新窗口）
cd frontend
npm start
```

## 四、使用说明

### 1. 界面导航

启动后会看到两个主要标签页：
- **批量任务**: Amazon 批量操作工具
- **其他工具**: 各类辅助工具

### 2. 批量任务

#### 亚马逊批量测活
1. 点击"亚马逊批量测活"卡片
2. 配置参数：
   - 平台客户端: HubStudio / RoxyBrowser
   - 并发数量: 建议 4
   - 单次测活卡数: 建议 6
   - 颜色等待时间: 150000ms
3. 点击"开始测活"
4. 在日志面板查看进度

#### 亚马逊批量注册
1. 点击"亚马逊批量注册"卡片
2. 配置参数：
   - 平台客户端选择
   - 并发数量
   - 密码规则
   - 是否绑定地址
3. 点击"开始注册"
4. 监控任务进度

### 3. 其他工具

#### Cookie转换
- 输入原始 Cookie
- 选择输入/输出格式
- 点击转换获取结果

#### Roxy转HubStudio
- 粘贴 RoxyBrowser 配置
- 点击转换
- 获取 HubStudio 配置

#### 小火箭二维码生成
- 输入 Shadowrocket 配置链接
- 选择二维码尺寸
- 生成二维码

#### 微软邮箱取软
1. 输入 Microsoft Graph API 凭证：
   - Client ID
   - Client Secret
   - Refresh Token
2. 选择邮件来源（收件箱/垃圾邮件）
3. 点击"获取邮件"
4. 查看邮件列表和验证码

## 五、常见问题

### 1. 后端启动失败

**问题**: 提示端口 6790 已被占用
```bash
# 检查端口占用
netstat -ano | findstr :6790

# 结束占用进程
taskkill /PID <进程ID> /F
```

**问题**: 依赖安装失败
```bash
# 清除缓存
npm cache clean --force

# 重新安装
npm install
```

### 2. 前端无法连接后端

**检查清单**:
- [ ] 后端是否已启动
- [ ] 是否显示"已连接"状态（底部状态栏）
- [ ] 防火墙是否阻止了连接
- [ ] 端口 6790 是否可访问

**解决方案**:
```bash
# 重启后端
cd backend
npm start

# 检查后端日志
# 应该看到 "Toolbox Backend Server Started Successfully!"
```

### 3. 任务执行失败

**检查事项**:
- [ ] 浏览器客户端（HubStudio/RoxyBrowser）是否已安装
- [ ] 环境配置是否正确
- [ ] 网络连接是否正常
- [ ] 日志面板中的错误信息

**调试方法**:
1. 打开日志面板查看详细错误
2. 检查任务配置参数
3. 确认资源文件完整（task.worker.js 等）

### 4. 界面显示异常

**解决方案**:
- 按 F12 打开开发者工具查看错误
- 检查控制台是否有 JavaScript 错误
- 重启应用

### 5. 资源文件缺失

**检查目录**: `backend/resources/`

应包含以下文件：
- task.worker.js (约 8.5MB)
- appIcon.png
- build/ (Sharp 库)
- client-dist/ (Socket.IO)
- vendor/ (libvips)

如缺失，从原项目复制：
```bash
Copy-Item "C:\Users\sxh\toolbox-project\resources\*" -Destination "backend\resources\" -Recurse -Force
```

## 六、开发调试

### 后端开发模式

```bash
cd backend
npm run dev
```

特点：
- 支持热重载
- 详细日志输出
- 错误堆栈跟踪

### 前端开发模式

```bash
cd frontend
npm run dev
```

特点：
- 自动打开开发者工具
- 实时刷新
- 控制台调试

### API 测试

使用 Postman 或 curl 测试 API：

```bash
# 测试地址服务
curl -X GET http://localhost:6790/api/address/random

# 测试邮件服务
curl -X POST http://localhost:6790/api/email/inbox/latest \
  -H "Content-Type: application/json" \
  -d "{\"client_id\":\"xxx\",\"client_secret\":\"xxx\",\"refresh_token\":\"xxx\"}"
```

### WebSocket 测试

使用浏览器控制台测试：

```javascript
const socket = io('http://localhost:6790');

socket.on('connect', () => {
  console.log('已连接');
  
  // 启动测活任务
  socket.emit('task.start', {
    type: 'checklive',
    platformClient: 'hubstudio',
    complicating: 4,
    status: 'running'
  });
});

socket.on('run.task.log', (log) => {
  console.log('日志:', log);
});
```

## 七、性能优化建议

### 1. 内存使用

- 批量任务并发数不要超过 CPU 核心数
- 定期清理日志面板
- 关闭不使用的工具窗口

### 2. 网络优化

- 使用稳定的网络连接
- 避免高峰期进行批量操作
- 合理设置任务间隔时间

### 3. 系统资源

- 关闭其他占用资源的程序
- 确保有足够的磁盘空间
- 监控系统内存使用率

## 八、更新日志

查看 `README.md` 了解详细更新内容

## 九、获取帮助

遇到问题？

1. 查看日志面板中的错误信息
2. 检查本文档的常见问题部分
3. 查看 README.md 获取更多技术细节
4. 提交 Issue 报告问题

## 十、注意事项

⚠️ **重要提醒**:

1. **合法使用**: 仅用于合法用途，遵守相关服务条款
2. **账号安全**: 妥善保管 API 密钥和凭证
3. **速率限制**: 注意 API 调用频率限制
4. **数据备份**: 重要数据请及时备份
5. **网络安全**: 不要在公共网络使用敏感功能

---

**祝使用愉快！🎉**

如有问题，请参考 README.md 或提交 Issue。
