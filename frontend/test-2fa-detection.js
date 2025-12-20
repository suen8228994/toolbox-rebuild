/**
 * 测试2FA页面识别 - 简单版本
 */

const { chromium } = require('playwright');
const path = require('path');

async function test2FAPage() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // 加载本地HTML文件
    const filePath = 'file://' + path.resolve('C:\\Users\\sxh\\Desktop\\test1111.html');
    
    console.log('\n📂 加载本地文件...');
    await page.goto(filePath, { waitUntil: 'networkidle' }).catch(() => {
      console.log('⚠️ 页面加载完成（可能有网络资源加载失败）');
    });
    
    // 等待页面稳定
    await page.waitForTimeout(2000);
    
    console.log('\n🔍 开始检查页面元素...\n');
    
    // 检查确认按钮
    const enableMfaFormSubmit = page.locator('#enable-mfa-form-submit');
    const isButtonVisible = await enableMfaFormSubmit.isVisible({ timeout: 5000 }).catch(() => false);
    
    console.log(`[1] 确认按钮 (#enable-mfa-form-submit): ${isButtonVisible ? '✅ 存在' : '❌ 不存在'}`);
    
    if (!isButtonVisible) {
      console.log('\n⚠️ 未找到确认按钮，显示页面内容片段:');
      const content = await page.content();
      const matches = content.match(/id="[^"]*form[^"]*"/gi) || [];
      console.log('找到的form相关ID:', matches.slice(0, 5).join(', '));
      return;
    }
    
    // 检查复选框
    const trustDeviceCheckbox = page.locator('input[name="trustThisDevice"]');
    const isCheckboxVisible = await trustDeviceCheckbox.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`[2] 复选框 (input[name="trustThisDevice"]): ${isCheckboxVisible ? '✅ 存在' : '⚠️ 不存在'}`);
    
    if (isCheckboxVisible) {
      const isChecked = await trustDeviceCheckbox.isChecked();
      console.log(`    初始状态: ${isChecked ? '已勾选' : '未勾选'}`);
    }
    
    // 检查表单
    const formExists = await page.locator('form#enable-mfa-form').isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`[3] 表单 (form#enable-mfa-form): ${formExists ? '✅ 存在' : '⚠️ 不存在'}`);
    
    // 测试按钮点击
    console.log('\n📍 测试按钮点击流程...\n');
    
    // 获取按钮属性
    const buttonText = await enableMfaFormSubmit.textContent();
    const buttonType = await enableMfaFormSubmit.getAttribute('type');
    console.log(`[4] 按钮文本: "${buttonText}"`);
    console.log(`[5] 按钮类型: ${buttonType || 'submit(默认)'}`);
    
    // 滚动到按钮
    await enableMfaFormSubmit.evaluate(el => {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    console.log(`[6] ✅ 已滚动到按钮位置`);
    
    // 点击按钮
    console.log(`[7] 准备点击按钮...`);
    
    // 监听导航事件
    const navigationPromise = page.waitForNavigation({ timeout: 3000 }).catch(() => null);
    
    await enableMfaFormSubmit.click();
    console.log(`[8] ✅ 按钮点击完成`);
    
    // 等待导航或超时
    const navResult = await navigationPromise;
    if (navResult) {
      console.log(`[9] ✅ 页面已跳转到: ${page.url()}`);
    } else {
      console.log(`[9] ⚠️ 页面未跳转（本地文件预期行为）`);
      console.log(`    当前URL: ${page.url()}`);
    }
    
    console.log('\n✅✅✅ 测试通过！2FA页面已正确识别和处理 ✅✅✅\n');
    
  } catch (err) {
    console.log('\n❌ 测试失败:', err.message);
    console.log(err.stack);
  } finally {
    await browser.close();
  }
}

// 运行测试
console.log('====================================');
console.log('   2FA页面识别测试');
console.log('====================================');

test2FAPage().catch(console.error);
