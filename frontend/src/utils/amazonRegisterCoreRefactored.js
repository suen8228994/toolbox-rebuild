/**
 * Amazon Registration Core - Refactored Version
 * 重构版本：职责分离，每个操作类负责特定功能
 * 主类只负责流程协调和状态管理
 */

const {
  generateRandomDelay: utilRandomAround,
  extractNameFromEmail: utilEmailToName,
  generatePasswordFromName: utilGeneratePassword,
  createPollingFactory,
  CustomError
} = require('../refactored-backend/utils/toolUtils');

const eventEmitter = require('../refactored-backend/utils/eventEmitter');
const OperationsManager = require('./operations/OperationsManager');

class AmazonRegisterCoreRefactored {
  constructor(config) {
    this.page = config.page;
    this.config = config;
    
    // 账号信息
    this.accountInfo = {
      user: config.user,
      pass: config.pass || utilGeneratePassword(utilEmailToName(config.user)),
      refreshToken: config.refreshToken,
      otpSecret: null
    };
    
    // 注册时间戳（用于邮件过滤）
    this.registerTime = null;
    
    // 初始化操作管理器
    this.ops = new OperationsManager(
      this.page,
      this.config,
      this.tasklog.bind(this),
      this.accountInfo
    );
  }

  /**
   * 日志输出
   */
  tasklog(logData) {
    if (this.config.onLog) {
      this.config.onLog(logData);
    }
    eventEmitter.emit('tasklog', logData);
  }

  /**
   * 记录注册成功
   */
  logRegistrationSuccess() {
    this.tasklog({
      message: '注册成功',
      logID: 'RG-Register-Success',
      account: {
        userEmail: this.accountInfo.user,
        userPass: this.accountInfo.pass
      }
    });
  }

  /**
   * 主执行流程
   */
  async execute() {
    try {
      this.tasklog({ message: '开始Amazon注册流程', logID: 'RG-Info-Operate' });
      
      // 1. 导航和语言选择
      await this.ops.nav.selectLanguage();
      await this.ops.nav.goToSellRegister();
      
      // 2. 注册表单填写
      await this.ops.form.clickSignUp();
      await this.ops.form.clickCreateAccount();
      await this.ops.form.fillUsername(utilEmailToName(this.accountInfo.user));
      await this.ops.form.fillEmail(this.accountInfo.user);
      await this.ops.form.fillPassword(this.accountInfo.pass);
      await this.ops.form.fillPasswordConfirm(this.accountInfo.pass);
      await this.ops.form.submitRegistration();
      
      // 3. 处理Captcha（如果有）
      const hasCaptcha = await this.ops.captcha.checkCaptcha();
      if (hasCaptcha) {
        await this.ops.captcha.solveCaptcha();
      }
      
      // 4. 邮箱验证
      this.registerTime = Date.now();
      this.ops.setRegisterTime(this.registerTime);
      
      const emailCode = await this.ops.email.getEmailVerificationCode();
      await this.ops.form.fillEmailCode(emailCode);
      await this.ops.form.submitEmailVerification();
      
      // 5. 检查注册状态并处理
      const status = await this.checkRegistrationStatus();
      await this.handleRegistrationStatus(status);
      
      this.tasklog({ message: 'Amazon注册流程完成', logID: 'RG-Info-Operate' });
      
      return {
        success: true,
        account: this.accountInfo
      };
      
    } catch (error) {
      this.tasklog({
        message: `注册失败: ${error.message}`,
        logID: 'RG-Error',
        error: error.stack
      });
      throw error;
    }
  }

  /**
   * 检查注册状态
   */
  async checkRegistrationStatus() {
    this.tasklog({ message: '检查注册状态', logID: 'RG-Info-Operate' });
    
    const workflow = createPollingFactory({ interval: 5000, maxWait: 60000 });
    
    return workflow(async () => {
      const url = this.page.url();
      
      if (url.includes('/a/settings/approval/setup/register?')) {
        this.tasklog({ message: '状态: 201 - 直接进入2FA设置页面', logID: 'RG-Info-Operate' });
        return 201;
      } else if (url.includes('/a/settings/otpdevices/add?')) {
        this.tasklog({ message: '状态: 301 - 需要手动导航到2FA设置', logID: 'RG-Info-Operate' });
        return 301;
      } else if (url.includes('ap/cvf/verify')) {
        this.tasklog({ message: '状态: 401 - 需要验证', logID: 'RG-Info-Operate' });
        return 401;
      } else {
        throw new Error('未知状态');
      }
    });
  }

