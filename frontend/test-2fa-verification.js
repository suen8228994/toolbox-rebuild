// 测试2FA验证流程
// 使用已存在的HubStudio环境进行测试

const { chromium } = require('playwright');
const HubStudioClient = require('./src/utils/hubstudioClient');

// 测试配置
const TEST_CONFIG = {
  containerName: 'Amazon-Register-1765938477632', // 您的环境名称
  email: 'test@example.com', // 测试邮箱
  password: 'testPassword123', // 测试密码
  // 如果需要，修改这些值
};

async function test2FAVerification() {
  console.log('\n========== 开始测试2FA验证流程 ==========\n');
  
  const hubstudio = new HubStudioClient();
  let browser = null;
  
  try {
    // 1. 连接到已存在的HubStudio环境
    console.log(`正在连接到环境: ${TEST_CONFIG.containerName}`);
    
    // 获取环境列表，找到指定环境
    const containers = await hubstudio.getContainerList();
    const targetContainer = containers.find(c => c.containerName === TEST_CONFIG.containerName);
    
    if (!targetContainer) {
      throw new Error(`未找到环境: ${TEST_CONFIG.containerName}`);
    }
    
    console.log(`✅ 找到环境，containerCode: ${targetContainer.containerCode}`);
    
    // 2. 启动浏览器
    console.log('\n正在启动浏览器...');
    const browserInfo = await hubstudio.startBrowser({
      containerCode: targetContainer.containerCode,
      args: ['--disable-blink-features=AutomationControlled']
    });
    
    console.log(`✅ 浏览器已启动，调试端口: ${browserInfo.debuggingPort}`);
    
    // 3. 连接到浏览器
    console.log('\n正在连接到浏览器...');
    const wsEndpoint = `http://127.0.0.1:${browserInfo.debuggingPort}`;
    const response = await fetch(`${wsEndpoint}/json/version`);
    const versionData = await response.json();
    
    browser = await chromium.connectOverCDP(versionData.webSocketDebuggerUrl);
    const context = browser.contexts()[0];
    const page = context.pages()[0] || await context.newPage();
    
    console.log('✅ 已连接到浏览器\n');
    
    // 4. 导航到Amazon首页
    console.log('========== 开始测试2FA设置流程 ==========\n');
    console.log('[1] 导航到Amazon首页...');
    await page.goto('https://www.amazon.com', { timeout: 60000 });
    await page.waitForTimeout(2000);
    console.log('✅ 已到达首页\n');
    
    // 5. 打开个人中心
    console.log('[2] 打开个人中心...');
    const accountMenu = page.locator('a[data-nav-role="signin"]').first();
    await accountMenu.click();
    await page.waitForTimeout(2000);
    console.log('✅ 已打开个人中心\n');
    
    // 6. 打开登录与安全
    console.log('[3] 打开登录与安全...');
    const loginSecurityLink = page.locator('a[href*="ap/cnep"]').first();
    await loginSecurityLink.click();
    await page.waitForLoadState('load');
    await page.waitForTimeout(2000);
    console.log('✅ 已进入登录与安全页面\n');
    
    // 7. 打开两步验证设置
    console.log('[4] 打开两步验证设置...');
    const twoStepLink = page.locator('a[href*="/a/settings/approval/setup/register?"]');
    await twoStepLink.click();
    await page.waitForLoadState('load');
    await page.waitForTimeout(3000);
    console.log('✅ 已进入两步验证页面\n');
    
    // 8. 测试选择验证器应用选项
    console.log('[5] 测试选择"使用验证器应用"选项...');
    
    // 尝试多种可能的选择器
    let radioClicked = false;
    const selectors = [
      'input[type="radio"][value="totp"]',
      '#auth-TOTP',
      'input[name="otpDeviceContext"][value="totp"]',
      // 德语页面可能的选择器
      'input[value="totp"]',
      '[data-value="totp"]'
    ];
    
    for (const selector of selectors) {
      try {
        const radio = page.locator(selector).first();
        const count = await radio.count();
        if (count > 0) {
          console.log(`   找到单选按钮: ${selector}`);
          await radio.click();
          await page.waitForTimeout(1500);
          radioClicked = true;
          console.log('   ✅ 已点击单选按钮');
          break;
        }
      } catch (error) {
        console.log(`   未找到: ${selector}`);
      }
    }
    
    if (!radioClicked) {
      console.log('   ⚠️  未找到单选按钮，可能已经选中或页面结构不同');
    }
    
    // 9. 检查是否需要展开accordion
    console.log('\n[6] 检查验证器应用配置区域...');
    try {
      const accordion = page.locator('#sia-otp-accordion-totp-header');
      const count = await accordion.count();
      
      if (count > 0) {
        const expanded = await accordion.getAttribute('aria-expanded');
        console.log(`   Accordion状态: ${expanded}`);
        
        if (expanded === 'false') {
          console.log('   展开配置区域...');
          await accordion.click();
          await page.waitForTimeout(1500);
          console.log('   ✅ 已展开');
        } else {
          console.log('   ✅ 配置区域已展开');
        }
      } else {
        console.log('   ⚠️  未找到accordion元素，可能页面结构不同');
      }
    } catch (error) {
      console.log(`   ⚠️  检查accordion失败: ${error.message}`);
    }
    
    // 10. 检查2FA密钥是否可见
    console.log('\n[7] 检查2FA密钥是否可见...');
    try {
      const secretElement = page.locator('#sia-auth-app-formatted-secret');
      await secretElement.waitFor({ timeout: 5000 });
      const secretText = await secretElement.innerText();
      console.log(`   ✅ 找到2FA密钥: ${secretText.substring(0, 20)}...`);
    } catch (error) {
      console.log(`   ❌ 未找到2FA密钥: ${error.message}`);
    }
    
    // 11. 检查OTP输入框是否可见
    console.log('\n[8] 检查OTP输入框是否可见...');
    try {
      const otpInput = page.locator('#ch-auth-app-code-input');
      await otpInput.waitFor({ timeout: 5000 });
      console.log('   ✅ OTP输入框可见');
      
      // 检查是否可以聚焦
      await otpInput.click();
      console.log('   ✅ OTP输入框可以聚焦');
    } catch (error) {
      console.log(`   ❌ OTP输入框不可用: ${error.message}`);
    }
    
    // 12. 检查提交按钮
    console.log('\n[9] 检查提交按钮是否可见...');
    try {
      const submitButton = page.locator('#ch-auth-app-submit');
      await submitButton.waitFor({ timeout: 5000 });
      const isVisible = await submitButton.isVisible();
      console.log(`   ✅ 提交按钮可见: ${isVisible}`);
      
      // 检查按钮位置
      const box = await submitButton.boundingBox();
      if (box) {
        console.log(`   按钮位置: x=${box.x}, y=${box.y}, 可视区域内: ${box.y < 800}`);
      }
    } catch (error) {
      console.log(`   ❌ 提交按钮不可用: ${error.message}`);
    }
    
    console.log('\n========== 测试完成 ==========');
    console.log('\n📝 测试总结:');
    console.log('1. 如果所有步骤都显示 ✅，说明2FA验证流程可以正常工作');
    console.log('2. 如果有 ❌ 或 ⚠️，请根据错误信息调整代码中的选择器');
    console.log('3. 浏览器保持打开状态，您可以手动检查页面');
    console.log('\n按 Ctrl+C 退出测试\n');
    
    // 保持浏览器打开，等待用户检查
    await new Promise(() => {}); // 永久等待
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error.stack);
  } finally {
    // 注意：不关闭浏览器，让用户手动检查
  }
}

// 运行测试
test2FAVerification().catch(console.error);
