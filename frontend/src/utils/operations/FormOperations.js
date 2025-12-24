/**
 * 表单操作类 - 负责各种表单填写
 */

const BaseOperations = require('./BaseOperations');

const {
  scrollDownAndUp,
  humanClickLocator,
  humanTypeLocator
} = require('../pageUtils');
const {
  generateRandomDelay: utilRandomAround
} = require('../../refactored-backend/utils/toolUtils');
class FormOperations extends BaseOperations {
  /**
   * 点击Sign Up按钮
   */
  async clickSignUp() {
    this.tasklog({ message: '准备注册', logID: 'RG-Info-Operate' });
    // 模拟人类浏览行为
    await scrollDownAndUp(this.page);
    await this.page.waitForTimeout(utilRandomAround(5000, 7500));
    
    return this.clickElement(
      this.page
        .locator('.button.button-type-primary.font-size-xlarge.button-focus-default')
        .first(),
      {
        title: '桌面端，主站，准备注册',
        waitForURL: true
      }
    );
  }

  /**
   * 点击Create Account
   */
  async clickCreateAccount() {
    this.tasklog({ message: '创建账户', logID: 'RG-Info-Operate' });
    return this.clickElement(this.page.locator('#createAccountSubmit'), {
      title: '桌面端，主站，创建账户',
      waitForURL: true,
      waitUntil: 'networkidle'
    });
  }

  /**
   * 填写用户名
   */
  async fillUsername(name) {
    this.tasklog({ message: '输入用户名', logID: 'RG-Info-Operate' });
    const options = arguments[1] || {};
    const el = this.page.locator('#ap_customer_name');
    await this.page.waitForTimeout(utilRandomAround(500, 1000));
    await this.fillInput(el, name, Object.assign({}, options, { slowType: true, minDelayMs: 50, maxDelayMs: 300 }));
    await this.page.waitForTimeout(utilRandomAround(2000, 3000));
    return;
  }

  /**
   * 填写邮箱
   */
  async fillEmail(email) {
    this.tasklog({ message: '输入邮箱', logID: 'RG-Info-Operate' });
    const options = arguments[1] || {};
    const el = this.page.locator('#ap_email');
    await this.page.waitForTimeout(utilRandomAround(500, 1000));
    await this.fillInput(el, email, Object.assign({}, options, { slowType: true, minDelayMs: 50, maxDelayMs: 300 }));
    await this.page.waitForTimeout(utilRandomAround(1000, 3000));
    return;
  }

  /**
   * 填写密码
   */
  async fillPassword(password) {
    this.tasklog({ message: '输入密码', logID: 'RG-Info-Operate' });
    const options = arguments[1] || {};
    const el = this.page.locator('#ap_password');
    await this.page.waitForTimeout(utilRandomAround(500, 1000));
    await this.fillInput(el, password, Object.assign({}, options, { slowType: true, minDelayMs: 50, maxDelayMs: 300 }));
    await this.page.waitForTimeout(utilRandomAround(500, 1500));
    return;
  }

  async fillPasswordConfirm(password) {
    this.tasklog({ message: '再次确定密码', logID: 'RG-Info-Operate' });
    const options = arguments[1] || {};
    const el = this.page.locator('#ap_password_check');
    await this.page.waitForTimeout(utilRandomAround(500, 1000));
    await this.fillInput(el, password, Object.assign({}, options, { slowType: true, minDelayMs: 50, maxDelayMs: 300 }));
    await this.page.waitForTimeout(utilRandomAround(500, 1500));
    return;
  }

  /**
   * 提交注册表单
   */
  async submitRegistration() {
    this.tasklog({ message: '提交注册', logID: 'RG-Info-Operate' });
    // 提交前模拟向下滚动查看表单
    await this.page.mouse.move(
      200 + Math.random() * 300,
      300 + Math.random() * 200,
      { steps: 10 }
    );
    await this.page.mouse.wheel(0, 400 + Math.random() * 200);
    await this.page.waitForTimeout(800 + Math.random() * 800);
    
    return this.clickElement(this.page.locator('#continue'), {
      title: '桌面端，主站，提交注册',
      waitForURL: true
    });
  }

  /**
   * 填写邮箱验证码
   */
  async fillEmailCode(code) {
    this.tasklog({ message: '填写邮箱验证码', logID: 'RG-Info-Operate' });
    return this.fillInput(
      this.page
        .locator('input.cvf-widget-input.cvf-widget-input-code.cvf-autofocus')
        .first(),
      code,
      {
        title: '桌面端，主站，填写邮箱验证码',
        preDelay: utilRandomAround(1000, 2000),
        postDelay: utilRandomAround(2000, 2500)
      }
    );
  }

  /**
   * 提交邮箱验证
   */
  async submitEmailVerification(waitUntil = 'networkidle') {
    this.tasklog({ message: '确定添加邮箱', logID: 'RG-Info-Operate' });
    return this.clickElement(this.page.locator('#cvf-submit-otp-button'), {
      title: '桌面端，主站，确定添加邮箱',
      waitForURL: true,
      waitUntil
    });
  }

