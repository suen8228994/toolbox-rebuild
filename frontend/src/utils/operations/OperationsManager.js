/**
 * 操作管理器 - 统一管理所有操作类的实例
 */

const NavigationOperations = require('./NavigationOperations');
const FormOperations = require('./FormOperations');
const CaptchaOperations = require('./CaptchaOperations');
const TwoFactorAuthOperations = require('./TwoFactorAuthOperations');
const EmailVerificationOperations = require('./EmailVerificationOperations');
const AddressOperations = require('./AddressOperations');
const LoginStatusOperations = require('./LoginStatusOperations');

class OperationsManager {
  constructor(page, config, tasklog, accountInfo) {
    this.page = page;
    this.config = config;
    this.tasklog = tasklog;
    this.accountInfo = accountInfo;
    this.registerTime = null;
    
    // 初始化所有操作类
    this.navigation = new NavigationOperations(page, config, tasklog);
    this.form = new FormOperations(page, config, tasklog);
    this.captcha = new CaptchaOperations(page, config, tasklog);
    this.twoFactorAuth = new TwoFactorAuthOperations(page, config, tasklog, accountInfo);
    this.emailVerification = new EmailVerificationOperations(page, config, tasklog, accountInfo, this.registerTime);
    this.address = new AddressOperations(page, config, tasklog);
    this.loginStatus = new LoginStatusOperations(page, config, tasklog);
  }

  /**
   * 更新注册时间
   */
  setRegisterTime(time) {
    this.registerTime = time;
    this.emailVerification.updateRegisterTime(time);
  }

  /**
   * 获取所有操作类的快捷访问
   */
  get ops() {
    return {
      nav: this.navigation,
      form: this.form,
      captcha: this.captcha,
      twoFA: this.twoFactorAuth,
      email: this.emailVerification,
      address: this.address,
      login: this.loginStatus
    };
  }
}

module.exports = OperationsManager;
