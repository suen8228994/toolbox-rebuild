/**
 * 单元测试 - NavigationOperations
 * 测试页面导航功能
 */

const { chromium } = require('playwright');

async function testNavigationOperations() {
  console.log('========== 测试 NavigationOperations ==========\n');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Mock tasklog
  const logs = [];
  const tasklog = (data) => {
    logs.push(data);
    console.log(`[LOG] ${data.message}`);
  };
  
  const NavigationOperations = require('../src/utils/operations/NavigationOperations');
  const nav = new NavigationOperations(page, {}, tasklog);
  
  try {
    // 测试1: 选择语言
    console.log('[测试1] 选择语言...');
    await page.goto('https://www.amazon.com');
    await nav.selectLanguage();
    console.log('✅ 选择语言成功\n');
    
    // 测试2: 进入卖家注册页面
    console.log('[测试2] 进入卖家注册页面...');
    await nav.goToSellRegister();
    const currentUrl = page.url();
    if (currentUrl.includes('sell.amazon.com')) {
      console.log('✅ 成功进入卖家注册页面\n');
    } else {
      console.log(`❌ URL不匹配: ${currentUrl}\n`);
    }
    
    // 测试3: 点击Logo返回
    console.log('[测试3] 点击Logo返回首页...');
    await page.goto('https://www.amazon.com');
    await nav.goToNavLogo();
    console.log('✅ Logo点击成功\n');
    
    console.log('========== NavigationOperations 测试完成 ==========\n');
    console.log(`总共产生日志: ${logs.length} 条`);
    
  } catch (error) {
    console.error(`❌ 测试失败: ${error.message}`);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

async function testNavigationToPersonalCenter() {
  console.log('========== 测试 导航到个人中心 (需要登录) ==========\n');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const logs = [];
  const tasklog = (data) => {
    logs.push(data);
    console.log(`[LOG] ${data.message}`);
  };
  
  const NavigationOperations = require('../src/utils/operations/NavigationOperations');
  const nav = new NavigationOperations(page, {}, tasklog);
  
  try {
    console.log('请先手动登录Amazon账号...');
    await page.goto('https://www.amazon.com');
    
    // 等待用户手动登录
    console.log('等待30秒，请在此期间完成登录...');
    await page.waitForTimeout(30000);
    
    // 测试导航到个人中心
    console.log('[测试] 打开个人中心...');
    await nav.goToHomepage();
    await page.waitForTimeout(2000);
    console.log('✅ 打开个人中心成功\n');
    
    // 测试打开登录与安全
    console.log('[测试] 打开登录与安全...');
    await nav.goToLoginSecurity();
    await page.waitForTimeout(2000);
    console.log('✅ 打开登录与安全成功\n');
    
    console.log('========== 导航测试完成 ==========\n');
    
  } catch (error) {
    console.error(`❌ 测试失败: ${error.message}`);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

// 运行测试
if (require.main === module) {
  const testType = process.argv[2] || 'basic';
  
  if (testType === 'full') {
    testNavigationToPersonalCenter();
  } else {
    testNavigationOperations();
  }
}

module.exports = { testNavigationOperations, testNavigationToPersonalCenter };
