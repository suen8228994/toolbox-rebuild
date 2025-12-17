/**
 * 表单操作类 - 负责各种表单填写
 */

const BaseOperations = require('./BaseOperations');

class FormOperations extends BaseOperations {
  /**
   * 点击Sign Up按钮
   */
  async clickSignUp() {
    this.tasklog({ message: '点击Sign Up', logID: 'RG-Info-Operate' });
    
    const signUpButton = this.page.locator('a[data-test-id="sign-up-button"]').first();
    await this.clickElement(signUpButton, {
      title: '桌面端，卖家中心，点击Sign Up',
      waitForURL: true
    });
  }

  /**
   * 点击Create Account
   */
  async clickCreateAccount() {
    this.tasklog({ message: '点击创建账号', logID: 'RG-Info-Operate' });
    
    const createButton = this.page.locator('#createAccountSubmit').first();
    await this.clickElement(createButton, {
      title: '桌面端，卖家中心，点击创建账号',
      waitForURL: true
    });
  }

  /**
   * 填写用户名
   */
  async fillUsername(name) {
    this.tasklog({ message: '填写用户名', logID: 'RG-Info-Operate' });
    await this.fillInput(
      this.page.locator('#ap_customer_name'),
      name,
      { title: '桌面端，卖家中心，填写用户名' }
    );
  }

  /**
   * 填写邮箱
   */
  async fillEmail(email) {
    this.tasklog({ message: '填写邮箱', logID: 'RG-Info-Operate' });
    await this.fillInput(
      this.page.locator('#ap_email'),
      email,
      { title: '桌面端，卖家中心，填写邮箱' }
    );
  }

  /**
   * 填写密码
   */
  async fillPassword(password) {
    this.tasklog({ message: '填写密码', logID: 'RG-Info-Operate' });
    await this.fillInput(
      this.page.locator('#ap_password'),
      password,
      { title: '桌面端，卖家中心，填写密码' }
    );
  }

  /**
   * 填写确认密码
   */
  async fillPasswordConfirm(password) {
    this.tasklog({ message: '填写确认密码', logID: 'RG-Info-Operate' });
    await this.fillInput(
      this.page.locator('#ap_password_check'),
      password,
      { title: '桌面端，卖家中心，填写确认密码' }
    );
  }

  /**
   * 提交注册表单
   */
  async submitRegistration() {
    this.tasklog({ message: '提交注册表单', logID: 'RG-Info-Operate' });
    
    const submitButton = this.page.locator('#continue').first();
    await this.clickElement(submitButton, {
      title: '桌面端，卖家中心，提交注册',
      waitForURL: true
    });
    
    await this.waitRandom(3000, 5000);
  }

  /**
   * 填写邮箱验证码
   */
  async fillEmailCode(code) {
    this.tasklog({ message: '填写邮箱验证码', logID: 'RG-Info-Operate' });
    
    await this.page.waitForTimeout(3000);
    
    await this.fillInput(
      this.page.locator('#cvf-input-code'),
      code,
      { title: '桌面端，卖家中心，填写邮箱验证码' }
    );
  }

  /**
   * 提交邮箱验证
   */
  async submitEmailVerification(waitUntil = 'networkidle') {
    this.tasklog({ message: '提交邮箱验证码', logID: 'RG-Info-Operate' });
    
    const submitButton = this.page.locator('#continue');
    await this.clickElement(submitButton, { title: '提交邮箱验证码' });
    
    await this.page.waitForLoadState(waitUntil);
    await this.waitRandom(2000, 3000);
  }
}

module.exports = FormOperations;
