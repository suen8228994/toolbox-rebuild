// Preload script - with sandbox disabled
const { contextBridge, shell } = require('electron');
const remote = require('@electron/remote');
const path = require('path');

console.log('=== Preload script loaded ===');
console.log('__dirname:', __dirname);

// Load modules (sandbox must be disabled in main.js)
let msGraphModule, hotmailModule, msGraphROPCModule, emailDbModule, authScriptModule, accountImporterModule, playwrightRegisterModule, oauthAutomationModule, proxyGeneratorModule, outlookAuthClientModule;
try {
  const msGraphPath = path.join(__dirname, 'utils', 'msGraphDeviceCode.js');
  const hotmailPath = path.join(__dirname, 'utils', 'hotmailRegister.js');
  const msGraphROPCPath = path.join(__dirname, 'utils', 'msGraphROPC.js');
  const emailDbPath = path.join(__dirname, 'utils', 'emailDatabaseJSON.js');  // 使用JSON版本
  const authScriptPath = path.join(__dirname, 'utils', 'authScriptGenerator.js');
  const accountImporterPath = path.join(__dirname, 'utils', 'accountImporter.js');
  const playwrightRegisterPath = path.join(__dirname, 'utils', 'playwrightHotmailRegister.js');
  const oauthAutomationPath = path.join(__dirname, 'utils', 'oauthAutomation.js');
  const proxyGeneratorPath = path.join(__dirname, 'utils', 'proxyGenerator.js');
  const outlookAuthClientPath = path.join(__dirname, 'utils', 'outlookAuthClient.js');
  
  console.log('尝试加载模块:');
  console.log('  - msGraphPath:', msGraphPath);
  console.log('  - hotmailPath:', hotmailPath);
  console.log('  - msGraphROPCPath:', msGraphROPCPath);
  console.log('  - emailDbPath:', emailDbPath);
  console.log('  - authScriptPath:', authScriptPath);
  console.log('  - accountImporterPath:', accountImporterPath);
  console.log('  - playwrightRegisterPath:', playwrightRegisterPath);
  console.log('  - oauthAutomationPath:', oauthAutomationPath);
  console.log('  - outlookAuthClientPath:', outlookAuthClientPath);
  
  msGraphModule = require(msGraphPath);
  console.log('  ✅ msGraphModule loaded, exports:', Object.keys(msGraphModule));
  
  hotmailModule = require(hotmailPath);
  console.log('  ✅ hotmailModule loaded, exports:', Object.keys(hotmailModule));
  
  msGraphROPCModule = require(msGraphROPCPath);
  console.log('  ✅ msGraphROPCModule loaded, exports:', Object.keys(msGraphROPCModule));
  
  emailDbModule = require(emailDbPath);
  console.log('  ✅ emailDbModule loaded, exports:', Object.keys(emailDbModule));
  
  authScriptModule = require(authScriptPath);
  console.log('  ✅ authScriptModule loaded, exports:', Object.keys(authScriptModule));
  
  accountImporterModule = require(accountImporterPath);
  console.log('  ✅ accountImporterModule loaded, exports:', Object.keys(accountImporterModule));
  
  playwrightRegisterModule = require(playwrightRegisterPath);
  console.log('  ✅ playwrightRegisterModule loaded, exports:', Object.keys(playwrightRegisterModule));
  
  oauthAutomationModule = require(oauthAutomationPath);
  console.log('  ✅ oauthAutomationModule loaded, exports:', Object.keys(oauthAutomationModule));
  
  proxyGeneratorModule = require(proxyGeneratorPath);
  console.log('  ✅ proxyGeneratorModule loaded, exports:', Object.keys(proxyGeneratorModule));
  
  outlookAuthClientModule = require(outlookAuthClientPath);
  console.log('  ✅ outlookAuthClientModule loaded, exports:', Object.keys(outlookAuthClientModule));
  
  console.log('✅ All modules loaded successfully!');
} catch (err) {
  console.error('❌ Failed to load modules:');
  console.error('  Error:', err.message);
  console.error('  Stack:', err.stack);
  // 使用空实现，不影响其他功能
  msGraphModule = { startDeviceCodeFlow: null, pollForRefreshToken: null };
  hotmailModule = { batchRegister: null };
  msGraphROPCModule = { getTokenByPassword: null, batchGetTokens: null };
  emailDbModule = {};
  authScriptModule = {};
  accountImporterModule = {};
  playwrightRegisterModule = {};
  oauthAutomationModule = {};
  proxyGeneratorModule = {};
  outlookAuthClientModule = {};
}

