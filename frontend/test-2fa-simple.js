// 简化版2FA测试 - 直接使用containerCode启动浏览器
const { chromium } = require('playwright');
const HubStudioClient = require('./src/utils/hubstudioClient');

// 配置：手动输入您的containerCode（从HubStudio界面可以看到）
const CONTAINER_CODE = 1435278852; // 修改为您的环境code

async function testSimple() {
  console.log('\n========== 简化版2FA测试 ==========\n');
  
  const hubstudio = new HubStudioClient();
  let browser = null;
  
  try {
    // 1. 直接启动浏览器
    console.log(`[1] 启动浏览器环境 (containerCode: ${CONTAINER_CODE})...`);
    const browserInfo = await hubstudio.startBrowser({
      containerCode: CONTAINER_CODE,
      args: ['--disable-blink-features=AutomationControlled']
    });
    
    console.log(`✅ 浏览器已启动，调试端口: ${browserInfo.debuggingPort}\n`);
    
    // 2. 连接到浏览器
    console.log('[2] 连接Playwright到浏览器...');
    const wsEndpoint = `http://127.0.0.1:${browserInfo.debuggingPort}`;
    const response = await fetch(`${wsEndpoint}/json/version`);
    const versionData = await response.json();
    
    browser = await chromium.connectOverCDP(versionData.webSocketDebuggerUrl);
    const context = browser.contexts()[0];
    const page = context.pages()[0] || await context.newPage();
    
    console.log('✅ Playwright已连接\n');
    
    // 3. 导航到Amazon
    console.log('[3] 导航到Amazon首页...');
    await page.goto('https://www.amazon.com', { timeout: 60000 });
    await page.waitForTimeout(2000);
    console.log('✅ 已到达首页\n');
    
    // 4. 打开个人中心
    console.log('[4] 打开个人中心...');
    await page.locator('a[data-nav-role="signin"]').first().click();
    await page.waitForTimeout(2000);
    console.log('✅ 已打开\n');
    
    // 5. 打开登录与安全
    console.log('[5] 打开登录与安全...');
    await page.locator('a[href*="ap/cnep"]').first().click();
    await page.waitForLoadState('load');
    await page.waitForTimeout(2000);
    console.log('✅ 已进入\n');
    
    // 6. 打开两步验证
    console.log('[6] 打开两步验证设置...');
    await page.locator('a[href*="/a/settings/approval/setup/register?"]').click();
    await page.waitForLoadState('load');
    await page.waitForTimeout(3000);
    console.log('✅ 已进入两步验证页面\n');
    
    // 7. 测试点击单选按钮
    console.log('========== 开始测试选择验证器应用 ==========\n');
    
    const selectors = [
      'input[type="radio"][value="totp"]',
      '#auth-TOTP',
      'input[name="otpDeviceContext"][value="totp"]',
      'input[value="totp"]'
    ];
    
    let found = false;
    for (const selector of selectors) {
      try {
        const radio = page.locator(selector).first();
        const count = await radio.count();
        console.log(`[测试] 选择器 "${selector}": ${count > 0 ? '✅ 找到' : '❌ 未找到'}`);
        
        if (count > 0 && !found) {
          console.log(`   → 尝试点击...`);
          await radio.click();
          await page.waitForTimeout(1500);
          found = true;
          console.log(`   ✅ 点击成功！\n`);
        }
      } catch (error) {
        console.log(`[测试] 选择器 "${selector}": ❌ 错误 - ${error.message}`);
      }
    }
    
    if (!found) {
      console.log('\n⚠️  所有单选按钮选择器都未找到\n');
    }
    
    // 8. 检查accordion
    console.log('[7] 检查accordion展开状态...');
    try {
      const accordion = page.locator('#sia-otp-accordion-totp-header');
      const count = await accordion.count();
      
      if (count > 0) {
        const expanded = await accordion.getAttribute('aria-expanded');
        console.log(`   Accordion存在，状态: ${expanded}`);
        
        if (expanded === 'false') {
          console.log('   → 尝试展开...');
          await accordion.click();
          await page.waitForTimeout(1500);
          console.log('   ✅ 已展开\n');
        } else {
          console.log('   ✅ 已经是展开状态\n');
        }
      } else {
        console.log('   ℹ️  未找到accordion（页面可能不需要）\n');
      }
    } catch (error) {
      console.log(`   ❌ 错误: ${error.message}\n`);
    }
    
    // 9. 检查2FA密钥
    console.log('[8] 检查2FA密钥元素...');
    try {
      const secretElement = page.locator('#sia-auth-app-formatted-secret');
      await secretElement.waitFor({ timeout: 5000 });
      const secretText = await secretElement.innerText();
      console.log(`   ✅ 找到密钥: ${secretText.substring(0, 15)}...\n`);
    } catch (error) {
      console.log(`   ❌ 未找到密钥: ${error.message}\n`);
    }
    
    // 10. 测试OTP输入框
    console.log('========== 测试OTP输入框 ==========\n');
    
    const otpSelectors = [
      '#ch-auth-app-code-input',
      'input[name="otpCode"]',
      'input[type="tel"]',
      'input[autocomplete="one-time-code"]'
    ];
    
    let otpFound = false;
    for (const selector of otpSelectors) {
      try {
        const input = page.locator(selector).first();
        const count = await input.count();
        console.log(`[测试] OTP选择器 "${selector}": ${count > 0 ? '✅ 找到' : '❌ 未找到'}`);
        
        if (count > 0 && !otpFound) {
          const isVisible = await input.isVisible();
          console.log(`   → 可见性: ${isVisible ? '✅ 可见' : '❌ 不可见'}`);
          
          if (isVisible) {
            await input.click();
            console.log(`   ✅ 可以聚焦\n`);
            otpFound = true;
          }
        }
      } catch (error) {
        console.log(`[测试] OTP选择器 "${selector}": ❌ 错误 - ${error.message}`);
      }
    }
    
    if (!otpFound) {
      console.log('\n⚠️  所有OTP输入框选择器都未找到或不可见\n');
    }
    
    // 11. 检查提交按钮
    console.log('[9] 检查提交按钮...');
    try {
      const submitButton = page.locator('#ch-auth-app-submit');
      await submitButton.waitFor({ timeout: 5000 });
      const isVisible = await submitButton.isVisible();
      console.log(`   ✅ 提交按钮可见: ${isVisible}`);
      
      const box = await submitButton.boundingBox();
      if (box) {
        console.log(`   位置: y=${Math.round(box.y)} (${box.y < 800 ? '在可视区域内' : '需要滚动'})\n`);
      }
    } catch (error) {
      console.log(`   ❌ 提交按钮: ${error.message}\n`);
    }
    
    console.log('========== 测试完成 ==========\n');
    console.log('💡 提示：');
    console.log('   - 浏览器保持打开，您可以手动检查');
    console.log('   - 按 Ctrl+C 退出测试');
    console.log('   - 根据上面的输出查看哪些元素找到/未找到\n');
    
    // 保持运行
    await new Promise(() => {});
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error.stack);
  }
}

testSimple().catch(console.error);
