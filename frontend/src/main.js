const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let backendProcess;

function startBackend() {
  console.log('启动后端服务...');
  
  const backendPath = path.join(__dirname, '../../backend/dist/main.js');
  
  backendProcess = spawn('node', [backendPath], {
    cwd: path.join(__dirname, '../../backend'),
    stdio: 'inherit'
  });

  backendProcess.on('error', (error) => {
    console.error('后端启动失败:', error);
  });

  backendProcess.on('exit', (code) => {
    console.log(`后端进程退出，代码: ${code}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    icon: path.join(__dirname, '../../backend/resources/appIcon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false
    },
    backgroundColor: '#1a1a2e',
    show: false,
    frame: true,
    titleBarStyle: 'default'
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    console.log('主窗口已显示');
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

  // 开发环境打开开发者工�?
  if (true) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (backendProcess) {
      backendProcess.kill();
    }
  });
}

app.on('ready', () => {
  console.log('Electron 应用启动');

  // 后端已单独启动，不需要在Electron中启�?
  // setTimeout(() => {
  //   startBackend();
  // }, 1000);

  // 直接创建窗口
  createWindow();
});app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});

// IPC 事件处理
ipcMain.on('get-backend-url', (event) => {
  event.returnValue = 'http://localhost:6790';
});

console.log('Electron 主进程已加载');
