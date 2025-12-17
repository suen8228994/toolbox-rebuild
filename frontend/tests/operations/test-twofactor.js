/**
 * 单元测试 - TwoFactorAuthOperations
 * 测试2FA功能
 */

const { chromium } = require('playwright');

async function testTwoFactorAuthOperations() {
  console.log('========== 测试 TwoFactorAuthOperations ==========\n');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const logs = [];
  const tasklog = (data) => {
    logs.push(data);
    console.log(`[LOG] ${data.message}`);
  };
  
  const accountInfo = {
    user: 'test@example.com',
    pass: 'TestPass123',
    otpSecret: null
  };
  
  const TwoFactorAuthOperations = require('../src/utils/operations/TwoFactorAuthOperations');
  const twoFA = new TwoFactorAuthOperations(page, {}, tasklog, accountInfo);
  
  try {
    console.log('[说明] 此测试需要手动导航到2FA设置页面');
    console.log('[说明] URL应该包含 "/a/settings/approval/setup/register?"\n');
    
    console.log('请先手动登录并导航到2FA设置页面...');
    console.log('等待30秒...');
    await page.goto('https://www.amazon.com');
    await page.waitForTimeout(30000);
    
    // 测试1: 展开Authenticator App
    console.log('[测试1] 展开Authenticator App配置...');
    await twoFA.expandAuthenticatorApp();
    await page.waitForTimeout(2000);
    console.log('✅ 展开成功\n');
    
    // 测试2: 获取2FA密钥
    console.log('[测试2] 获取2FA密钥...');
    try {
      await twoFA.get2FASecret();
      console.log(`✅ 密钥已获取: ${accountInfo.otpSecret?.substring(0, 8)}...`);
      console.log(`完整密钥长度: ${accountInfo.otpSecret?.length}\n`);
    } catch (error) {
      console.log(`❌ 密钥获取失败: ${error.message}\n`);
    }
    
    // 测试3: 生成TOTP
    if (accountInfo.otpSecret) {
      console.log('[测试3] 生成TOTP验证码...');
      const otp = await twoFA.getStableTOTP();
      console.log(`✅ TOTP: ${otp.code}`);
      console.log(`剩余时间: ${otp.remainingTime}秒\n`);
      
      // 测试4: 填写2FA验证码
      console.log('[测试4] 填写2FA验证码...');
      await twoFA.fill2FACode(otp.code);
      console.log('✅ 验证码填写成功\n');
      
      console.log('[提示] 可以手动点击提交按钮验证是否正确');
    }
    
    console.log('========== TwoFactorAuthOperations 测试完成 ==========\n');
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
  testTwoFactorAuthOperations();
}

module.exports = { testTwoFactorAuthOperations };
