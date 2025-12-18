const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const remoteMain = require('@electron/remote/main');
const AmazonRegisterCore = require('./utils/amazonRegisterCore');

// 禁用 GPU 缓存以避免权限错误
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-gpu-program-cache');

// 初始化remote模块
remoteMain.initialize();
let mainWindow;
let backendProcess;

// 浏览器实例管理 - 使用 Map 存储多个实例，支持并发
const browserInstances = new Map(); // key: containerCode, value: { browser, page, hubstudio, containerCode }

// 保留全局变量用于单任务兼容
let globalBrowser = null;
let globalPage = null;
let globalHubStudio = null;
let globalContainerCode = null;

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
      sandbox: false, // 禁用sandbox以支持MS Graph和Hotmail功能
      enableRemoteModule: true,
      preload: path.join(__dirname, 'preload.js')
    },
    backgroundColor: '#1a1a2e',
    show: false,
    frame: true,
    titleBarStyle: 'default'
  });

  // 启用remote模块
  remoteMain.enable(mainWindow.webContents);
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    console.log('主窗口已显示');
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

  // 开发环境打开开发者工具
  if (process.env.NODE_ENV === 'development' || process.argv.includes('--inspect')) {
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
const HubStudioClient = require(path.join(__dirname, 'utils/hubstudioClient.js'));
const { chromium } = require('playwright');
const ipValidator = require(path.join(__dirname, 'utils/ipValidator.js'));

// Amazon浏览器启动处理器
ipcMain.handle('amazon:launchBrowser', async (event, config) => {
  console.log('IPC: amazon:launchBrowser called with config:', config);
  
  try {
    const { platformClient, args = [], cache, arrange, proxy } = config;
    
    console.log('========== 代理调试信息 ==========');
    console.log('proxy 原始值:', proxy);
    console.log('proxy 类型:', typeof proxy);
    console.log('proxy 长度:', proxy ? proxy.length : 'null/undefined');
    console.log('proxy trim后:', proxy ? proxy.trim() : 'null/undefined');
    console.log('===================================');
    
    // ========== IP 验证（在打开窗口前） ==========
    if (proxy && proxy.trim()) {
      console.log('\n========== IP 验证开始 ==========');
      const proxyIP = ipValidator.extractIPFromProxy(proxy);
      
      if (proxyIP) {
        console.log(`[IP 验证] 提取到代理地址: ${proxyIP}`);
        
        // 执行 IP 验证
        const ipValidation = await ipValidator.validateIP(proxyIP);
        
        console.log(`[IP 验证] 验证结果:`, JSON.stringify(ipValidation, null, 2));
        
        if (!ipValidation.valid) {
          const errorMsg = `代理 IP 验证失败: ${ipValidation.error || '无效的 IP 地址'}`;
          console.error(`[IP 验证] ❌ ${errorMsg}`);
          console.error(`[IP 验证] ❌ 阻止创建浏览器窗口`);
          
          // 返回错误，阻止后续操作
          return {
            success: false,
            error: errorMsg
          };
        }
        
        console.log(`[IP 验证] ✅ IP 验证通过`);
        console.log(`[IP 验证]    位置: ${ipValidation.city}, ${ipValidation.region}, ${ipValidation.country}`);
        console.log(`[IP 验证]    ISP: ${ipValidation.isp}`);
      } else {
        // 无法提取 IP 时，也应该阻止（可选：根据需求决定是否严格）
        const errorMsg = '无法从代理字符串中提取 IP 地址，请检查代理格式';
        console.error(`[IP 验证] ❌ ${errorMsg}`);
        console.error(`[IP 验证] ❌ 代理格式: ${proxy}`);
        
        // 严格模式：无法提取IP也阻止
        return {
          success: false,
          error: errorMsg
        };
      }
      console.log('========== IP 验证完成 ==========\n');
    } else {
      console.log('\n⚠️  未提供代理配置，跳过 IP 验证\n');
    }
    
    if (!platformClient || platformClient === 'hubstudio') {
      // 使用HubStudio启动浏览器
      console.log('使用HubStudio启动浏览器');
      
      const hubstudio = new HubStudioClient();
      
      // 解析代理配置
      let proxyConfig = {
        proxyTypeName: 'Socks5'  // 默认使用 Socks5（而不是HTTP）
      };
      
      if (proxy && proxy.trim()) {
        console.log('✅ 开始解析代理配置:', proxy);
        // 代理格式支持两种:
        // 1. host:port:username:password (冒号分隔格式)
        // 2. http://user:pass@host:port (URL格式)
        try {
          // 尝试URL格式解析
          if (proxy.includes('://')) {
            const proxyUrl = new URL(proxy);
            const protocol = proxyUrl.protocol.replace(':', '').toUpperCase();
            
            proxyConfig = {
              proxyTypeName: protocol === 'SOCKS5' ? 'Socks5' : protocol,
              proxyServer: proxyUrl.hostname,  // 使用 proxyServer 而非 proxyHost
              proxyPort: parseInt(proxyUrl.port) || (protocol === 'HTTPS' ? 443 : 1080)
            };
            
            if (proxyUrl.username) {
              proxyConfig.proxyAccount = decodeURIComponent(proxyUrl.username);
            }
            if (proxyUrl.password) {
              proxyConfig.proxyPassword = decodeURIComponent(proxyUrl.password);
            }
          } else {
            // 冒号分隔格式: host:port:username:password
            const parts = proxy.split(':');
            if (parts.length >= 2) {
              proxyConfig = {
                proxyTypeName: 'Socks5',  // 默认使用 Socks5 代理
                proxyServer: parts[0],  // 使用 proxyServer 而非 proxyHost
                proxyPort: parseInt(parts[1])
              };
              
              // 如果有用户名和密码
              if (parts.length >= 3) {
                proxyConfig.proxyAccount = parts[2];
              }
              if (parts.length >= 4) {
                proxyConfig.proxyPassword = parts[3];
              }
            }
          }
          
          console.log('✅ 代理配置解析成功:', JSON.stringify(proxyConfig, null, 2));
        } catch (e) {
          console.error('❌ 代理格式解析失败:', e.message);
          console.warn('使用无代理模式');
        }
      } else {
        console.log('⚠️ 代理为空或无效，使用无代理模式');
      }
      
      // 自动创建新环境
      console.log('正在创建新的HubStudio环境...');
      console.log('========== 发送到 HubStudio 的配置 ==========');
      const createContainerConfig = {
        containerName: `Amazon-Register-${Date.now()}`,
        asDynamicType: 0,  // 关闭IP变更提醒
        ...proxyConfig  // 应用代理配置
        // 不指定 coreVersion，让 HubStudio 使用最新内核版本
      };
      console.log(JSON.stringify(createContainerConfig, null, 2));
      console.log('=============================================');
      
      const containerInfo = await hubstudio.createContainer(createContainerConfig);
      
      const containerCode = containerInfo.containerCode;
      console.log(`环境创建成功: ${containerCode}`);
      
      // 启动浏览器
      console.log('正在启动浏览器...');
      const browserInfo = await hubstudio.startBrowser({
        containerCode,
        args
      });
      
      console.log('浏览器启动成功:', browserInfo);
      
      // 连接到CDP - HubStudio 需要先获取正确的 WebSocket URL
      console.log('正在连接到浏览器...');
      const debugPort = browserInfo.debuggingPort;
      
      // 先通过 HTTP 获取 CDP 的 WebSocket URL
      const cdpInfoUrl = `http://127.0.0.1:${debugPort}/json/version`;
      console.log('获取 CDP 信息:', cdpInfoUrl);
      
      let wsEndpoint;
      try {
        const fetch = require('node-fetch');
        const response = await fetch(cdpInfoUrl);
        const versionInfo = await response.json();
        wsEndpoint = versionInfo.webSocketDebuggerUrl;
        console.log('CDP WebSocket URL:', wsEndpoint);
      } catch (error) {
        console.warn('无法获取 CDP WebSocket URL，使用默认路径:', error.message);
        wsEndpoint = `ws://127.0.0.1:${debugPort}`;
      }
      
      const browser = await chromium.connectOverCDP(wsEndpoint);
      const context = browser.contexts()[0];
      const page = context.pages()[0] || await context.newPage();
      
      console.log('成功连接到浏览器');
      
      // 将实例存储到 Map 中，支持并发任务
      browserInstances.set(containerCode, {
        browser,
        page,
        hubstudio,
        containerCode,
        createdAt: Date.now()
      });
      
      // 同时保存到全局变量（向后兼容单任务模式）
      globalBrowser = browser;
      globalPage = page;
      globalHubStudio = hubstudio;
      globalContainerCode = containerCode;
      
      console.log(`✅ 浏览器实例已存储: ${containerCode}, 当前实例数: ${browserInstances.size}`);
      
      // 导航到HubStudio默认检测页面
      console.log('正在导航到环境检测页面...');
      try {
        await page.goto('https://bot.sannysoft.com/', { timeout: 30000 });
        console.log('环境检测页面加载完成');
      } catch (navError) {
        console.warn('导航到检测页面失败:', navError.message);
        // 不抛出错误，继续执行
      }
      
      return {
        success: true,
        containerCode,
        debuggingPort: browserInfo.debuggingPort,
        instanceCount: browserInstances.size,
        // 注意：不返回 browser、page、hubstudio 对象，因为它们不可序列化（IPC限制）
        // 这些对象会被主进程保存用于后续操作
      };
    } else {
      // 使用本地Playwright启动
      console.log('使用本地Playwright启动浏览器');
      const browser = await chromium.launch({
        headless: false,
        args
      });
      const page = await browser.newPage();
      
      return {
        success: true,
        browser,
        page
      };
    }
  } catch (error) {
    console.error('启动浏览器失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Amazon注册脚本执行处理器 - 使用完整的 refactored-backend 核心逻辑
ipcMain.handle('amazon:executeRegisterScript', async (event, config) => {
  const startTime = Date.now();
  const taskId = config.containerCode || 'unknown';
  
  console.log(`\n========== [任务 ${taskId}] 开始执行注册 ==========`);
  console.log(`[任务 ${taskId}] 配置:`, {
    email: config.emailLine?.split('----')[0],
    site: config.site,
    enable2FA: config.enable2FA,
    bindAddress: config.bindAddress
  });
  
  try {
    // 根据 containerCode 获取对应的浏览器实例
    const containerCode = config.containerCode;
    let browserInstance;
    
    if (containerCode && browserInstances.has(containerCode)) {
      browserInstance = browserInstances.get(containerCode);
      console.log(`[任务 ${taskId}] 使用指定的浏览器实例: ${containerCode}`);
    } else {
      // 如果没有指定或找不到，使用全局实例（向后兼容）
      browserInstance = {
        browser: globalBrowser,
        page: globalPage,
        hubstudio: globalHubStudio,
        containerCode: globalContainerCode
      };
      console.log(`[任务 ${taskId}] 使用全局浏览器实例`);
    }
    
    // 验证实例是否有效
    if (!browserInstance.page) {
      throw new Error('浏览器未初始化，请先启动浏览器');
    }
    
    if (!browserInstance.hubstudio) {
      throw new Error('HubStudio客户端未初始化');
    }
    
    // 提取邮箱和密码
    const emailLine = config.emailLine || config.email;
    if (!emailLine) {
      throw new Error('缺少邮箱信息');
    }
    
    const [email, emailPassword] = emailLine.includes('----') 
      ? emailLine.split('----') 
      : [emailLine, null];
    
    console.log(`[任务 ${taskId}] 邮箱: ${email}`);
    
    // 确定最终使用的密码
    let finalPassword = config.password;
    if (!finalPassword) {
      if (emailPassword) {
        finalPassword = emailPassword;
        console.log(`[任务 ${taskId}] 使用邮箱密码`);
      } else {
        // 使用原始 toolbox 的密码生成逻辑：username + 随机字符 + "!"
        const username = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
        const randomChars = Math.random().toString(36).substring(2, 8);
        finalPassword = username + randomChars + '!';
        console.log(`[任务 ${taskId}] 自动生成密码`);
      }
    } else {
      console.log(`[任务 ${taskId}] 使用自定义密码`);
    }
    
    console.log(`[任务 ${taskId}] 开始执行Amazon注册流程...`);
    console.log(`[任务 ${taskId}] 站点: ${config.site || 'com'}`);
    
    // 准备完整配置参数
    const coreConfig = {
      // 完整的 emailLine（包含 refresh_token）
      emailLine: config.emailLine,
      
      // 基础账号信息
      email: email,
      password: finalPassword,
      name: config.name || email.split('@')[0].replace(/[^a-zA-Z0-9]/g, ''),
      
      // 站点配置
      site: config.site || 'com',
      
      // 使用正确的浏览器实例
      page: browserInstance.page,
      browser: browserInstance.browser,
      hubstudio: browserInstance.hubstudio,
      containerCode: browserInstance.containerCode,
      
      // Captcha 配置
      captchaApiKey: config.captchaApiKey || '58e9d0ae-8322-4c89-b6c5-cd035a684b02', // 默认 API Key
      
      // 邮箱验证配置
      emailServiceType: config.emailServiceType || 'microsoft',
      emailPassword: emailPassword,
      
      // 2FA 配置
      enable2FA: config.enable2FA === 'true' || config.enable2FA === true,
      enable2FAManual: config.enable2FAManual === 'true' || config.enable2FAManual === true,
      
      // 地址绑定
      bindAddress: config.bindAddress === 'true' || config.bindAddress === true,
      
      // 手机号（如果需要）
      phone: config.phone || null,
      
      // 重试配置
      maxRetries: config.maxRetries || 3,
      
      // 时间戳（用于邮箱验证码筛选）
      registerTime: Date.now()
    };
    
    // 创建核心注册实例并执行
    const registerCore = new AmazonRegisterCore(coreConfig);
    console.log(`[任务 ${taskId}] 注册实例已创建，开始执行...`);
    
    const result = await registerCore.execute();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[任务 ${taskId}] 注册流程执行完成，耗时: ${duration}秒`);
    console.log(`[任务 ${taskId}] 结果:`, {
      success: result.success,
      hasOTP: !!result.account?.otpSecret,
      addressBound: result.addressBound,
      error: result.error
    });
    
    // 记录到数据库
    try {
      const { getAccountDatabase } = require('./refactored-backend/database/accountDatabase');
      const accountDb = getAccountDatabase();
      
      const accountData = {
        email: email,
        password: finalPassword,
        name: coreConfig.name,
        otpSecret: result.account?.otpSecret || '',
        registerSuccess: result.success === true,
        otpSuccess: result.account?.otpSecret ? true : false,
        addressSuccess: result.addressBound === true,
        notes: result.error || ''
      };
      
      accountDb.insertAccount(accountData);
      console.log(`[任务 ${taskId}] 账号已记录到数据库`);
    } catch (dbError) {
      console.error(`[任务 ${taskId}] 记录数据库失败:`, dbError);
    }
    
    console.log(`========== [任务 ${taskId}] 执行结束 (${result.success ? '成功' : '失败'}) ==========\n`);
    
    return result;
    
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`========== [任务 ${taskId}] 执行异常 (耗时: ${duration}秒) ==========`);
    console.error(`[任务 ${taskId}] 错误:`, error.message);
    console.error(`[任务 ${taskId}] 堆栈:`, error.stack);
    console.log(`========== [任务 ${taskId}] 执行结束 (异常) ==========\n`);
    
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
});

// 删除环境处理器
ipcMain.handle('amazon:deleteContainer', async (event, { containerCode }) => {
  console.log('IPC: amazon:deleteContainer called with containerCode:', containerCode);
  
  try {
    const hubstudio = new HubStudioClient();
    await hubstudio.deleteContainer(containerCode);
    
    // 从环境池中移除已删除的环境
    const index = environmentPool.findIndex(env => env.containerCode === containerCode);
    if (index !== -1) {
      environmentPool.splice(index, 1);
      console.log(`环境 ${containerCode} 已从环境池中移除，剩余 ${environmentPool.length} 个环境`);
    }
    
    return {
      success: true,
      message: `环境 ${containerCode} 已删除`
    };
  } catch (error) {
    console.error('删除环境失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.on('get-backend-url', (event) => {
  event.returnValue = 'http://localhost:6791';
});

console.log('Electron 主进程已加载');
