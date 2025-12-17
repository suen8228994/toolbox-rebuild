/**
 * 地址绑定功能测试脚本（需要登录）
 * 
 * 测试流程：
 * 1. 启动浏览器
 * 2. 登录Amazon账户
 * 3. 处理OTP验证（如果需要）
 * 4. 点击个人中心
 * 5. 执行地址绑定流程
 * 
 * 使用方法：
 * node test-address-binding-login.js
 */

const { chromium } = require('playwright');
const AmazonRegisterCore = require('./src/utils/amazonRegisterCore');

// ==================== 配置区域 ====================
const TEST_CONFIG = {
  // Amazon登录信息
  email: 'AmalIng2816@hotmail.com',
  password: 'jwyQkjB133412',
  otpSecret: null,  // null = 需要手动输入OTP
  
  // 浏览器配置
  headless: false,
  slowMo: 100,
  
  // 地址绑定配置（null使用自动生成）
  addressData: null
};

// ==================== 辅助函数 ====================

/**
 * 等待用户手动输入OTP
 */
async function waitForManualOTP(page) {
  console.log('\n⚠️  请手动输入OTP验证码，脚本将等待...');
  console.log('提示：输入完成后会自动继续');
  
  await page.waitForURL(url => !url.includes('ap/mfa') && !url.includes('ap/cvf'), { timeout: 120000 });
  console.log('✅ 检测到登录成功');
}

/**
 * 记录日志
 */
function log(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const prefix = {
    info: '📋',
    success: '✅',
    error: '❌',
    warning: '⚠️'
  }[type] || '📋';
  
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

// ==================== 主测试流程 ====================

async function testAddressBinding() {
  let browser = null;
  let page = null;
  
  try {
    log('开始地址绑定测试', 'info');
    log('='.repeat(60), 'info');
    
    // 1. 启动浏览器
    log('步骤 1: 启动浏览器...', 'info');
    browser = await chromium.launch({
      headless: TEST_CONFIG.headless,
      slowMo: TEST_CONFIG.slowMo,
      args: ['--start-maximized']
    });
    
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });
    
    page = await context.newPage();
    log('浏览器启动成功', 'success');
    
    // 2. 访问Amazon登录页
    log('步骤 2: 访问Amazon登录页...', 'info');
    await page.goto('https://www.amazon.com/ap/signin', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(2000);
    log('登录页加载完成', 'success');
    
    // 3. 输入邮箱
    log('步骤 3: 输入邮箱...', 'info');
    const emailInput = await page.waitForSelector('#ap_email', { timeout: 10000 });
    await emailInput.fill(TEST_CONFIG.email);
    await page.waitForTimeout(1000);
    await page.click('#continue');
    await page.waitForTimeout(3000);
    log(`邮箱已输入: ${TEST_CONFIG.email}`, 'success');
    
    // 4. 输入密码
    log('步骤 4: 输入密码...', 'info');
    const passwordInput = await page.waitForSelector('#ap_password', { timeout: 10000 });
    await passwordInput.fill(TEST_CONFIG.password);
    await page.waitForTimeout(1000);
    await page.click('#signInSubmit');
    await page.waitForTimeout(4000);
    log('密码已输入', 'success');
    
    // 5. 处理OTP验证
    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    if (currentUrl.includes('ap/mfa') || currentUrl.includes('ap/cvf')) {
      log('步骤 5: 检测到需要OTP验证', 'warning');
      await waitForManualOTP(page);
    } else {
      log('步骤 5: 无需OTP验证', 'success');
    }
    
    // 6. 等待登录完成
    log('步骤 6: 等待登录完成...', 'info');
    await page.waitForTimeout(2000);
    
    const accountElement = await page.locator('a[data-nav-role="signin"]').first().isVisible();
    if (!accountElement) {
      throw new Error('登录失败：未找到账户元素');
    }
    log('登录成功！', 'success');
    
    // 7. 初始化AmazonRegisterCore
    log('步骤 7: 初始化地址绑定模块...', 'info');
    const core = new AmazonRegisterCore({
      page: page,
      bindAddress: true,
      addressData: TEST_CONFIG.addressData,
      accountInfo: {
        user: TEST_CONFIG.email,
        password: TEST_CONFIG.password
      }
    });
    
    core.tasklog = function(logData) {
      const message = logData.message || JSON.stringify(logData);
      const logID = logData.logID || 'INFO';
      log(`[${logID}] ${message}`, 'info');
    };
    
    log('地址绑定模块初始化完成', 'success');
    
    // 8. 执行地址绑定流程
    log('步骤 8: 开始执行地址绑定流程...', 'info');
    log('='.repeat(60), 'info');
    
    await core.bindAddress();
    
    log('='.repeat(60), 'info');
    log('地址绑定测试完成！', 'success');
    
    // 9. 等待查看结果
    log('等待5秒后关闭浏览器...', 'info');
    await page.waitForTimeout(5000);
    
  } catch (error) {
    log(`测试失败: ${error.message}`, 'error');
    console.error(error.stack);
    
    if (page) {
      log('发生错误，浏览器将保持打开30秒以便检查...', 'warning');
      await page.waitForTimeout(30000);
    }
  } finally {
    if (browser) {
      await browser.close();
      log('浏览器已关闭', 'info');
    }
  }
}

// ==================== 执行测试 ====================

console.log('\n🚀 Amazon地址绑定功能测试\n');
console.log('配置信息：');
console.log(`  - 邮箱: ${TEST_CONFIG.email}`);
console.log(`  - OTP: 需要手动输入`);
console.log(`  - 地址: 自动生成真实地址`);
console.log('\n⚠️  注意：如果需要OTP验证，请准备好验证器应用\n');

testAddressBinding()
  .then(() => {
    console.log('\n✅ 测试脚本执行完成\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 测试脚本执行失败\n');
    console.error(error);
    process.exit(1);
  });
