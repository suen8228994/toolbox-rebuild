/**
 * 登录状态检查类 - 负责检查和确保登录状态
 */

const BaseOperations = require('./BaseOperations');

class LoginStatusOperations extends BaseOperations {
  /**
   * 检查是否已登录
   */
  async checkLoginStatus() {
    try {
      const accountElement = this.page.locator('a[data-nav-role="signin"]').first();
      const isVisible = await accountElement.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (!isVisible) {
        return false;
      }
      
      const text = await accountElement.innerText();
      const isLoggedIn = text.includes('Hello') || text.includes('Account & Lists');
      
      this.tasklog({ 
        message: `登录状态检查: ${isLoggedIn ? '已登录' : '未登录'}`, 
        logID: 'RG-Info-Operate' 
      });
      
      return isLoggedIn;
    } catch (error) {
      this.tasklog({ 
        message: `登录状态检查失败: ${error.message}`, 
        logID: 'RG-Info-Operate' 
      });
      return false;
    }
  }

  /**
   * 确保登录状态（重试机制）
   */
  async ensureLoginStatus(maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      const isLoggedIn = await this.checkLoginStatus();
      
      if (isLoggedIn) {
        this.tasklog({ 
          message: '确认已登录，继续执行', 
          logID: 'RG-Info-Operate' 
        });
        return true;
      }
      
      if (i < maxRetries - 1) {
        this.tasklog({ 
          message: `未检测到登录状态，刷新页面重试 (${i + 1}/${maxRetries})`, 
          logID: 'RG-Info-Operate' 
        });
        await this.page.reload({ waitUntil: 'networkidle' });
        await this.waitRandom(2000, 3000);
      }
    }
    
    this.tasklog({ 
      message: '警告：多次重试后仍未检测到登录状态，继续执行可能出错', 
      logID: 'RG-Info-Operate' 
    });
    return false;
  }

  /**
   * 检测是否是登录页面
   */
  async detectLoginPage() {
    try {
      const pageContent = await this.page.content();
      return pageContent.includes('Amazon登录') ||
             pageContent.includes('Sign in') ||
             pageContent.includes('Email or mobile phone number');
    } catch (error) {
      return false;
    }
  }

  /**
   * 检测是否强制要求电话验证
   * 检测德语/英语版本的"添加手机号"强制验证页面
   */
  async detectForcedPhoneVerification() {
    try {
      const pageContent = await this.page.content();
      const url = this.page.url();
      
      // 检查是否在电话验证页面
      const isPhoneVerifPage = 
        url.includes('/ap/register') &&
        (pageContent.includes('请输入您的电话号码') ||
         pageContent.includes('Add a phone number') ||
         pageContent.includes('Geben Sie Ihre Telefonnummer ein') ||
         pageContent.includes('Entrer votre numéro de téléphone'));
      
      // 排除Two-Step Verification页面
      const isTwoStepPage = 
        pageContent.includes('两步验证') ||
        pageContent.includes('Two-Step Verification');
      
      return isPhoneVerifPage && !isTwoStepPage;
    } catch (error) {
      return false;
    }
  }

  /**
   * 检测Two-Step Verification（双因素验证）页面
   */
  async detectTwoStepVerification() {
    try {
      // 使用元素检测而不是文本，支持多语言
      const radioButtons = await this.page.locator('input[type="radio"]').count();
      if (radioButtons === 0) return false;
      
      const pageContent = await this.page.content();
      return pageContent.includes('选择如何接收验证码') ||
             pageContent.includes('Choose how to verify') ||
             pageContent.includes('Wählen Sie') ||
             pageContent.includes('Choisissez');
    } catch (error) {
      return false;
    }
  }

  /**
   * 检测Two-Step Verification设置说明页面
   */
  async detectTSVSetupHowtoPage() {
    try {
      const url = this.page.url();
      const pageContent = await this.page.content();
      
      // URL特征检查
      const isURLMatch = url.includes('/a/settings/approval/setup/howto');
      
      // 页面内容检查
      const isContentMatch = 
        pageContent.includes('两步验证如何工作') ||
        pageContent.includes('How Two-Step Verification works') ||
        pageContent.includes('两步验证保护您的账户') ||
        pageContent.includes('Two-Step Verification helps protect') ||
        pageContent.includes('Authenticate with your phone') ||
        pageContent.includes('Got it');
      
      return isURLMatch || isContentMatch;
    } catch (error) {
      return false;
    }
  }

  /**
   * 检测是否出现拼图/验证码页面
   */
  async detectPuzzlePage() {
    try {
      const pageContent = await this.page.content();
      const hasCanvas = await this.page.$$('canvas').then(elements => elements.length > 0).catch(() => false);
      
      return hasCanvas || 
             pageContent.includes('captcha') ||
             pageContent.includes('puzzle') ||
             pageContent.includes('验证') ||
             pageContent.includes('验证码');
    } catch (error) {
      return false;
    }
  }

  /**
   * 检测是否出现异常活动错误
   */
  async detectUnusualActivityError() {
    try {
      const pageContent = await this.page.content();
      return pageContent.includes('我们检测到您的账户中出现异常活动') ||
             pageContent.includes('We detected unusual activity') ||
             pageContent.includes('异常活动') ||
             pageContent.includes('unusual activity');
    } catch (error) {
      return false;
    }
  }

  /**
   * 智能检测当前页面状态
   * 返回页面类型，用于决定下一步操作
   */
  async detectCurrentPageState() {
    try {
      const url = this.page.url();
      const pageContent = await this.page.content();

      // 异常活动检测
      if (await this.detectUnusualActivityError()) {
        return 'UNUSUAL_ACTIVITY_PAGE';
      }

      // Two-Step Verification 设置说明页面
      if (await this.detectTSVSetupHowtoPage()) {
        return 'TSV_SETUP_HOWTO_PAGE';
      }

      // 两步验证选择页面
      if (await this.detectTwoStepVerification()) {
        return 'TSV_CHOICE_PAGE';
      }

      // 强制电话验证页面
      if (await this.detectForcedPhoneVerification()) {
        return 'FORCED_PHONE_VERIFICATION_PAGE';
      }

      // 登录页面
      if (await this.detectLoginPage()) {
        return 'LOGIN_PAGE';
      }

      // 拼图/验证码页面
      if (await this.detectPuzzlePage()) {
        return 'CAPTCHA_PAGE';
      }

      // 注册页面
      if (url.includes('/ap/register') || pageContent.includes('创建Amazon账户') ||
          pageContent.includes('Create your Amazon account')) {
        return 'REGISTER_PAGE';
      }

      return 'UNKNOWN_PAGE';
    } catch (error) {
      return 'UNKNOWN_PAGE';
    }
  }
}

module.exports = LoginStatusOperations;
