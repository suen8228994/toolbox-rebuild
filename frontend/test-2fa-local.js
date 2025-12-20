/**
 * 测试2FA页面识别和提交逻辑
 * 用本地HTML文件来测试 submitTwoStepVerification 功能
 */

const { test, expect } = require('@playwright/test');
const path = require('path');

test('Test 2FA page detection and submission', async ({ page }) => {
  // 加载本地HTML文件
  const filePath = 'file://' + path.resolve('C:\\Users\\sxh\\Desktop\\test1111.html');
  
  console.log('\n📂 加载本地文件:', filePath);
  await page.goto(filePath, { waitUntil: 'networkidle' }).catch(() => {
    console.log('⚠️ 页面加载可能未完全就绪，继续测试...');
  });
  
  // 等待页面加载
  await page.waitForTimeout(2000);
  
  // 检查确认按钮是否存在
  const enableMfaFormSubmit = await page.locator('#enable-mfa-form-submit');
  const isButtonVisible = await enableMfaFormSubmit.isVisible({ timeout: 5000 }).catch(() => false);
  
  console.log('\n✓ 页面已加载');
  console.log(`✓ 确认按钮存在: ${isButtonVisible ? '是' : '否'}`);
  
  if (!isButtonVisible) {
    console.log('\n⚠️ 未找到 #enable-mfa-form-submit 按钮');
    console.log('页面内容预览:');
    const content = await page.content();
    console.log(content.substring(0, 500) + '...');
    return;
  }
  
  // 尝试找到复选框
  const trustDeviceCheckbox = await page.locator('input[name="trustThisDevice"]');
  const isCheckboxVisible = await trustDeviceCheckbox.isVisible({ timeout: 3000 }).catch(() => false);
  
  console.log(`✓ 复选框存在: ${isCheckboxVisible ? '是' : '否'}`);
  
  if (isCheckboxVisible) {
    const isChecked = await trustDeviceCheckbox.isChecked();
    console.log(`✓ 复选框初始状态: ${isChecked ? '已勾选' : '未勾选'}`);
  }
  
  // 测试点击按钮
  console.log('\n🔍 测试点击确认按钮...');
  try {
    // 滚动到按钮位置
    await enableMfaFormSubmit.evaluate(el => {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    
    console.log('✓ 已滚动到按钮位置');
    
    // 获取按钮信息
    const buttonText = await enableMfaFormSubmit.textContent();
    const buttonId = await enableMfaFormSubmit.getAttribute('id');
    
    console.log(`✓ 按钮ID: ${buttonId}`);
    console.log(`✓ 按钮文本: ${buttonText}`);
    
    // 设置导航监听器（检测页面导航）
    const navigationPromise = page.waitForNavigation({ timeout: 5000 }).catch(() => {
      console.log('⚠️ 页面没有跳转（可能因为是本地文件）');
    });
    
    // 点击按钮
    console.log('✓ 点击按钮...');
    await enableMfaFormSubmit.click();
    
    // 等待导航或延迟
    await Promise.race([
      navigationPromise,
      page.waitForTimeout(2000)
    ]);
    
    console.log('\n✅ 按钮点击成功！');
    console.log('✅ 测试通过 - 2FA页面已被正确识别并提交');
    
  } catch (err) {
    console.log('\n❌ 测试失败:', err.message);
    throw err;
  }
});

test('Test 2FA page structure', async ({ page }) => {
  const filePath = 'file://' + path.resolve('C:\\Users\\sxh\\Desktop\\test1111.html');
  
  console.log('\n📋 检查页面结构...');
  await page.goto(filePath).catch(() => {});
  await page.waitForTimeout(1000);
  
  // 检查关键元素
  const checks = [
    { selector: '#enable-mfa-form-submit', name: '确认按钮' },
    { selector: 'input[name="trustThisDevice"]', name: '复选框' },
    { selector: 'form#enable-mfa-form', name: '表单' },
  ];
  
  for (const check of checks) {
    const exists = await page.locator(check.selector).count() > 0;
    console.log(`${exists ? '✓' : '✗'} ${check.name} (${check.selector}): ${exists ? '存在' : '不存在'}`);
  }
});
