/**
 * 导航操作类 - 负责页面导航和跳转
 */

const BaseOperations = require('./BaseOperations');

class NavigationOperations extends BaseOperations {
  /**
   * 选择语言
   */
  async selectLanguage() {
    this.tasklog({ message: '选择语言', logID: 'RG-Info-Operate' });
    
    const languageFlag = this.page.locator('#icp-nav-flyout').first();
    await this.clickElement(languageFlag, { title: '桌面端，主站，选择语言' });
    await this.waitRandom(1000, 1500);

    const languageItem = this.page.locator('a[href="#switch-lang=en_US"]').first();
    await this.clickElement(languageItem, {
      title: '桌面端，主站，选择语言',
      waitForURL: true
    });
  }

  /**
   * 进入卖家注册页面
   */
  async goToSellRegister() {
    this.tasklog({ message: '进入卖家注册', logID: 'RG-Info-Operate' });
    
    const url = 'https://sell.amazon.com/sell';
    await this.page.goto(url, { timeout: 60000, waitUntil: 'load' });
    await this.waitRandom(2000, 3000);
  }

  /**
   * 点击 Logo 返回首页
   */
  async goToNavLogo() {
    this.tasklog({ message: '点击Logo', logID: 'RG-Info-Operate' });
    
    const logo = this.page.locator('#nav-logo').first();
    await this.clickElement(logo, {
      title: '桌面端，主站，点击Logo',
      waitForURL: true
    });
  }

  /**
   * 打开个人中心
   * @param {boolean} skipLoginCheck - 是否跳过登录状态检查
   */
  async goToHomepage(skipLoginCheck = false) {
    // 如果需要检查登录状态，由调用方处理
    // 这里只负责导航
    this.tasklog({ message: '打开个人中心', logID: 'RG-Info-Operate' });
    
    const accountLink = this.page.locator('a[data-nav-role="signin"]').first();
    await this.clickElement(accountLink, {
      title: '桌面端，主站，打开个人中心',
      waitForURL: true
    });
  }

  /**
   * 打开登录与安全
   */
  async goToLoginSecurity() {
    this.tasklog({ message: '打开登录与安全', logID: 'RG-Info-Operate' });
    
    const securityLink = this.page.locator('a[href*="ap/cnep"]').first();
    await this.clickElement(securityLink, {
      title: '桌面端，主站，打开登录与安全',
      waitForURL: true
    });
  }

  /**
   * 打开两步验证设置
   */
  async goToStepVerification() {
    this.tasklog({ message: '打开两步验证', logID: 'RG-Info-Operate' });
    
    const twoStepLink = this.page.locator('a[href*="/a/settings/approval/setup/register?"]');
    await this.clickElement(twoStepLink, {
      title: '桌面端，主站，打开两步验证',
      waitForURL: true
    });
  }

  /**
   * 进入地址管理
   */
  async goToAccountAddress() {
    this.tasklog({ message: '打开地址管理', logID: 'RG-Info-Operate' });
    
    const addressLink = this.page.locator('a[data-csa-c-content-id="YourAddresses"]').first();
    await this.clickElement(addressLink, {
      title: '桌面端，主站，打开地址管理',
      waitForURL: true
    });
  }
}

module.exports = NavigationOperations;
