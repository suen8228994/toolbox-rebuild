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
}

module.exports = LoginStatusOperations;
