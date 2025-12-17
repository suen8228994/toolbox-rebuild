// src/utils/playwrightHotmailRegister.js
// 使用Playwright真实自动化注册Hotmail/Outlook账号 + RoxyBrowser指纹浏览器

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { RoxyBrowserClient } = require('./roxyBrowserClient');

/**
 * 配置项
 */
const CONFIG = {
  headless: false,  // 显示浏览器方便调试
  timeout: 60000,   // 60秒超时（增加等待时间）
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  locale: 'en-US',
  timezoneId: 'America/New_York'
};

/**
 * 生成随机用户数据
 */
function generateUserData() {
  const firstName = randomName();
  const lastName = randomName();
  const birthYear = 1980 + Math.floor(Math.random() * 28); // 1980-2007 (确保大于18岁)
  const birthMonth = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
  const birthDay = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
  
  return {
    email: `${firstName.toLowerCase()}${lastName.toLowerCase()}${Math.floor(Math.random() * 9999)}@outlook.com`,
    password: generatePassword(),
    firstName: firstName,
    lastName: lastName,
    birthYear: birthYear,
    birthMonth: birthMonth,
    birthDay: birthDay,
    country: 'US'
  };
}

/**
 * 生成随机名字
 */
function randomName() {
  const names = [
    'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph',
    'Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan', 'Jessica',
    'Thomas', 'Charles', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven',
    'Nancy', 'Karen', 'Betty', 'Helen', 'Sandra', 'Donna', 'Carol', 'Ruth'
  ];
  return names[Math.floor(Math.random() * names.length)];
}

/**
 * 生成强密码
 */
