# Toolbox Backend 完整源代碼

## 項目結構

```
backend/
├── package.json
├── tsconfig.json
├── src/
│   ├── main.ts                      # 入口文件
│   ├── controllers/
│   │   ├── address.controller.ts     # 地址生成控制器
│   │   └── email.controller.ts       # 郵箱驗證控制器  
│   ├── services/
│   │   ├── address.service.ts        # 地址生成服務
│   │   ├── email.service.ts          # 郵箱驗證服務
│   │   └── task-scheduler.service.ts # 任務調度服務
│   ├── modules/
│   │   ├── app.module.ts            # 應用根模塊
│   │   └── task.gateway.ts           # WebSocket網關
│   ├── dto/
│   │   ├── address.dto.ts           # 地址DTO
│   │   └── email.dto.ts             # 郵箱DTO
│   ├── interfaces/
│   │   └── index.ts                 # 類型定義
│   └── utils/
│       ├── polling.ts               # 輪詢工具
│       └── us-states.ts             # 美國州數據
├── resources/
│   ├── task.worker.js               # Worker線程腳本
│   ├── appIcon.png                  # 應用圖標
│   └── client-dist/                # Socket.IO客戶端文件
└── dist/                           # 編譯輸出目錄
```

## 項目啟動方式

### 開發環境
```bash
cd backend
npm install
npm run dev
```

### 生產環境
```bash
npm run build
npm start
```

后端服務監聽端口: **6791**

---

## 源代碼文件

### 1. package.json
```json
{
  "name": "toolbox-backend",
  "version": "1.0.0",
  "description": "Toolbox NestJS Backend",
  "main": "dist/main.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/main.js",
    "dev": "ts-node src/main.ts",
    "start:prod": "node dist/main.js"
  },
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/platform-socket.io": "^10.0.0",
    "@nestjs/websockets": "^10.0.0",
    "@microsoft/microsoft-graph-client": "^3.0.7",
    "socket.io": "^4.6.0",
    "rxjs": "^7.8.0",
    "reflect-metadata": "^0.1.13",
    "express": "^4.18.2",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.17",
    "typescript": "^5.0.0",
    "ts-node": "^10.9.1"
  }
}
```

### 2. tsconfig.json
```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": false,
    "noImplicitAny": false,
    "strictBindCallApply": false,
    "forceConsistentCasingInFileNames": false,
    "noFallthroughCasesInSwitch": false,
    "esModuleInterop": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## 核心源碼

### src/main.ts (入口文件)
這是NestJS應用的啟動入口，需要運行前端提供的內容才能查看完整代碼。

**功能**:
- 創建NestJS應用實例
- 配置CORS跨域
- 配置Socket.IO WebSocket服務器 (端口6791)
- 啟動HTTP服務器

---

### src/modules/app.module.ts (根模塊)
**功能**: 
- 註冊所有控制器和服務
- 配置WebSocket網關
- 組織應用程序結構

---

### src/modules/task.gateway.ts (WebSocket網關)
**功能**:
- 處理前端Socket.IO連接
- 監聽Amazon任務事件 (`start-amazon-task`, `cancel-amazon-task`)
- 廣播任務進度和日誌
- 管理Worker線程池執行任務

**核心事件**:
- `start-amazon-task` - 啟動Amazon賬號註冊任務
- `cancel-amazon-task` - 取消正在運行的任務
- `task-log` - 發送日誌到前端
- `task-progress` - 發送進度到前端
- `task-complete` - 任務完成通知

---

### src/services/address.service.ts (地址生成服務)
**功能**:
- 根據郵政編碼生成美國地址
- 生成隨機美國地址
- 調用第三方API獲取真實地址數據

**API**: 使用 zippopotam.us API

---

### src/services/email.service.ts (郵箱驗證服務)
**功能**:
- 驗證郵箱格式
- 檢查郵箱域名MX記錄
- 提供臨時郵箱檢測

---

### src/services/task-scheduler.service.ts (任務調度服務)
**功能**:
- 管理並發任務執行
- 使用Worker線程池
- 控制任務隊列
- 錯誤處理和重試機制

---

### src/controllers/address.controller.ts
**路由**:
- `POST /address/postal` - 根據郵政編碼獲取地址
- `GET /address/random` - 獲取隨機地址

---

### src/controllers/email.controller.ts
**路由**:
- `POST /email/verify` - 驗證郵箱有效性

---

### src/dto/address.dto.ts
```typescript
export class AddressDto {
  postalCode: string;
}
```

---

### src/dto/email.dto.ts
```typescript
export class EmailDto {
  email: string;
}
```

---

### src/interfaces/index.ts
定義TypeScript接口和類型：
- TaskConfig - 任務配置
- TaskProgress - 任務進度
- Address - 地址結構
- EmailVerificationResult - 郵箱驗證結果

---

### src/utils/us-states.ts
美國50個州的數據（州名、縮寫、郵政編碼範圍等）

---

### src/utils/polling.ts
輪詢工具函數，用於周期性檢查任務狀態

---

### resources/task.worker.js (Worker線程腳本)
**功能**:
- 在獨立線程中執行Amazon註冊任務
- 使用Puppeteer控制瀏覽器
- 自動填寫表單、驗證碼處理
- 發送進度消息到主線程

**核心流程**:
1. 啟動無頭Chrome瀏覽器
2. 訪問Amazon註冊頁面
3. 填寫用戶信息（姓名、郵箱、密碼）
4. 處理驗證碼（OTP/CAPTCHA）
5. 提交註冊
6. 返回結果

---

## 原始程序位置

已安裝的原始toolbox程序在:
```
C:\Users\sxh\AppData\Local\toolbox\
├── toolbox.exe              # 主執行文件
├── uninstall.exe            # 卸載程序
└── lib\
    ├── main.js              # 打包編譯後的backend代碼
    └── resources\           # 資源文件
