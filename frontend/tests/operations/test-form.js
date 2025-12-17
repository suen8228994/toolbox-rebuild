/**
 * 单元测试 - FormOperations
 * 测试表单填写功能
 */

const { chromium } = require('playwright');

async function testFormOperations() {
  console.log('========== 测试 FormOperations ==========\n');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const logs = [];
  const tasklog = (data) => {
    logs.push(data);
    console.log(`[LOG] ${data.message}`);
  };
  
  const FormOperations = require('../src/utils/operations/FormOperations');
  const form = new FormOperations(page, {}, tasklog);
  
  try {
    // 测试1: 导航到注册页面
    console.log('[测试1] 导航到卖家注册页面...');
    await page.goto('https://sell.amazon.com/sell');
    await page.waitForLoadState('load');
    console.log('✅ 页面加载完成\n');
    
    // 测试2: 点击Sign Up
    console.log('[测试2] 查找Sign Up按钮...');
    const signUpButton = page.locator('a[data-test-id="sign-up-button"]').first();
    const buttonExists = await signUpButton.count() > 0;
    if (buttonExists) {
      console.log('✅ 找到Sign Up按钮\n');
      // await form.clickSignUp(); // 实际点击会跳转，这里只检查
    } else {
      console.log('❌ 未找到Sign Up按钮\n');
    }
    
    // 测试3: 检查表单元素
    console.log('[测试3] 导航到创建账号页面...');
    await page.goto('https://www.amazon.com/ap/register');
    await page.waitForLoadState('load');
    
    const elements = {
      username: await page.locator('#ap_customer_name').count() > 0,
      email: await page.locator('#ap_email').count() > 0,
      password: await page.locator('#ap_password').count() > 0,
      passwordConfirm: await page.locator('#ap_password_check').count() > 0,
      submit: await page.locator('#continue').count() > 0
    };
    
    console.log('表单元素检查:');
    console.log(`  用户名输入框: ${elements.username ? '✅' : '❌'}`);
    console.log(`  邮箱输入框: ${elements.email ? '✅' : '❌'}`);
    console.log(`  密码输入框: ${elements.password ? '✅' : '❌'}`);
    console.log(`  确认密码输入框: ${elements.passwordConfirm ? '✅' : '❌'}`);
    console.log(`  提交按钮: ${elements.submit ? '✅' : '❌'}`);
    console.log();
    
    // 测试4: 填写表单（不提交）
    console.log('[测试4] 测试表单填写（不提交）...');
    await form.fillUsername('Test User');
    await page.waitForTimeout(500);
    console.log('✅ 用户名填写成功');
    
    await form.fillEmail('test@example.com');
    await page.waitForTimeout(500);
    console.log('✅ 邮箱填写成功');
    
    await form.fillPassword('TestPass123');
    await page.waitForTimeout(500);
    console.log('✅ 密码填写成功');
    
    await form.fillPasswordConfirm('TestPass123');
    await page.waitForTimeout(500);
    console.log('✅ 确认密码填写成功\n');
    
    console.log('[提示] 表单已填写完成，可以手动检查内容是否正确');
    console.log('[提示] 按Ctrl+C退出测试\n');
    
    await page.waitForTimeout(10000);
    
    console.log('========== FormOperations 测试完成 ==========\n');
    console.log(`总共产生日志: ${logs.length} 条`);
    
  } catch (error) {
    console.error(`❌ 测试失败: ${error.message}`);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

// 运行测试
if (require.main === module) {
  testFormOperations();
}

module.exports = { testFormOperations };