  /**
   * 根据状态处理注册流程
   */
  async handleRegistrationStatus(status) {
    switch (status) {
      case 201:
        await this.handle2FASetup();
        break;
      case 301:
        await this.handle2FAManualSetup();
        break;
      case 401:
        await this.retryRegistration();
        break;
      default:
        throw new Error(`未知注册状态: ${status}`);
    }
  }

  /**
   * 处理状态201: 直接2FA设置
   */
  async handle2FASetup() {
    this.logRegistrationSuccess();
    
    await this.ops.twoFA.expandAuthenticatorApp();
    await this.ops.twoFA.get2FASecret();
    this.tasklog({ message: '2FAToken获取成功', logID: 'RG-Info-Operate' });
    
    const otp = await this.ops.twoFA.getStableTOTP();
    await this.ops.twoFA.fill2FACode(otp.code);
    await this.ops.twoFA.submit2FA();
    
    this.tasklog({
      message: '绑定2FA成功',
      logID: 'RG-Bind-Otp',
      account: {
        userEmail: this.accountInfo.user,
        otpSecret: this.accountInfo.otpSecret
      }
    });
    
    try {
      await this.page.goto('https://www.amazon.com', { timeout: 15000 });
    } catch {}
    
    // 地址绑定（如果需要）
    if (this.config.bindAddress) {
      await this.bindAddress();
    }
  }

  /**
   * 处理状态301: 手动导航2FA设置
   */
  async handle2FAManualSetup() {
    this.logRegistrationSuccess();
    
    // 导航到首页（跳过登录检查，因为刚注册完）
    this.tasklog({ message: '等待页面稳定后导航到首页', logID: 'RG-Info-Operate' });
    await this.page.goto('https://www.amazon.com', { 
      timeout: 60000, 
      waitUntil: 'domcontentloaded'
    });
    await this.page.waitForTimeout(utilRandomAround(2000, 3000));
    
    // 导航到2FA设置
    await this.ops.nav.goToHomepage(true); // 跳过登录检查
    await this.ops.nav.goToLoginSecurity();
    await this.ops.nav.goToStepVerification();
    
    // 设置2FA
    await this.ops.twoFA.expandAuthenticatorApp();
    await this.ops.twoFA.get2FASecret();
    this.tasklog({ message: '2FAToken获取成功', logID: 'RG-Info-Operate' });
    
    const otp = await this.ops.twoFA.getStableTOTP();
    await this.ops.twoFA.fill2FACode(otp.code);
    
    this.registerTime = Date.now();
    this.ops.setRegisterTime(this.registerTime);
    await this.ops.twoFA.submit2FA();
    
    // 邮箱验证
    const code = await this.ops.email.getEmailVerificationCode();
    await this.ops.twoFA.fill2FAEmailCode(code);
    await this.ops.form.submitEmailVerification('load');
    
    this.tasklog({
      message: '绑定2FA成功',
      logID: 'RG-Bind-Otp',
      account: {
        userEmail: this.accountInfo.user,
        otpSecret: this.accountInfo.otpSecret
      }
    });
    
    await this.ops.twoFA.submitTwoStepVerification();
    
    // 地址绑定（如果需要）
    if (!this.config.bindAddress) {
      await this.ops.nav.goToNavLogo();
    } else {
      await this.bindAddress();
    }
  }

  /**
   * 处理状态401: 重试注册
   */
  async retryRegistration() {
    this.tasklog({ message: '需要验证，准备重试', logID: 'RG-Info-Operate' });
    throw new CustomError('NEED_RETRY', '需要额外验证，请重试注册');
  }

  /**
   * 绑定地址
   */
  async bindAddress() {
    this.tasklog({ message: '开始绑定地址', logID: 'RG-Info-Operate' });
    
    const postalCode = this.config.postalCode || '10001';
    const addressData = await this.ops.address.generateAddressData(postalCode);
    
    const { phoneNumber, addressLine1, city, stateCode, postalCode: zip } = addressData;
    
    // 导航到地址管理（跳过登录检查，因为此时肯定已登录）
    await this.ops.nav.goToHomepage(true);
    await this.ops.nav.goToAccountAddress();
    await this.ops.address.clickAddAddress();
    
    // 填写地址信息
    await this.ops.address.fillPhoneNumber(phoneNumber);
    await this.ops.address.fillAddressLine1(addressLine1);
    await this.ops.address.fillCity(city);
    await this.ops.address.selectState(stateCode);
    await this.ops.address.fillPostalCode(zip);
    
    // 提交地址
    await this.ops.address.submitAddress();
    await this.ops.address.handleAddressSuggestions();
    
    this.tasklog({
      message: '地址绑定成功',
      logID: 'RG-Bind-Address',
      address: addressData
    });
    
    // 返回首页
    await this.ops.nav.goToNavLogo();
  }
}

module.exports = AmazonRegisterCoreRefactored;