// Expose MS Graph API
console.log('正在暴露 msGraphAPI 到 window...');
contextBridge.exposeInMainWorld('msGraphAPI', {
  startDeviceCode: async ({ clientId, scope, tenant }) => {
    console.log('msGraphAPI.startDeviceCode called');
    if (!msGraphModule || !msGraphModule.startDeviceCodeFlow) {
      throw new Error('MS Graph module not available');
    }
    return await msGraphModule.startDeviceCodeFlow({ clientId, scope, tenant });
  },
  
  pollForToken: async ({ clientId, deviceCode, interval, expiresIn, email, tenant }) => {
    console.log('msGraphAPI.pollForToken called');
    if (!msGraphModule || !msGraphModule.pollForRefreshToken) {
      throw new Error('MS Graph module not available');
    }
    return await msGraphModule.pollForRefreshToken({ clientId, deviceCode, interval, expiresIn, email, tenant });
  },
  
  // ROPC 方式获取 token
  getTokenByPassword: async ({ clientId, username, password, scope }) => {
    console.log('msGraphAPI.getTokenByPassword called for:', username);
    if (!msGraphROPCModule || !msGraphROPCModule.getTokenByPassword) {
      throw new Error('MS Graph ROPC module not available');
    }
    return await msGraphROPCModule.getTokenByPassword({ clientId, username, password, scope });
  },
  
  batchGetTokens: async ({ clientId, accounts, concurrency, scope, onProgress }) => {
    console.log('msGraphAPI.batchGetTokens called for', accounts.length, 'accounts');
    if (!msGraphROPCModule || !msGraphROPCModule.batchGetTokens) {
      throw new Error('MS Graph ROPC module not available');
    }
    return await msGraphROPCModule.batchGetTokens({ clientId, accounts, concurrency, scope, onProgress });
  },
  
  openExternal: (url) => {
    console.log('msGraphAPI.openExternal called:', url);
    shell.openExternal(url);
  }
});
console.log('✅ msGraphAPI exposed');

// Expose Hotmail Batch Registration API
console.log('正在暴露 hotmailBatchAPI 到 window...');
contextBridge.exposeInMainWorld('hotmailBatchAPI', {
  batchRegister: async (options) => {
    console.log('hotmailBatchAPI.batchRegister called with options:', options);
    if (!hotmailModule || !hotmailModule.batchRegister) {
      throw new Error('Hotmail module not available');
    }
    return await hotmailModule.batchRegister(options);
  }
});
console.log('✅ hotmailBatchAPI exposed');

// Expose Email Database API
console.log('正在暴露 emailDatabaseAPI 到 window...');
contextBridge.exposeInMainWorld('emailDatabaseAPI', {
  // 初始化数据库
  init: async () => {
    console.log('emailDatabaseAPI.init called');
    if (!emailDbModule || !emailDbModule.initDatabase) {
      console.warn('emailDbModule not available');
      return Promise.resolve(null);
    }
    return await emailDbModule.initDatabase();
  },
  
  // 任务管理
  createTask: async (options) => {
    if (!emailDbModule || !emailDbModule.createBatchTask) {
      throw new Error('emailDbModule.createBatchTask is not available');
    }
    return await emailDbModule.createBatchTask(options);
  },
  updateTask: async (taskId, updates) => {
    if (!emailDbModule || !emailDbModule.updateBatchTask) {
      throw new Error('emailDbModule.updateBatchTask is not available');
    }
    return await emailDbModule.updateBatchTask(taskId, updates);
  },
  getTaskDetails: async (taskId) => {
    if (!emailDbModule || !emailDbModule.getTaskDetails) {
      throw new Error('emailDbModule.getTaskDetails is not available');
    }
    return await emailDbModule.getTaskDetails(taskId);
  },
  
  // 账号管理
  saveAccount: async (account) => {
    if (!emailDbModule || !emailDbModule.saveEmailAccount) {
      throw new Error('emailDbModule.saveEmailAccount is not available');
    }
    return await emailDbModule.saveEmailAccount(account);
  },
  updateAccount: async (email, updates) => {
    if (!emailDbModule || !emailDbModule.updateEmailAccount) {
      throw new Error('emailDbModule.updateEmailAccount is not available');
    }
    return await emailDbModule.updateEmailAccount(email, updates);
  },
  getAccount: async (email) => {
    if (!emailDbModule || !emailDbModule.getEmailAccount) {
      throw new Error('emailDbModule.getEmailAccount is not available');
    }
    return await emailDbModule.getEmailAccount(email);
  },
  linkEmailToTask: async (taskId, emailId, order) => {
    if (!emailDbModule || !emailDbModule.linkEmailToTask) {
      throw new Error('emailDbModule.linkEmailToTask is not available');
    }
    return await emailDbModule.linkEmailToTask(taskId, emailId, order);
  },
  
  // 查询
  getUnauthorizedAccounts: async () => {
    if (!emailDbModule || !emailDbModule.getUnauthorizedAccounts) {
      throw new Error('emailDbModule.getUnauthorizedAccounts is not available');
    }
    return await emailDbModule.getUnauthorizedAccounts();
  },
  getAvailableAccounts: async (limit) => {
    if (!emailDbModule || !emailDbModule.getAvailableAccounts) {
      throw new Error('emailDbModule.getAvailableAccounts is not available');
    }
    return await emailDbModule.getAvailableAccounts(limit);
  },
  getStatistics: async () => {
    if (!emailDbModule || !emailDbModule.getStatistics) {
      throw new Error('emailDbModule.getStatistics is not available');
    }
    return await emailDbModule.getStatistics();
  },
  exportAccounts: async (filter) => {
    if (!emailDbModule || !emailDbModule.exportAccounts) {
      throw new Error('emailDbModule.exportAccounts is not available');
    }
    return await emailDbModule.exportAccounts(filter);
  }
});
console.log('✅ emailDatabaseAPI exposed');

