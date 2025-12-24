/**
 * 邮箱验证操作类 - 负责获取和处理邮箱验证码
 */

const BaseOperations = require('./BaseOperations');
const {
  extractEmailVerificationCode: utilExtractEmailCode,
  createPollingFactory
} = require('../../refactored-backend/utils/toolUtils');

const msGraphMail = require('../msGraphMail');

class EmailVerificationOperations extends BaseOperations {
  constructor(page, config, tasklog, accountInfo, registerTime) {
    super(page, config, tasklog);
    this.accountInfo = accountInfo;
    this.registerTime = registerTime;
  }

  /**
   * 获取邮箱验证码
   */
  async getEmailVerificationCode() {
    this.tasklog({ message: '开始获取邮箱验证码', logID: 'RG-Info-Operate' });
    
    const credentials = {
      email: this.accountInfo.user,
      refreshToken: this.accountInfo.refreshToken,
      clientId: this.config.clientId
    };
    
    const workflow = createPollingFactory({ interval: 5000, maxWait: 120000 });
    
    const emailData = await workflow(async () => {
      this.tasklog({ message: '正在获取验证码邮件...', logID: 'RG-Info-Operate' });
      
      const email = await msGraphMail.getInboxLatest(credentials);
      
      if (!email) {
        throw new Error('未收到验证码邮件');
      }
      
      const receivedTime = new Date(email.receivedDateTime).getTime();
      const registerTime = this.registerTime || Date.now();
      
      if (receivedTime < registerTime) {
        throw new Error('邮件时间早于注册时间');
      }
      
      const isSenderValid = 
        email.from?.emailAddress?.address === 'account-update@amazon.com';
      const isSubjectValid = 
        email.subject?.toLowerCase().includes('one time password') ||
        email.subject?.toLowerCase().includes('verification code') ||
        email.subject?.toLowerCase().includes('verify');
      
      if (!isSenderValid || !isSubjectValid) {
        throw new Error('邮件发件人或主题不匹配');
      }
      
      return email;
    });
    
    const code = utilExtractEmailCode(emailData.body.content);
    
    if (!code) {
      throw new Error('未能从邮件中提取验证码');
    }
    
    this.tasklog({ 
      message: `成功获取验证码: ${code}`, 
      logID: 'RG-Info-Operate' 
    });
    
    return code;
  }

  /**
   * 更新注册时间（用于邮件时间过滤）
   */
  updateRegisterTime(time) {
    this.registerTime = time;
  }

  /**
   * 填写邮箱验证码
   */
  async fillEmailCode(code) {
    this.tasklog({ message: '填写邮箱验证码', logID: 'RG-Info-Operate' });
    
    const selectors = [
      'input.cvf-widget-input.cvf-widget-input-code.cvf-autofocus',
      'input[name="cvf_captcha_input"]',
      'input[placeholder*="验证码"]',
      'input[placeholder*="code"]',
      'input[type="text"][aria-label*="code"]'
    ];
    
    let inputLocator = null;
    for (const selector of selectors) {
      const element = await this.page.$(selector);
      if (element) {
        inputLocator = this.page.locator(selector).first();
        break;
      }
    }
    
    if (!inputLocator) {
      throw new Error('未找到邮箱验证码输入框');
    }
    
    await this.fillInput(inputLocator, code, {
      title: '填写邮箱验证码'
    });
  }

  /**
   * 提交邮箱验证
   */
  async submitEmailVerification() {
    this.tasklog({ message: '提交邮箱验证', logID: 'RG-Info-Operate' });
    
    const submitButton = this.page.locator('#cvf-submit-otp-button, button[type="submit"]').first();
    await this.clickElement(submitButton, {
      title: '提交邮箱验证'
    });
    
    await this.page.waitForLoadState('networkidle');
    await this.waitRandom(2000, 3000);
  }
}

module.exports = EmailVerificationOperations;