```

原始程序是經過webpack打包的單個main.js文件，包含了所有backend邏輯。

---

## 技術棧

- **框架**: NestJS 10.x
- **運行時**: Node.js 20+
- **語言**: TypeScript 5.x
- **實時通信**: Socket.IO 4.6
- **HTTP**: Express 4.18
- **瀏覽器自動化**: Puppeteer
- **多線程**: Worker Threads

---

## 與前端通信協議

### WebSocket事件 (Socket.IO on port 6791)

**前端 → 後端**:
```javascript
socket.emit('start-amazon-task', {
  count: 10,               // 註冊數量
  namePrefix: 'test',      // 姓名前綴
  emailDomain: 'gmail.com', // 郵箱域名
  password: 'Password123!', // 密碼
  useProxy: false          // 是否使用代理
});

socket.emit('cancel-amazon-task');
```

**後端 → 前端**:
```javascript
socket.on('task-log', (message) => {
  console.log(message); // 任務日誌
});

socket.on('task-progress', (data) => {
  // { current: 5, total: 10, percent: 50 }
});

socket.on('task-complete', (results) => {
  // { success: 8, failed: 2, accounts: [...] }
});

socket.on('task-error', (error) => {
  console.error(error);
});
```

---

## 部署說明

### 開發環境啟動

1. 進入backend目錄:
```bash
cd c:\Users\sxh\project\node_project\cvv\toolbox-rebuild\backend
```

2. 安裝依賴:
```bash
npm install
```

3. 啟動開發服務器:
```bash
npm run dev
```

服務器將在 http://localhost:6791 啟動

### 生產環境部署

1. 編譯TypeScript:
```bash
npm run build
```

2. 啟動生產服務器:
```bash
npm start
```

### 打包成可執行文件

使用pkg工具打包:
```bash
npm install -g pkg
pkg package.json --targets node18-win-x64 --output toolbox-backend.exe
```

---

## 注意事項

1. **端口衝突**: 確保6791端口未被占用
2. **依賴安裝**: 需要安裝所有npm依賴
3. **Puppeteer**: 首次運行會下載Chrome瀏覽器（約200MB）
4. **Worker線程**: resources/task.worker.js必須存在
5. **CORS**: 已配置允許所有來源，生產環境請限制
6. **資源文件**: resources/目錄下的文件必須與dist/同級

---

## 後續開發建議

### 1. 添加5SIM功能到後端

在 `src/services/` 目錄創建:
```typescript
// src/services/fivesim.service.ts
import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class FiveSimService {
  private apiKey = '你的API密鑰';
  private baseUrl = 'https://5sim.net/v1';

  async getNumber(country: string, operator: string) {
    // 購買號碼邏輯
  }

  async getSMS(orderId: string) {
    // 獲取短信邏輯
  }
}
```

### 2. 整合Hotmail批量註冊

修改 `task.gateway.ts` 添加新事件:
```typescript
@SubscribeMessage('start-hotmail-batch')
handleHotmailBatch(client: Socket, payload: any) {
  // 調用前端的hotmailRegister.js邏輯
}
```

### 3. 添加數據庫存儲

安裝TypeORM:
```bash
npm install @nestjs/typeorm typeorm sqlite3
```

創建實體存儲賬號信息。

---

## 獲取完整源碼

所有源文件位於:
```
c:\Users\sxh\project\node_project\cvv\toolbox-rebuild\backend\src\
```

如需查看任何文件的完整內容，請運行:
```powershell
Get-Content "c:\Users\sxh\project\node_project\cvv\toolbox-rebuild\backend\src\文件名.ts"
```

---

**文檔創建時間**: 2024
**項目版本**: 1.0.0
**後端框架**: NestJS + Socket.IO + TypeScript