// Expose Auth Script Generator API
console.log('正在暴露 authScriptAPI 到 window...');
contextBridge.exposeInMainWorld('authScriptAPI', {
  generatePowerShellScript: (account, clientId) => {
    return authScriptModule.generatePowerShellScript(account, clientId);
  },
  generateBatchAuthScript: (accounts, clientId, concurrency) => {
    return authScriptModule.generateBatchAuthScript(accounts, clientId, concurrency);
  },
  generateAuthHTML: (account, clientId) => {
    return authScriptModule.generateAuthHTML(account, clientId);
  }
});
console.log('✅ authScriptAPI exposed');

// Expose Account Importer API
console.log('正在暴露 accountImporterAPI 到 window...');
contextBridge.exposeInMainWorld('accountImporterAPI', {
  importFromFile: (filePath, format) => accountImporterModule.importAccountsFromFile(filePath, format),
  parseFromText: (text, format) => accountImporterModule.parseAccountsFromText(text, format),
  validateAccount: (account, clientId) => accountImporterModule.validateAccount(account, clientId),
  batchValidate: (accounts, clientId, concurrency, onProgress) => {
    return accountImporterModule.batchValidateAccounts(accounts, clientId, concurrency, onProgress);
  },
  isValidEmail: (email) => accountImporterModule.isValidEmail(email)
});
console.log('✅ accountImporterAPI exposed');

// Expose Window Management API
console.log('正在暴露 windowAPI 到 window...');
contextBridge.exposeInMainWorld('windowAPI', {
  // 创建授权窗口
  createAuthWindow: (account, clientId) => {
    const { BrowserWindow } = remote;
    
    const authWindow = new BrowserWindow({
      width: 650,
      height: 850,
      title: `授权 - ${account.email}`,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      },
      parent: remote.getCurrentWindow(),
      modal: false,
      show: true
    });
    
    // 生成HTML内容
    if (!authScriptModule || !authScriptModule.generateAuthHTML) {
      console.error('authScriptModule not available');
      return null;
    }
    
    const html = authScriptModule.generateAuthHTML(account, clientId);
    authWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    
    return {
      id: authWindow.id,
      close: () => authWindow.close(),
      on: (event, callback) => authWindow.on(event, callback),
      webContents: authWindow.webContents
    };
  },
  
  // 获取当前窗口
  getCurrentWindow: () => {
    return remote.getCurrentWindow();
  }
});
console.log('✅ windowAPI exposed');

// Expose Playwright Register API
console.log('正在暴露 playwrightRegisterAPI 到 window...');
contextBridge.exposeInMainWorld('playwrightRegisterAPI', {
  generateUserData: () => playwrightRegisterModule.generateUserData(),
  
  registerAccount: async (userData, options) => {
    return await playwrightRegisterModule.registerAccount(userData, options);
  },
  
  batchRegister: async (options) => {
    return await playwrightRegisterModule.batchRegister(options);
  },
  
  getConfig: () => playwrightRegisterModule.CONFIG
});
console.log('✅ playwrightRegisterAPI exposed');

// Expose OAuth Automation API
console.log('正在暴露 oauthAutomationAPI 到 window...');
contextBridge.exposeInMainWorld('oauthAutomationAPI', {
  automateDeviceCodeAuth: async (account, deviceCodeUrl, userCode, options) => {
    return await oauthAutomationModule.automateDeviceCodeAuth(account, deviceCodeUrl, userCode, options);
  },
  
  batchAutomateAuth: async (accounts, clientId, options) => {
    return await oauthAutomationModule.batchAutomateAuth(accounts, clientId, options);
  }
});
console.log('✅ oauthAutomationAPI exposed');

