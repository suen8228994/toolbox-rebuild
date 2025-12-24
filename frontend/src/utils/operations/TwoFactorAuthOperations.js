/**
 * 2FA操作类 - 负责两步验证相关操作
 */

const BaseOperations = require('./BaseOperations');
const {
  generateRandomDelay: utilRandomAround,
  generateTOTP: utilGenerateTOTP
} = require('../../refactored-backend/utils/toolUtils');

class TwoFactorAuthOperations extends BaseOperations {
  constructor(page, config, tasklog, accountInfo) {
    super(page, config, tasklog);
    this.accountInfo = accountInfo;
  }

  /**
   * 展开验证器应用配置
   * 1. 先尝试点击radio按钮选择"使用验证器应用"
   * 2. 再检查并展开accordion
   */
  async expandAuthenticatorApp() {
    // 步骤1：尝试点击radio按钮
    const radioSelectors = [
      'input[type="radio"][value="totp"]',
      '#auth-TOTP',
      'input[name="otpDeviceContext"][value="totp"]',
      'input[value="totp"]'
    ];
    
    let radioClicked = false;
    for (const selector of radioSelectors) {
      try {
        const radio = this.page.locator(selector).first();
        const isVisible = await radio.isVisible({ timeout: 2000 }).catch(() => false);
        
        if (isVisible) {
          this.tasklog({ message: '选择使用验证器应用', logID: 'RG-Info-Operate' });
          await radio.click();
          await this.waitRandom(1000, 1500);
          radioClicked = true;
          break;
        }
      } catch (error) {
        // 继续尝试下一个选择器
      }
    }
    
    // 步骤2：检查并展开accordion
    const box = this.page.locator('#sia-otp-accordion-totp-header');
    const boxExists = await box.count().then(c => c > 0);
    
    if (boxExists) {
      const expanded = await box.getAttribute('aria-expanded');
      
      if (expanded === 'false') {
        this.tasklog({ message: '展开验证器应用配置区域', logID: 'RG-Info-Operate' });
        await this.clickElement(box, {
          title: '桌面端，主站，展开验证器应用配置'
        });
      }
    }
  }

  /**
   * 获取2FA密钥
   */
  async get2FASecret() {
    this.tasklog({ message: '等待绑定2FA', logID: 'RG-Info-Operate' });
    
    const secretElement = this.page.locator('#sia-auth-app-formatted-secret');
    await secretElement.waitFor({ timeout: 10000 });
    
    const secretText = await secretElement.innerText();
    this.accountInfo.otpSecret = secretText.replace(/\s+/g, '');
    
    this.tasklog({ 
      message: `2FA密钥已获取: ${this.accountInfo.otpSecret.substring(0, 8)}...`, 
      logID: 'RG-Info-Operate' 
    });
  }

  /**
   * 获取稳定的TOTP码
   */
  async getStableTOTP() {
    await this.waitRandom(20000, 25000);
    
    const { remainingTime } = await utilGenerateTOTP(this.accountInfo.otpSecret);
    
    if (remainingTime < 4) {
      await this.waitRandom(5000, 7000);
    }
    
    return utilGenerateTOTP(this.accountInfo.otpSecret);
  }

  /**
   * 填写2FA验证码
   */
  async fill2FACode(code) {
    this.tasklog({ message: '填写2FA验证码', logID: 'RG-Info-Operate' });
    await this.fillInput(
      this.page.locator('#ch-auth-app-code-input'),
      code,
      { title: '桌面端，主站，填写2FA验证码' }
    );
  }

  /**
   * 提交2FA
   */
  async submit2FA() {
    this.tasklog({ message: '添加2FA', logID: 'RG-Info-Operate' });
    
    const submitButton = this.page.locator('#ch-auth-app-submit');
    await submitButton.waitFor();
    
    // 滚动到按钮位置
    await submitButton.evaluate(el => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    
    await this.waitRandom(1000, 1500);
    
    await this.clickElement(submitButton, {
      title: '桌面端，主站，添加2FA',
      waitForURL: true
    });
  }

  /**
   * 填写2FA邮件验证码
   */
  async fill2FAEmailCode(code) {
    this.tasklog({ message: '填写开启2FA邮件验证码', logID: 'RG-Info-Operate' });
    await this.fillInput(
      this.page.locator('#input-box-otp'),
      code,
      { title: '桌面端，主站，填写开启2FA邮件验证码' }
    );
  }

  /**
   * 提交两步验证最终确认
   */
  async submitTwoStepVerification() {
    const submitButton = this.page.locator('#enable-mfa-form-submit');
    await submitButton.waitFor();
    
    await submitButton.evaluate(el => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    
    await this.waitRandom(1000, 1500);
    
    const isVisible = await submitButton.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (isVisible) {
      this.tasklog({ message: '提交两步验证', logID: 'RG-Info-Operate' });
      await this.clickElement(submitButton, {
        title: '桌面端，主站，提交两步验证',
        waitForURL: true
      });
    } else {
      this.tasklog({ 
        message: '未找到两步验证提交按钮（可能已跳过该步骤）', 
        logID: 'RG-Info-Operate' 
      });
    }
  }

  /**
   * 处理2FA自动设置流程（注册时直接绑定）
   */
  async handle2FASetup() {
    try {
      this.tasklog({ message: '注册完成，开始自动2FA设置', logID: 'RG-Info-Operate' });
      
      // 展开验证器应用
      await this.expandAuthenticatorApp();
      
      // 获取2FA密钥
      await this.get2FASecret();
      this.tasklog({ message: '2FA密钥获取成功', logID: 'RG-Info-Operate' });
      
      // 生成TOTP码
      const otp = await this.getStableTOTP();
      
      // 填充和提交
      await this.fill2FACode(otp.code);
      await this.submit2FA();
      
      this.tasklog({
        message: '绑定2FA成功',
        logID: 'RG-Bind-Otp',
        account: {
          userEmail: this.accountInfo?.user,
          otpSecret: this.accountInfo?.otpSecret
        }
      });
      
      return true;
    } catch (error) {
      this.tasklog({ 
        message: `2FA设置失败: ${error.message}`, 
        logID: 'Error-2FA' 
      });
      throw error;
    }
  }

  /**
   * 处理2FA手动设置流程（登录后绑定）
   */
  async handle2FAManualSetup() {
    try {
      this.tasklog({ message: '准备手动2FA设置', logID: 'RG-Info-Operate' });
      
      // 展开验证器应用
      await this.expandAuthenticatorApp();
      
      // 获取2FA密钥
      await this.get2FASecret();
      this.tasklog({ message: '2FA密钥获取成功', logID: 'RG-Info-Operate' });
      
      // 生成TOTP码
      const otp = await this.getStableTOTP();
      
      // 填充2FA验证码
      await this.fill2FACode(otp.code);
      
      // 提交2FA
      await this.submit2FA();
      
      this.tasklog({
        message: '绑定2FA成功',
        logID: 'RG-Bind-Otp',
        account: {
          userEmail: this.accountInfo?.user,
          otpSecret: this.accountInfo?.otpSecret
        }
      });
      
      return true;
    } catch (error) {
      this.tasklog({ 
        message: `2FA手动设置失败: ${error.message}`, 
        logID: 'Error-2FA' 
      });
      throw error;
    }
  }
}

module.exports = TwoFactorAuthOperations;
