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

  /**
   * 处理Two-Step Verification设置说明页面
   * 检测到此页面后，直接导航到亚马逊主页
   */
  async handleTSVSetupHowtoPage() {
    try {
      this.tasklog({ message: '检测到TSV设置说明页，跳转到首页', logID: 'RG-Info-Operate' });
      
      // 导航到首页
      await this.page.goto('https://www.amazon.com', { 
        timeout: 60000, 
        waitUntil: 'networkidle' 
      });
      
      await this.waitRandom(2000, 3000);
      return true;
    } catch (error) {
      this.tasklog({ 
        message: `处理TSV设置说明页失败: ${error.message}`, 
        logID: 'Error-Nav' 
      });
      return false;
    }
  }

  /**
   * 处理站点选择弹窗
   */
  async handleCountrySelectionPopup() {
    try {
      await this.waitRandom(1000, 2000);
      
      // 寻找"Go to Amazon.com"按钮
      const buttons = await this.page.$$('a[href*="amazon.com"]');
      let foundButton = false;
      
      for (const button of buttons) {
        const text = await button.innerText().catch(() => '');
        if (text && text.includes('Go to Amazon.com')) {
          this.tasklog({ message: '点击"Go to Amazon.com"按钮', logID: 'RG-Info-Operate' });
          await button.click();
          await this.page.waitForLoadState('networkidle');
          foundButton = true;
          break;
        }
      }
      
      if (foundButton) {
        await this.waitRandom(2000, 3000);
      }
      
      return true;
    } catch (error) {
      return true;  // 不报错，继续
    }
  }

  /**
   * 确保个人中心菜单可见
   */
  async ensureAccountMenuVisible() {
    try {
      // 寻找个人中心菜单
      const accountButton = this.page.locator('#nav-account-card').first();
      const isVisible = await accountButton.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (!isVisible) {
        // 尝试点击账户菜单按钮来展开
        const menuButton = this.page.locator('[data-nav-role="signin"]').first();
        if (await menuButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await menuButton.click();
          await this.waitRandom(1000, 1500);
        }
      }
      
      return true;
    } catch (error) {
      return true;  // 不报错，继续
    }
  }

  /**
   * ========================================
   * 代理管理功能
   * ========================================
   */

  /**
   * 获取下一个代理
   * 优先从代理池获取，池耗尽时动态生成
   */
  async getNextProxy(config = {}) {
    try {
      const proxyPool = config.proxyPool || [];
      let currentProxyIndex = config.currentProxyIndex || 0;
      const proxyPrefix = config.proxyPrefix;
      const proxyPassword = config.proxyPassword;
      const proxyCountry = config.proxyCountry || 'US';
      
      // 1. 优先从代理池中获取
      if (proxyPool && proxyPool.length > currentProxyIndex) {
        const proxy = proxyPool[currentProxyIndex];
        config.currentProxyIndex = currentProxyIndex + 1;
        console.log(`[代理] 从代理池获取代理 [${currentProxyIndex + 1}/${proxyPool.length}]: ${proxy.substring(0, 50)}...`);
        return proxy;
      }
      
      // 2. 代理池耗尽，动态生成
      if (proxyPrefix && proxyPassword) {
        this.tasklog({ message: `代理池已耗尽，开始动态生成新代理（国家: ${proxyCountry}）`, logID: 'Proxy-Gen' });
        
        const proxyGenerator = require('../proxyGenerator');
        const newProxies = proxyGenerator.generateProxies({
          country: proxyCountry,
          quantity: 1,
          prefix: proxyPrefix,
          password: proxyPassword
        });
        
        if (newProxies && newProxies.length > 0) {
          this.tasklog({ message: '✓ 动态生成代理成功', logID: 'Proxy-Gen' });
          return newProxies[0];
        }
      }
      
      this.tasklog({ message: '⚠️ 无法获取新代理（代理池为空且未配置生成参数）', logID: 'Proxy-Warn' });
      return null;
    } catch (error) {
      this.tasklog({ message: `生成代理失败: ${error.message}`, logID: 'Error-Proxy' });
      return null;
    }
  }

  /**
   * 切换代理并重启浏览器
   * 用于绕过强制手机验证等情况
   */
  async switchProxyAndRetry(config = {}) {
    try {
      this.tasklog({ message: '开始切换代理并重启浏览器...', logID: 'Proxy-Switch' });
      
      const maxProxyRetries = config.maxProxyRetries || 5;
      const currentProxyRetryCount = config.currentProxyRetryCount || 0;
      
      // 检查重试次数
      if (currentProxyRetryCount >= maxProxyRetries) {
        this.tasklog({ message: '❌ 已达到最大代理切换次数限制', logID: 'Error-Proxy' });
        return { success: false, error: '已达到最大代理切换次数' };
      }
      
      config.currentProxyRetryCount = currentProxyRetryCount + 1;
      this.tasklog({ 
        message: `第 ${config.currentProxyRetryCount}/${maxProxyRetries} 次切换`, 
        logID: 'Proxy-Switch' 
      });
      
      // 获取新代理
      const newProxy = await this.getNextProxy(config);
      if (!newProxy) {
        this.tasklog({ message: '❌ 无法获取新代理', logID: 'Error-Proxy' });
        return { success: false, error: '无法获取新代理' };
      }
      
      // 保存旧容器信息
      const oldContainerCode = config.containerCode;
      const hubstudio = config.hubstudio;
      const browser = config.browser;
      
      // 关闭当前浏览器
      this.tasklog({ message: '关闭当前浏览器...', logID: 'Proxy-Switch' });
      try {
        if (browser) {
          await browser.close();
        }
      } catch (e) {
        console.warn('[代理切换] 关闭浏览器警告:', e.message);
      }
      
      // 删除旧容器
      this.tasklog({ message: `删除旧容器: ${oldContainerCode}`, logID: 'Proxy-Switch' });
      try {
        if (hubstudio && oldContainerCode) {
          await hubstudio.deleteContainer(oldContainerCode);
          this.tasklog({ message: '✓ 旧容器删除请求已发送', logID: 'Proxy-Switch' });
        }
        
        // 等待容器清除
        this.tasklog({ message: '⏳ 等待旧容器完全清除（3秒）...', logID: 'Proxy-Switch' });
        await new Promise(resolve => setTimeout(resolve, 3000));
        this.tasklog({ message: '✓ 旧容器已清除，准备创建新容器', logID: 'Proxy-Switch' });
      } catch (e) {
        this.tasklog({ message: `删除旧容器警告: ${e.message}`, logID: 'Proxy-Switch' });
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // 使用新代理创建浏览器实例
      this.tasklog({ message: '使用新代理创建浏览器实例...', logID: 'Proxy-Switch' });
      
      const platformClient = config.platformClient || 'sell';
      const cache = config.cache !== false;
      const arrange = config.arrange !== false;
      
      const newContainerCode = await hubstudio.createContainer({
        platformClient,
        cache,
        arrange,
        proxy: newProxy
      });
      
      this.tasklog({ message: `✓ 新容器创建成功: ${newContainerCode}`, logID: 'Proxy-Switch' });
      config.containerCode = newContainerCode;
      
      // 启动新浏览器
      this.tasklog({ message: '正在启动浏览器...', logID: 'Proxy-Switch' });
      const browserInfo = await hubstudio.startBrowser({
        containerCode: newContainerCode
      });
      
      this.tasklog({ message: '浏览器启动成功，正在连接CDP...', logID: 'Proxy-Switch' });
      const debugPort = browserInfo.debuggingPort;
      
      // 获取CDP WebSocket URL
      const cdpInfoUrl = `http://127.0.0.1:${debugPort}/json/version`;
      let wsEndpoint;
      
      try {
        const response = await (await require('playwright').chromium._launchProcess).fetch(cdpInfoUrl);
        const data = await response.json();
        wsEndpoint = data.webSocketDebuggerUrl;
      } catch (e) {
        // 备选方案：使用默认的WS URL格式
        wsEndpoint = `ws://127.0.0.1:${debugPort}`;
      }
      
      this.tasklog({ message: `✓ 获取WebSocket端点成功`, logID: 'Proxy-Switch' });
      
      const playwright = require('playwright');
      const newBrowser = await playwright.chromium.connectOverCDP(wsEndpoint);
      config.browser = newBrowser;
      
      this.tasklog({ message: '✓ 浏览器连接成功，代理切换完成', logID: 'Proxy-Switch' });
      
      return { 
        success: true, 
        browser: newBrowser,
        containerCode: newContainerCode,
        wsEndpoint
      };
    } catch (error) {
      this.tasklog({ 
        message: `代理切换失败: ${error.message}`, 
        logID: 'Error-Proxy' 
      });
      return { success: false, error: error.message };
    }
  }
}

module.exports = NavigationOperations;