// Expose Proxy Generator API
console.log('正在暴露 proxyGeneratorAPI 到 window...');
contextBridge.exposeInMainWorld('proxyGeneratorAPI', {
  generateProxies: (options) => {
    if (!proxyGeneratorModule || !proxyGeneratorModule.generateProxies) {
      throw new Error('Proxy Generator module not available');
    }
    return proxyGeneratorModule.generateProxies(options);
  },
  
  generateSingleProxy: (country, prefix, password) => {
    if (!proxyGeneratorModule || !proxyGeneratorModule.generateSingleProxy) {
      throw new Error('Proxy Generator module not available');
    }
    return proxyGeneratorModule.generateSingleProxy(country, prefix, password);
  },
  
  parseProxy: (proxyString) => {
    if (!proxyGeneratorModule || !proxyGeneratorModule.parseProxy) {
      throw new Error('Proxy Generator module not available');
    }
    return proxyGeneratorModule.parseProxy(proxyString);
  },
  
  formatProxies: (proxies) => {
    if (!proxyGeneratorModule || !proxyGeneratorModule.formatProxies) {
      throw new Error('Proxy Generator module not available');
    }
    return proxyGeneratorModule.formatProxies(proxies);
  },
  
  validateProxy: (proxyString) => {
    if (!proxyGeneratorModule || !proxyGeneratorModule.validateProxy) {
      throw new Error('Proxy Generator module not available');
    }
    return proxyGeneratorModule.validateProxy(proxyString);
  },
  
  getSupportedCountries: () => {
    if (!proxyGeneratorModule || !proxyGeneratorModule.getSupportedCountries) {
      throw new Error('Proxy Generator module not available');
    }
    return proxyGeneratorModule.getSupportedCountries();
  }
});
console.log('✅ proxyGeneratorAPI exposed');

// Expose Outlook Auth Client API
console.log('正在暴露 outlookAuthAPI 到 window...');
contextBridge.exposeInMainWorld('outlookAuthAPI', {
  createClient: (options) => {
    if (!outlookAuthClientModule || !outlookAuthClientModule.OutlookAuthClient) {
      throw new Error('Outlook Auth Client module not available');
    }
    const { OutlookAuthClient } = outlookAuthClientModule;
    return new OutlookAuthClient(options);
  },
  
  startDeviceLogin: async (clientId, options = {}) => {
    if (!outlookAuthClientModule || !outlookAuthClientModule.OutlookAuthClient) {
      throw new Error('Outlook Auth Client module not available');
    }
    const { OutlookAuthClient } = outlookAuthClientModule;
    const client = new OutlookAuthClient({ clientId, ...options });
    return await client.startDeviceLogin();
  },
  
  pollForToken: async (clientId, deviceCode, intervalSec, timeoutSec, options = {}) => {
    if (!outlookAuthClientModule || !outlookAuthClientModule.OutlookAuthClient) {
      throw new Error('Outlook Auth Client module not available');
    }
    const { OutlookAuthClient } = outlookAuthClientModule;
    const client = new OutlookAuthClient({ clientId, ...options });
    return await client.pollForToken(deviceCode, intervalSec, timeoutSec);
  },
  
  refreshWithToken: async (clientId, refreshToken, options = {}) => {
    if (!outlookAuthClientModule || !outlookAuthClientModule.OutlookAuthClient) {
      throw new Error('Outlook Auth Client module not available');
    }
    const { OutlookAuthClient } = outlookAuthClientModule;
    const client = new OutlookAuthClient({ clientId, ...options });
    return await client.refreshWithToken(refreshToken);
  },
  
  getMe: async (clientId, accessToken, options = {}) => {
    if (!outlookAuthClientModule || !outlookAuthClientModule.OutlookAuthClient) {
      throw new Error('Outlook Auth Client module not available');
    }
    const { OutlookAuthClient } = outlookAuthClientModule;
    const client = new OutlookAuthClient({ clientId, ...options });
    return await client.getMe(accessToken);
  }
});
console.log('✅ outlookAuthAPI exposed');

// Expose Amazon Browser API
console.log('正在暴露 amazonBrowserAPI 到 window...');
const { ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('amazonBrowserAPI', {
  launchBrowser: async (config) => {
    console.log('amazonBrowserAPI.launchBrowser called with config:', config);
    return await ipcRenderer.invoke('amazon:launchBrowser', config);
  },
  executeRegisterScript: async (config) => {
    console.log('amazonBrowserAPI.executeRegisterScript called with config:', config);
    return await ipcRenderer.invoke('amazon:executeRegisterScript', config);
  },
  deleteContainer: async (containerCode) => {
    console.log('amazonBrowserAPI.deleteContainer called with containerCode:', containerCode);
    return await ipcRenderer.invoke('amazon:deleteContainer', { containerCode });
  }
});
console.log('✅ amazonBrowserAPI exposed');

console.log('=== Preload script完成 ===');