  /**
   * 一次性填写所有注册字段
   */
    async fillRegistrationFields(username, email, password) {
    // fields in order
    const fields = [
      { fn: this.fillUsername.bind(this), args: [username] },
      { fn: this.fillEmail.bind(this), args: [email] },
      { fn: this.fillPassword.bind(this), args: [password] },
      { fn: this.fillPasswordConfirm.bind(this), args: [password] }
    ];

    // 随机选择一个索引用于强制删除重填
    const idx = Math.floor(Math.random() * fields.length);

    for (let i = 0; i < fields.length; i++) {
      const item = fields[i];
      const opts = (i === idx) ? { forceDeleteRetype: true } : {};
      await item.fn(...item.args, opts);
    }
  }

  /**
   * 跳过电话验证
   */
  async skipPhoneVerification() {
    try {
      this.tasklog({ message: '尝试跳过手机验证...', logID: 'RG-Info-Operate' });
      
      // 查找"稍后"或"Not now"按钮
      const skipButton = this.page.locator('a[id*="ap-account-fixup-phone-skip-link"]').first();
      const skipButtonExists = await skipButton.count().then(c => c > 0);
      
      if (skipButtonExists) {
        this.tasklog({ message: '找到"稍后"按钮，点击跳过手机验证', logID: 'RG-Info-Operate' });
        await this.clickElement(skipButton, {
          title: '桌面端，主站，跳过手机验证',
          waitForURL: true
        });
        this.tasklog({ message: '已跳过手机验证', logID: 'RG-Info-Operate' });
        return true;
      }
      
      // 如果没找到"稍后"按钮，尝试查找其他取消类按钮
      const cancelLink = this.page.locator('a').filter({ hasText: /Not now|稍后|Skip|取消/ }).first();
      const cancelExists = await cancelLink.count().then(c => c > 0);
      
      if (cancelExists) {
        this.tasklog({ message: '找到取消按钮，点击跳过', logID: 'RG-Info-Operate' });
        await this.clickElement(cancelLink, {
          title: '桌面端，主站，跳过手机验证',
          waitForURL: true
        });
        this.tasklog({ message: '已跳过手机验证', logID: 'RG-Info-Operate' });
        return true;
      }
      
      this.tasklog({ message: '未找到跳过按钮，可能已经不在手机验证页面', logID: 'Warn-Info' });
      return false;
    } catch (error) {
      this.tasklog({ message: `跳过手机验证失败: ${error.message}`, logID: 'Warn-Info' });
      return false;
    }
  }

  /**
   * 跳过Two-Step Verification页面
   */
  async skipTwoStepVerification() {
    try {
      this.tasklog({ message: '尝试跳过Two-Step Verification...', logID: 'RG-Info-Operate' });
      
      // Two-Step Verification页面通常有Cancel按钮
      const cancelButton = this.page.locator('a[href*="ap/return"]').filter({ hasText: /Cancel|取消|Abbrechen/ }).first();
      const cancelExists = await cancelButton.count().then(c => c > 0);
      
      if (cancelExists) {
        this.tasklog({ message: '找到Cancel按钮，点击跳过Two-Step Verification', logID: 'RG-Info-Operate' });
        await this.clickElement(cancelButton, {
          title: 'Two-Step Verification，点击Cancel',
          waitForURL: true
        });
        this.tasklog({ message: '已跳过Two-Step Verification', logID: 'RG-Info-Operate' });
        return true;
      }
      
      // 尝试查找其他跳过类按钮
      const skipLink = this.page.locator('a').filter({ hasText: /Skip|Not now|稍后|跳过/ }).first();
      const skipExists = await skipLink.count().then(c => c > 0);
      
      if (skipExists) {
        this.tasklog({ message: '找到跳过按钮，点击', logID: 'RG-Info-Operate' });
        await this.clickElement(skipLink, {
          title: 'Two-Step Verification，点击跳过',
          waitForURL: true
        });
        this.tasklog({ message: '已跳过Two-Step Verification', logID: 'RG-Info-Operate' });
        return true;
      }
      
      this.tasklog({ message: '未找到跳过按钮，尝试直接导航到首页', logID: 'Warn-Info' });
      return false;
    } catch (error) {
      this.tasklog({ message: `跳过Two-Step Verification失败: ${error.message}`, logID: 'Warn-Info' });
      return false;
    }
  }

  /**
   * 重试注册流程
   * 当检测到强制电话验证时使用
   */
  async retryRegistration() {
    this.tasklog({ message: '需要绑定手机，尝试重新注册', logID: 'Warn-Info' });
    await this.page.waitForTimeout(utilRandomAround(1000, 1500));
    
    // Navigate back to registration page
    while (!this.page.url().includes('/ap/register?')) {
      await this.page.goBack();
      await this.page.waitForTimeout(utilRandomAround(1000, 1500));
    }
    
    await this.fillPassword(this.accountInfo.password);
    await this.fillPasswordConfirm(this.accountInfo.password);
    
    this.registerTime = Date.now();
    await this.submitRegistration();
    
    if (await this.checkCaptcha()) {
      await this.solveCaptcha();
    }
    
    const code = await this.getEmailVerificationCode();
    await this.fillEmailCode(code);
    await this.submitEmailVerification();
  }

  /**
   * 记录注册成功
   * 在注册完成时调用，等待2FA绑定
   */
  logRegistrationSuccess() {
    this.tasklog({
      message: '注册成功，等待绑定2FA',
      logID: 'RG-Success',
      account: {
        userEmail: this.accountInfo.user,
        password: this.accountInfo.password
      }
    });
  }
}

module.exports = FormOperations;