function generatePassword() {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*';
  
  let password = '';
  password += upper[Math.floor(Math.random() * upper.length)];
  password += lower[Math.floor(Math.random() * lower.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  const all = upper + lower + numbers + symbols;
  for (let i = 0; i < 8; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }
  
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * 延迟函数
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 随机延迟（模拟人类行为）
 */
async function humanDelay() {
  await delay(800 + Math.random() * 1200);
}

/**
 * 模拟人类打字
 */
async function humanType(page, selector, text, options = {}) {
  await page.click(selector);
  await delay(100 + Math.random() * 200);
  
  for (const char of text) {
    await page.keyboard.type(char);
    await delay(50 + Math.random() * 150);
  }
  
  await delay(200 + Math.random() * 300);
}

/**
 * 等待并点击元素
 */
async function waitAndClick(page, selector, options = {}) {
  try {
    await page.waitForSelector(selector, { timeout: CONFIG.timeout, ...options });
    await humanDelay();
    await page.click(selector);
    await humanDelay();
    return true;
  } catch (error) {
    console.error(`点击失败: ${selector}`, error.message);
    return false;
  }
}

/**
 * 注册单个账号（使用RoxyBrowser指纹浏览器）
 */
async function registerAccount(userData, options = {}) {
  const {
    onProgress = () => {},
    proxy = null,
    captchaSolver = null,
    reuseContext = null  // 传入已有的浏览器上下文 {browser, context, page, roxyClient, roxyDirId}
  } = options;
  
  let browser = null;
  let context = null;
  let roxyClient = null;
  let roxyDirId = null;
  let shouldCleanup = true;  // 是否需要清理资源
  
  try {
    // 如果提供了复用的上下文，直接使用
    if (reuseContext) {
      browser = reuseContext.browser;
      context = reuseContext.context;
      roxyClient = reuseContext.roxyClient;
      roxyDirId = reuseContext.roxyDirId;
      shouldCleanup = false;  // 复用时不清理
      onProgress({ step: 'init', message: '♻️ 复用已有浏览器窗口...' });
    } else {
      // ==================== 初始化 RoxyBrowser ====================
      onProgress({ step: 'init', message: '🚀 初始化RoxyBrowser...' });
    
    roxyClient = new RoxyBrowserClient();
    await roxyClient.initialize();
    
    onProgress({ step: 'init', message: '✅ RoxyBrowser已连接' });
    
    // ==================== 解析代理配置 ====================
    let proxyInfo = {
      proxyMethod: 'custom',
      proxyCategory: 'noproxy'  // 默认不使用代理
    };
    
    if (proxy) {
      // 解析代理字符串: host:port:username:password
      const [host, port, username, password] = proxy.split(':');
      
      proxyInfo = {
        proxyMethod: 'custom',
        proxyCategory: 'HTTP',  // 使用 HTTP 代理避免 SSL 问题
        host: host,
        port: parseInt(port),
        proxyUserName: username || '',
        proxyPassword: password || '',
        protocol: 'HTTP',
        ipType: 'IPV4'
      };
      
      onProgress({ step: 'init', message: `🌐 使用代理: ${host}:${port} (HTTP)` });
    }
    
    // ==================== 创建 RoxyBrowser 窗口 ====================
    onProgress({ step: 'init', message: '🪟 创建浏览器窗口...' });
    
    const profileConfig = {
      windowName: `Hotmail_${userData.email}`,
      proxyInfo: proxyInfo
    };
    
    const createResult = await roxyClient.createProfile(profileConfig);
    roxyDirId = createResult.dirId;
    
    onProgress({ step: 'init', message: `✅ 窗口已创建: ${roxyDirId}` });
    
    // ==================== 打开窗口并连接 Playwright ====================
    onProgress({ step: 'init', message: '🔗 连接到浏览器...' });
    
    const openResult = await roxyClient.openProfile(roxyDirId);
    const wsEndpoint = openResult.ws;
    
    onProgress({ step: 'init', message: `🔗 WebSocket: ${wsEndpoint.substring(0, 50)}...` });
    
    // 使用Playwright连接到RoxyBrowser
    browser = await chromium.connectOverCDP(wsEndpoint);
    
    onProgress({ step: 'init', message: '🔗 已连接到浏览器' });
    
    // 等待一下让浏览器完全启动
    await delay(2000);
    
    // 获取已有的上下文和页面（RoxyBrowser会自动创建）
    const contexts = browser.contexts();
    if (contexts.length === 0) {
      throw new Error('RoxyBrowser未创建上下文');
    }
    
    context = contexts[0];
    }
    
    // 获取或创建页面
    let page;
    if (reuseContext) {
      // 复用模式：创建新标签页
      page = await context.newPage();
      onProgress({ step: 'init', message: '✅ 创建新标签页' });
    } else {
      const existingPages = context.pages();
      if (existingPages.length > 0) {
        page = existingPages[0];
        onProgress({ step: 'init', message: `✅ 使用已有页面: ${page.url()}` });
      } else {
        page = await context.newPage();
        onProgress({ step: 'init', message: '✅ 创建新页面' });
      }
    }
    
    // 设置页面为全屏
    try {
      // 最大化浏览器窗口
      await page.evaluate(() => {
        window.moveTo(0, 0);
        window.resizeTo(screen.availWidth, screen.availHeight);
      });
      onProgress({ step: 'init', message: '✅ 窗口已最大化' });
    } catch (err) {
      // 如果最大化失败，使用默认大小
      onProgress({ step: 'init', message: '⚠️ 窗口最大化失败，使用默认大小' });
    }
    
    onProgress({ step: 'init', message: '✅ 浏览器已连接，开始注册...' });
    
    // ==================== 步骤1: 访问注册页面 ====================
    onProgress({ step: 'navigate', message: '🌐 导航到注册页面...' });
    
    try {
      // 尝试多次导航，处理可能的 SSL 错误
      let navSuccess = false;
      let lastError = null;
      
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          onProgress({ step: 'navigate', message: `尝试导航 (${attempt}/3)...` });
          
          await page.goto('https://signup.live.com', { 
            waitUntil: 'domcontentloaded',
            timeout: CONFIG.timeout 
          });
          
          navSuccess = true;
          onProgress({ step: 'navigate', message: `✅ 页面已加载: ${page.url()}` });
          break;
        } catch (err) {
          lastError = err;
          onProgress({ step: 'navigate', message: `⚠️ 第 ${attempt} 次尝试失败: ${err.message}` });
          
          if (attempt < 3) {
            await delay(2000);
          }
        }
      }
      
      if (!navSuccess) {
        throw lastError;
      }
    } catch (navError) {
      onProgress({ step: 'error', message: `❌ 导航失败: ${navError.message}` });
      
      // 如果是 SSL 错误，提供更详细的信息
      if (navError.message.includes('SSL') || navError.message.includes('CIPHER')) {
        onProgress({ step: 'error', message: '💡 建议: SSL 错误可能是代理配置问题，尝试不使用代理或更换代理' });
      }
      
      throw navError;
    }
    
    await delay(2000 + Math.random() * 2000);
    
    // ==================== 步骤2: 输入邮箱 ====================
    onProgress({ step: 'email', message: `📧 准备输入邮箱: ${userData.email}` });
    
    try {
      // 检查当前页面状态
      const currentUrl = page.url();
      onProgress({ step: 'email', message: `🔍 当前URL: ${currentUrl}` });
      
      // 等待邮箱输入框 - 使用多个选择器策略
      const emailSelectors = [
        'input[type="email"][name="Email"]',              // 英文版
        'input[type="email"][name="Correo electrónico"]', // 西班牙语版
        'input[type="email"][aria-label*="email" i]',     // 通过 aria-label
        'input[type="email"][placeholder*="email" i]',    // 通过 placeholder
        'input[type="email"]'                             // 任何 email 输入框
      ];
      
      onProgress({ step: 'email', message: `⏳ 尝试查找邮箱输入框...` });
      
      let emailInput = null;
      for (const selector of emailSelectors) {
        try {
          const element = await page.waitForSelector(selector, { 
            timeout: 5000,
            state: 'visible'
          });
          if (element) {
            emailInput = selector;
            onProgress({ step: 'email', message: `✅ 找到邮箱输入框: ${selector}` });
            break;
          }
        } catch (err) {
          // 继续尝试下一个选择器
          onProgress({ step: 'email', message: `⏭️ 选择器 ${selector} 未找到，尝试下一个...` });
        }
      }
      
      if (!emailInput) {
        throw new Error('所有邮箱输入框选择器都失败了');
      }
      
      // 输入邮箱
      await humanType(page, emailInput, userData.email);
      onProgress({ step: 'email', message: `✅ 邮箱已输入: ${userData.email}` });
      
      // 点击Next
      onProgress({ step: 'email', message: `🖱️ 点击下一步按钮...` });
      await waitAndClick(page, 'button[data-testid="primaryButton"]');
      onProgress({ step: 'email', message: `✅ 已点击下一步` });
      
    } catch (emailError) {
      onProgress({ step: 'error', message: `❌ 邮箱输入失败: ${emailError.message}` });
      
      // 保存页面截图和HTML用于调试
      try {
        const screenshotPath = path.join(__dirname, '../../debug', `error_${Date.now()}.png`);
        const htmlPath = path.join(__dirname, '../../debug', `error_${Date.now()}.html`);
        
        const debugDir = path.dirname(screenshotPath);
        if (!fs.existsSync(debugDir)) {
          fs.mkdirSync(debugDir, { recursive: true });
        }
        
        await page.screenshot({ path: screenshotPath, fullPage: true });
        const html = await page.content();
        fs.writeFileSync(htmlPath, html);
        
        onProgress({ step: 'error', message: `📸 调试文件已保存: ${screenshotPath}` });
      } catch (debugError) {
        onProgress({ step: 'error', message: `⚠️ 保存调试文件失败: ${debugError.message}` });
      }
      
      throw emailError;
    }
    
    await delay(1500);
    
    // ==================== 步骤3: 创建密码 ====================
    onProgress({ step: 'password', message: '⏳ 等待密码页面加载...' });
    
    try {
      // 等待页面加载
      await delay(2000);
      
      // 等待密码输入框出现 - 支持多种选择器格式
      const passwordSelectors = [
        'input[type="password"][autocomplete="new-password"]',  // 新版页面
        'input[type="password"][name="Password"]',  // 旧版页面
        'input[id^="floatingLabelInput"][type="password"]'  // 浮动标签格式
      ];
      
      // 使用Promise.race等待任意密码输入框出现
      let passwordInput = null;
      try {
        await Promise.race(
          passwordSelectors.map(selector => 
            page.waitForSelector(selector, { timeout: 30000, state: 'visible' })
              .then(() => { passwordInput = selector; })
          )
        );
      } catch (error) {
        const pageContent = await page.content();
        const hasPassword = pageContent.includes('Password') || pageContent.includes('password');
        onProgress({ step: 'error', message: `页面调试: 包含Password文本=${hasPassword}` });
        throw new Error('未找到密码输入框 - 页面可能未正确加载');
      }
      
      if (!passwordInput) {
        throw new Error('未找到密码输入框');
      }
      
      onProgress({ step: 'password', message: '🔐 设置密码...' });
      await humanType(page, passwordInput, userData.password);
      
      onProgress({ step: 'password', message: `✅ 密码已设置: ${userData.password}` });
      
      // 点击Next
      await waitAndClick(page, 'button[data-testid="primaryButton"]');
      await delay(1500);
    } catch (error) {
      onProgress({ step: 'error', message: '密码页面加载失败', error: error.message });
      throw error;
    }
    
    // ==================== 步骤4: 选择国家和生日 ====================
    // 注意：Microsoft更改了页面顺序，现在生日在姓名之前
    onProgress({ step: 'birthday', message: '⏳ 等待生日页面加载...' });
    
    try {
      // 等待页面加载 - 等待生日月份下拉框出现
      await delay(2000);
      await page.waitForSelector('button[name="BirthMonth"]', { timeout: CONFIG.timeout, state: 'visible' });
      await delay(800);
      
      onProgress({ step: 'birthday', message: '📅 开始填写生日信息...' });
      
      // 国家/地区 - 跳过，使用默认值
      onProgress({ step: 'birthday', message: '🌍 使用默认国家/地区' });
      
      // 生日月份 - Fluent UI下拉框
      const monthButton = 'button[name="BirthMonth"]';
      if (await page.$(monthButton)) {
        onProgress({ step: 'birthday', message: '📅 选择月份...' });
        
        // 使用force点击避免被label遮挡
        await page.click(monthButton, { force: true });
        await delay(1000);
        
        // 等待下拉选项出现
        await page.waitForSelector('[role="option"]', { timeout: 10000, state: 'visible' });
        await delay(500);
        
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                           'July', 'August', 'September', 'October', 'November', 'December'];
        const monthIndex = parseInt(userData.birthMonth) - 1;
        const monthText = monthNames[monthIndex];
        
        onProgress({ step: 'birthday', message: `📅 选择月份: ${monthText}` });
        
        // 直接通过索引选择（最可靠）
        const monthOptions = await page.$$('[role="option"]');
        if (monthOptions.length > monthIndex) {
          await monthOptions[monthIndex].click();
          onProgress({ step: 'birthday', message: `✅ 已选择月份: ${monthText}` });
        }
        
        await humanDelay();
      }
      
      // 生日日期 - Fluent UI下拉框
      const dayButton = 'button[name="BirthDay"]';
      if (await page.$(dayButton)) {
        onProgress({ step: 'birthday', message: `📅 选择日期...` });
        
        // 使用force点击避免被label遮挡
        await page.click(dayButton, { force: true });
        await delay(1000);
        
        // 等待下拉选项出现
        await page.waitForSelector('[role="option"]', { timeout: 10000, state: 'visible' });
        await delay(500);
        
        const dayNum = parseInt(userData.birthDay);
        onProgress({ step: 'birthday', message: `📅 选择日期: ${dayNum}` });
        
        // 直接通过索引选择（第N个选项，注意索引从0开始）
        const dayOptions = await page.$$('[role="option"]');
        if (dayOptions.length >= dayNum) {
          await dayOptions[dayNum - 1].click();
          onProgress({ step: 'birthday', message: `✅ 已选择日期: ${dayNum}` });
        }
        
        await humanDelay();
      }
      
      // 生日年份 - 输入框
      const yearInput = 'input[name="BirthYear"]';
      if (await page.$(yearInput)) {
        await page.click(yearInput);
        await delay(200);
        await page.fill(yearInput, String(userData.birthYear));
        await humanDelay();
      }
      
      onProgress({ step: 'birthday', message: `✅ 生日已填写: ${userData.birthMonth}/${userData.birthDay}/${userData.birthYear}` });
      
      // 点击Next
      await waitAndClick(page, 'button[data-testid="primaryButton"]');
      await delay(1500);
    } catch (error) {
      onProgress({ step: 'error', message: '生日页面填写失败', error: error.message });
      throw error;
    }
    
    // ==================== 步骤5: 输入姓名 ====================
    onProgress({ step: 'name', message: '⏳ 等待姓名页面加载...' });
    
    try {
      // 等待页面加载 - 等待任意一个姓名输入框出现
      await delay(2000);
      
      const firstNameSelectors = [
        'input[name="firstNameInput"]',
        'input[id="firstNameInput"]',
        'input[name="FirstName"]'
      ];
      
      // 使用Promise.race等待任意选择器出现
      let firstNameInput = null;
      try {
        await Promise.race(
          firstNameSelectors.map(selector => 
            page.waitForSelector(selector, { timeout: 30000, state: 'visible' })
              .then(() => { firstNameInput = selector; })
          )
        );
      } catch (error) {
        const pageContent = await page.content();
        const hasFirstName = pageContent.includes('First name') || pageContent.includes('firstNameInput');
        onProgress({ step: 'error', message: `页面调试: 包含First name文本=${hasFirstName}` });
        throw new Error('未找到First Name输入框 - 页面可能未正确加载');
      }
      
      if (!firstNameInput) {
        throw new Error('未找到First Name输入框');
      }
      
      onProgress({ step: 'name', message: `✍️ 填写名字: ${userData.firstName}` });
      await humanType(page, firstNameInput, userData.firstName);
      
      // 姓氏
      const lastNameSelectors = [
        'input[name="lastNameInput"]',
        'input[id="lastNameInput"]',
        'input[name="LastName"]'
      ];
      
      let lastNameInput = null;
      for (const selector of lastNameSelectors) {
        if (await page.$(selector)) {
          lastNameInput = selector;
          break;
        }
      }
      
      if (!lastNameInput) {
        throw new Error('未找到Last Name输入框');
      }
      
      onProgress({ step: 'name', message: `✍️ 填写姓氏: ${userData.lastName}` });
      await humanType(page, lastNameInput, userData.lastName);
      
      onProgress({ step: 'name', message: `✅ 姓名已填写: ${userData.firstName} ${userData.lastName}` });
      
      // 点击Next
      await waitAndClick(page, 'button[data-testid="primaryButton"]');
      await delay(1500);
    } catch (error) {
      onProgress({ step: 'error', message: '姓名页面加载失败', error: error.message });
      throw error;
    }
    
    // ==================== 步骤6: 处理人机验证（CAPTCHA）====================
    onProgress({ step: 'captcha', message: '检测人机验证...' });
    
    try {
      // 等待页面加载，检测是否有人机验证
      await delay(3000);
      
      // 检测PerimeterX人机验证iframe
      const pxIframe = await page.$('iframe[data-testid="humanCaptchaIframe"]');
      
      if (pxIframe) {
        onProgress({ step: 'captcha', message: '🔍 检测到人机验证iframe' });
        onProgress({ step: 'captcha', message: '👆 请手动完成验证！点击并按住按钮...' });
        
        // 等待用户手动完成验证（最多等待3分钟）
        onProgress({ step: 'captcha', message: '⏰ 等待手动验证（最多3分钟）...' });
        
        const maxWaitTime = 180000; // 3分钟
        const checkInterval = 2000; // 每2秒检查一次
        let waited = 0;
        let verificationPassed = false;
        
        while (waited < maxWaitTime) {
          await delay(checkInterval);
          waited += checkInterval;
          
          // 检查是否还在验证页面
          const stillHasIframe = await page.$('iframe[data-testid="humanCaptchaIframe"]');
          if (!stillHasIframe) {
            onProgress({ step: 'captcha', message: '✅ 验证通过！' });
            verificationPassed = true;
            break;
          }
          
          // 每10秒提示一次
          if (waited % 10000 === 0) {
            const remainingSeconds = Math.floor((maxWaitTime - waited) / 1000);
            onProgress({ step: 'captcha', message: `⏱️ 等待验证中... (剩余 ${remainingSeconds} 秒)` });
          }
        }
        
        if (!verificationPassed) {
          throw new Error('验证超时，请重试');
        }
        
        // 验证成功后，等待页面跳转
        await delay(3000);
            
        // 检查是否出现"A quick note about your Microsoft account"说明页面
        onProgress({ step: 'captcha', message: '🔍 检查是否有说明页面...' });
        
        try {
          // 多种方式查找OK按钮
          const okButtonSelectors = [
            'button:has-text("OK")',
            'button.ms-Button--primary:has-text("OK")',
            'button[type="button"]:has-text("OK")',
            'button.ms-Button',
            'button[class*="primary"]'
          ];
          
          let okButtonFound = false;
          
          for (const selector of okButtonSelectors) {
            try {
              const button = await page.waitForSelector(selector, { timeout: 5000, state: 'visible' });
              if (button) {
                const text = await button.textContent();
                if (text && text.trim() === 'OK') {
                  onProgress({ step: 'captcha', message: '✅ 找到OK按钮，准备点击...' });
                  await delay(500);
                  await button.click();
                  onProgress({ step: 'captcha', message: '✅ 已点击OK按钮' });
                  okButtonFound = true;
                  break;
                }
              }
            } catch (err) {
              // 继续尝试下一个选择器
            }
          }
          
          if (!okButtonFound) {
            onProgress({ step: 'captcha', message: '⚠️ 未找到OK按钮，可能不需要或已跳过' });
          }
          
          // 再等待一下确保页面完全加载
          await delay(2000);
          
        } catch (okError) {
          onProgress({ step: 'captcha', message: `⚠️ 处理说明页面失败: ${okError.message}` });
        }
        
      } else {
        // 检查是否有reCAPTCHA
        const hasCaptcha = await page.locator('iframe[src*="recaptcha"]').count() > 0;
        
        if (hasCaptcha) {
          if (captchaSolver) {
            onProgress({ step: 'captcha', message: '⚠️ 检测到reCAPTCHA，需要第三方服务解决' });
            await delay(30000);
          } else {
            onProgress({ step: 'captcha', message: '⚠️ 检测到reCAPTCHA，需要手动完成（60秒）' });
            await delay(60000);
          }
        } else {
          onProgress({ step: 'captcha', message: '✅ 未检测到验证码，继续下一步' });
        }
      }
      
    } catch (error) {
      onProgress({ step: 'error', message: `验证码处理错误: ${error.message}` });
      // 出错时等待手动完成
      await delay(60000);
    }
    
    // ==================== 步骤7: 处理手机验证 ====================
    onProgress({ step: 'phone', message: '检测手机验证...' });
    
    const phoneInput = 'input[type="tel"]';
    const hasPhoneVerification = await page.$(phoneInput) !== null;
    
    if (hasPhoneVerification) {
      onProgress({ step: 'phone', message: '⚠️ 需要手机号验证（需要接码平台）' });
      
      if (options.smsService) {
        // 集成接码平台
        // const phoneNumber = await options.smsService.getNumber('microsoft', 'US');
        // await humanType(page, phoneInput, phoneNumber);
        // await waitAndClick(page, 'button[data-testid="primaryButton"]');
        // const code = await options.smsService.getCode(phoneNumber);
        // await humanType(page, 'input[name="VerificationCode"]', code);
        
        onProgress({ step: 'phone', message: '⚠️ 手机验证需要接码平台集成' });
        await delay(60000);
      } else {
        onProgress({ step: 'phone', message: '⚠️ 需要手动输入手机号和验证码' });
        await delay(120000); // 等待2分钟
      }
    }
    
    // ==================== 步骤8: 等待注册完成 ====================
    onProgress({ step: 'complete', message: '等待注册完成...' });
    
    try {
      // 等待跳转到成功页面或账户页面
      await page.waitForURL('**/account/**', { timeout: 30000 });
      
      onProgress({ step: 'success', message: '✅ 注册成功！' });
      
      // 保存截图
      const screenshotPath = path.join(__dirname, '../../screenshots', `${userData.email}.png`);
      const screenshotDir = path.dirname(screenshotPath);
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }
      await page.screenshot({ path: screenshotPath });
      
      return {
        success: true,
        email: userData.email,
        password: userData.password,
        data: userData,
        screenshot: screenshotPath,
        browserContext: shouldCleanup ? null : {
          browser,
          context,
          roxyClient,
          roxyDirId
        }
      };
      
    } catch (error) {
      // 可能还在某个验证步骤
      onProgress({ step: 'warning', message: '注册可能需要额外验证步骤' });
      
      // 保存当前页面状态
      const currentUrl = page.url();
      const screenshotPath = path.join(__dirname, '../../screenshots', `${userData.email}_pending.png`);
      await page.screenshot({ path: screenshotPath });
      
      return {
        success: false,
        email: userData.email,
        password: userData.password,
        status: 'pending',
        currentUrl: currentUrl,
        message: '注册未完成，可能需要人工介入',
        screenshot: screenshotPath,
        browserContext: shouldCleanup ? null : {
          browser,
          context,
          roxyClient,
          roxyDirId
        }
      };
    }
    
  } catch (error) {
    onProgress({ 
      step: 'error', 
      message: '注册失败', 
      error: error.message 
    });
    
    return {
      success: false,
      email: userData.email,
      error: error.message,
      stack: error.stack
    };
    
  } finally {
    // ==================== 清理 RoxyBrowser ====================
    if (shouldCleanup) {
      onProgress({ step: 'cleanup', message: '🧹 清理资源...' });
      
      try {
        // 关闭浏览器连接
        if (browser) {
          await browser.close();
          onProgress({ step: 'cleanup', message: '✅ 浏览器连接已关闭' });
        }
      } catch (err) {
        onProgress({ step: 'cleanup', message: `⚠️ 浏览器关闭失败: ${err.message}` });
      }
      
      // 关闭并删除 RoxyBrowser 窗口（释放免费额度）
      if (roxyClient && roxyDirId) {
        try {
          onProgress({ step: 'cleanup', message: `🗑️ 关闭窗口: ${roxyDirId}` });
          await roxyClient.closeProfile(roxyDirId);
          
          onProgress({ step: 'cleanup', message: `🗑️ 删除窗口: ${roxyDirId}` });
          await roxyClient.deleteProfile(roxyDirId);
          
          onProgress({ step: 'cleanup', message: '✅ RoxyBrowser窗口已删除' });
        } catch (cleanupErr) {
          onProgress({ 
            step: 'cleanup', 
            message: `⚠️ RoxyBrowser清理失败: ${cleanupErr.message}` 
          });
        }
      }
      
      onProgress({ step: 'cleanup', message: '✅ 清理完成' });
    } else {
      onProgress({ step: 'cleanup', message: '♻️ 保留浏览器窗口供后续使用' });
    }
  }
}

