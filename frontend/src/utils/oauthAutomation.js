// src/utils/oauthAutomation.js
// 自动化OAuth授权流程

const { chromium } = require('playwright');

/**
 * 自动化Device Code授权
 */
async function automateDeviceCodeAuth(account, deviceCodeUrl, userCode, options = {}) {
  const {
    onProgress = () => {},
    headless = false,
    timeout = 120000,
    staySignedIn = false  // 默认不保持登录
  } = options;
  
  let browser = null;
  
  try {
    onProgress({ step: 'init', message: '启动授权浏览器...' });
    
    // 使用本地Chrome浏览器
    const chromePaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
    ];
    
    const fs = require('fs');
    let executablePath = chromePaths.find(path => fs.existsSync(path));
    
    if (!executablePath) {
      throw new Error('未找到Chrome浏览器，请安装Chrome');
    }
    
    browser = await chromium.launch({
      headless: headless,
      executablePath: executablePath,  // 使用本地Chrome
      args: ['--no-sandbox', '--disable-blink-features=AutomationControlled']
    });
    
    const context = await browser.newContext({
      viewport: { width: 800, height: 600 }
    });
    
    const page = await context.newPage();
    
    // ==================== 步骤1: 访问授权页面 ====================
    onProgress({ step: 'navigate', message: `访问授权页面: ${deviceCodeUrl}` });
    await page.goto(deviceCodeUrl, { waitUntil: 'domcontentloaded' });
    
    // ==================== 步骤2: 输入User Code ====================
    onProgress({ step: 'code', message: `输入代码: ${userCode}` });
    
    const codeInput = 'input[name="otc"]';
    await page.waitForSelector(codeInput, { timeout: 10000 });
    await page.fill(codeInput, userCode);
    
    await page.waitForTimeout(300);
    
    // 点击Next
    await page.click('button[type="submit"]');
    
    await page.waitForTimeout(1000);
    
    // ==================== 步骤3: 登录账号 ====================
    onProgress({ step: 'login', message: `登录账号: ${account.email}` });
    
    // 检查是否有验证码过期提示
    const expiredText = await page.textContent('body').catch(() => '');
    if (expiredText.includes('代码已过期') || expiredText.includes('code has expired')) {
      throw new Error('验证码已过期，请重新获取');
    }
    
    // 输入邮箱
    const emailInput = 'input[type="email"]';
    await page.waitForSelector(emailInput, { timeout: 10000 });
    await page.fill(emailInput, account.email);
    
    await page.waitForTimeout(300);
    await page.click('button[type="submit"]');
    
    await page.waitForTimeout(1000);
    
    // 输入密码
    const passwordInput = 'input[type="password"]';
    await page.waitForSelector(passwordInput, { timeout: 10000 });
    await page.fill(passwordInput, account.password);
    
    await page.waitForTimeout(300);
    await page.click('button[type="submit"]');
    
    await page.waitForTimeout(1500);
    
    // ==================== 步骤4: 处理"保持登录"提示 ====================
    try {
      const yesButton = 'button[value="Yes"]';
      const noButton = 'button[value="No"]';
      
      // 等待按钮出现（最多2秒）
      await page.waitForSelector(`${yesButton}, ${noButton}`, { timeout: 2000 }).catch(() => null);
      
      if (await page.$(yesButton) || await page.$(noButton)) {
        const buttonToClick = staySignedIn ? yesButton : noButton;
        const message = staySignedIn ? '选择保持登录(是)...' : '选择不保持登录(否)...';
        
        onProgress({ step: 'stay', message });
        await page.click(buttonToClick);
        await page.waitForTimeout(1000);
      }
    } catch (error) {
      // 可能没有这个提示
    }
    
    // ==================== 步骤5: 确认授权 ====================
    onProgress({ step: 'approve', message: '确认授权...' });
    
    try {
      // 查找"接受"或"Allow"按钮
      const acceptButton = 'button[value="1"]';
      await page.waitForSelector(acceptButton, { timeout: 10000 });
      await page.click(acceptButton);
      
      await page.waitForTimeout(1000);
      
      onProgress({ step: 'success', message: '✅ 授权成功！' });
      
      return {
        success: true,
        message: '授权完成'
      };
      
    } catch (error) {
      // 检查是否已经在成功页面
      const currentUrl = page.url();
      if (currentUrl.includes('success') || currentUrl.includes('approved')) {
        onProgress({ step: 'success', message: '✅ 授权成功！' });
        return {
          success: true,
          message: '授权完成'
        };
      }
      
      throw new Error('未找到授权确认按钮');
    }
    
  } catch (error) {
    onProgress({ 
      step: 'error', 
      message: '授权失败', 
      error: error.message 
    });
    
    return {
      success: false,
      error: error.message
    };
    
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * 批量自动授权
 */
async function batchAutomateAuth(accounts, clientId, options = {}) {
  const {
    concurrency = 1,
    staySignedIn = false,  // 添加staySignedIn选项
    onProgress = () => {},
    onComplete = () => {}
  } = options;
  
  const msGraphROPC = require('./msGraphROPC');
  const msGraphDeviceCode = require('./msGraphDeviceCode');
  
  const results = [];
  const queue = [...accounts];
  
  onProgress({
    type: 'start',
    message: `开始批量授权 ${accounts.length} 个账号`
  });
  
  const workers = [];
  for (let i = 0; i < Math.min(concurrency, queue.length); i++) {
    workers.push(async () => {
      while (queue.length > 0) {
        const account = queue.shift();
        if (!account) break;
        
        onProgress({
          type: 'info',
          message: `正在授权: ${account.email}`
        });
        
        try {
          // 方法1: 尝试ROPC方式（用户名密码直接换Token）
          onProgress({
            type: 'info',
            message: `${account.email} - 尝试密码方式授权...`
          });
          
          const ropcResult = await msGraphROPC.getTokenByPassword({
            clientId: clientId,
            username: account.email,
            password: account.password,
            scope: 'https://outlook.office.com/.default offline_access'
          });
          
          results.push({
            success: true,
            email: account.email,
            method: 'ROPC',
            refreshToken: ropcResult.refreshToken,
            accessToken: ropcResult.accessToken
          });
          
          onProgress({
            type: 'success',
            message: `✓ ${account.email} - ROPC授权成功`
          });
          
        } catch (ropcError) {
          // ROPC失败，尝试Device Code Flow + 自动化
          onProgress({
            type: 'info',
            message: `${account.email} - ROPC失败，尝试Device Code...`
          });
          
          try {
            // 启动Device Code Flow
            const deviceCodeData = await msGraphDeviceCode.startDeviceCodeFlow({
              clientId: clientId,
              scope: 'https://outlook.office.com/.default offline_access'
            });
            
            // 立即开始token轮询（在后台异步进行）
            const tokenPromise = msGraphDeviceCode.pollForRefreshToken({
              clientId: clientId,
              deviceCode: deviceCodeData.device_code,
              interval: deviceCodeData.interval || 5,
              expiresIn: deviceCodeData.expires_in,
              email: account.email
            });
            
            // 同时启动自动化授权流程
            const authResult = await automateDeviceCodeAuth(
              account,
              deviceCodeData.verification_uri,
              deviceCodeData.user_code,
              {
                staySignedIn: staySignedIn,  // 传递staySignedIn选项
                onProgress: (progress) => {
                  onProgress({
                    type: 'progress',
                    email: account.email,
                    ...progress
                  });
                },
                headless: false
              }
            );
            
            if (authResult.success) {
              // 等待token轮询完成（此时应该已经在后台获取中了）
              const tokenResult = await tokenPromise;
              
              results.push({
                success: true,
                email: account.email,
                method: 'DeviceCode',
                refreshToken: tokenResult.refreshToken,
                accessToken: tokenResult.accessToken
              });
              
              onProgress({
                type: 'success',
                message: `✓ ${account.email} - Device Code授权成功`
              });
            } else {
              throw new Error(authResult.error);
            }
            
          } catch (deviceError) {
            results.push({
              success: false,
              email: account.email,
              error: deviceError.message
            });
            
            onProgress({
              type: 'error',
              message: `✗ ${account.email} - 授权失败: ${deviceError.message}`
            });
          }
        }
        
        // 延迟
        if (queue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
        }
      }
    });
  }
  
  await Promise.all(workers.map(w => w()));
  
  const successCount = results.filter(r => r.success).length;
  
  onComplete({
    total: accounts.length,
    success: successCount,
    fail: accounts.length - successCount,
    results
  });
  
  return results;
}

module.exports = {
  automateDeviceCodeAuth,
  batchAutomateAuth
};