/**
 * 批量注册
 */
async function batchRegister(options = {}) {
  const {
    quantity = 1,
    concurrency = 1,
    onProgress = () => {},
    onComplete = () => {},
    proxies = [],
    captchaSolver = null,
    smsService = null
  } = options;
  
  const results = [];
  const queue = [];
  let proxyIndex = 0;
  
  // 生成用户数据
  for (let i = 0; i < quantity; i++) {
    queue.push(generateUserData());
  }
  
  onProgress({
    type: 'start',
    message: `开始批量注册 ${quantity} 个账号，并发数: ${concurrency}，代理数: ${proxies.length}，每窗口3账号`
  });
  
  // 并发控制 - 每个worker处理3个账号共用1个窗口
  const workers = [];
  for (let i = 0; i < Math.min(concurrency, Math.ceil(queue.length / 3)); i++) {
    workers.push(async () => {
      while (queue.length > 0) {
        // 每个窗口处理3个账号
        let sharedContext = null;
        const accountsInThisWindow = [];
        
        // 取3个账号（或剩余的所有账号）
        for (let j = 0; j < 3 && queue.length > 0; j++) {
          accountsInThisWindow.push(queue.shift());
        }
        
        if (accountsInThisWindow.length === 0) break;
        
        // 轮询选择代理（1个代理用于3个账号）
        const currentProxy = proxies.length > 0 ? proxies[proxyIndex % proxies.length] : null;
        proxyIndex++;
        
        onProgress({
          type: 'info',
          message: `新窗口开始，将注册${accountsInThisWindow.length}个账号` + (currentProxy ? ` [代理: ${currentProxy.split(':')[0]}]` : '')
        });
        
        // 逐个处理3个账号
        for (let k = 0; k < accountsInThisWindow.length; k++) {
          const userData = accountsInThisWindow[k];
          const isFirstInWindow = k === 0;
          const isLastInWindow = k === accountsInThisWindow.length - 1;
          
          onProgress({
            type: 'info',
            message: `正在注册: ${userData.email} (窗口内第${k+1}/${accountsInThisWindow.length}个账号，剩余 ${queue.length})` + (currentProxy ? ` [代理: ${currentProxy.split(':')[0]}]` : '')
          });
          
          const result = await registerAccount(userData, {
            reuseContext: isFirstInWindow ? null : sharedContext,
            onProgress: (progress) => {
              onProgress({
              type: 'progress',
              email: userData.email,
              ...progress
            });
          },
          proxy: currentProxy,
          captchaSolver,
          smsService
        });
        
        results.push(result);
        
        // 如果是第一个账号且成功，保存上下文供后续账号复用
        if (isFirstInWindow && result.success && result.browserContext) {
          sharedContext = result.browserContext;
          onProgress({
            type: 'info',
            message: `✅ 窗口创建成功，将复用此窗口注册后续账号`
          });
        }
        
        onProgress({
          type: result.success ? 'success' : 'error',
          message: result.success 
            ? `✓ ${userData.email} 注册成功 (窗口内第${k+1}个)` 
            : `✗ ${userData.email} 注册失败: ${result.error || result.message}`,
          result
        });
        
        // 如果是最后一个账号或失败，清理窗口
        if ((isLastInWindow || !result.success) && sharedContext) {
          onProgress({
            type: 'info',
            message: `🧹 清理窗口资源...`
          });
          
          try {
            // 清理浏览器
            if (sharedContext.browser) {
              await sharedContext.browser.close().catch(() => {});
            }
            
            // 清理RoxyBrowser
            if (sharedContext.roxyClient && sharedContext.roxyDirId) {
              await sharedContext.roxyClient.closeProfile(sharedContext.roxyDirId).catch(() => {});
              await sharedContext.roxyClient.deleteProfile(sharedContext.roxyDirId).catch(() => {});
            }
            
            onProgress({
              type: 'info',
              message: `✅ 窗口已关闭，共注册${k+1}个账号`
            });
          } catch (cleanupErr) {
            onProgress({
              type: 'info',
              message: `⚠️ 清理出错: ${cleanupErr.message}`
            });
          }
          
          sharedContext = null;
        }
        
        // 延迟避免频率限制（同窗口内账号之间也延迟）
        if (!isLastInWindow || queue.length > 0) {
          const delayTime = 3000 + Math.random() * 2000;
          onProgress({
            type: 'info',
            message: `等待 ${Math.round(delayTime / 1000)} 秒后继续...`
          });
          await delay(delayTime);
        }
      }
      }
    });
  }
  
  await Promise.all(workers.map(w => w()));
  
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  
  onComplete({
    total: quantity,
    success: successCount,
    fail: failCount,
    results
  });
  
  return results;
}

module.exports = {
  registerAccount,
  batchRegister,
  generateUserData,
  CONFIG
};
