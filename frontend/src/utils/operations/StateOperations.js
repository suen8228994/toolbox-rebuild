/**
 * 状态操作类 - 负责注册流程状态检查和处理
 */

const BaseOperations = require('./BaseOperations');

class StateOperations extends BaseOperations {
  /**
   * 检查注册状态
   * 通过轮询和URL检测来确定当前注册流程状态
   * 
   * 返回状态码:
   * - 201: 2FA设置页面（注册成功，直接显示2FA设置）
   * - 301: 需要手动导航到2FA页面（注册成功，需要用户跳过并手动绑定）
   * - 401: 需要手机验证（注册失败，需要切换代理重试）
   */
  async checkRegistrationStatus(options = {}) {
    const { 
      interval = 5000, 
      maxWait = 60000,
      detectTwoStepVerification = null,
      detectForcedPhoneVerification = null
    } = options;
    
    const createPollingFactory = (opts) => {
      const { interval: pollInterval, maxWait: maxWaitTime } = opts;
      return async (fn) => {
        const startTime = Date.now();
        while (Date.now() - startTime < maxWaitTime) {
          try {
            return await fn();
          } catch (error) {
            if (error.message && error.message.includes('等待')) {
              await new Promise(resolve => setTimeout(resolve, pollInterval));
              continue;
            }
            throw error;
          }
        }
        throw new Error(`轮询超时 (${maxWaitTime}ms)`);
      };
    };
    
    const workflow = createPollingFactory({ interval, maxWait });
    
    return workflow(async () => {
      const url = this.page.url();
      this.tasklog({ message: `状态检测 URL: ${url}`, logID: 'State-Check' });
      
      // 1. 优先检测2FA设置页面（注册成功）
      if (url.includes('/a/settings/approval/setup/register?')) {
        this.tasklog({ message: '✅ 检测到2FA设置页面 - 注册成功', logID: 'State-Check' });
        return 201; // 2FA setup page
      } 
      
      // 2. 检测需要手动导航到2FA页面
      else if (url.includes('/a/settings/otpdevices/add?')) {
        this.tasklog({ message: '✅ 检测到OTP设备添加页面 - 注册成功', logID: 'State-Check' });
        return 301; // Add OTP device page
      } 
      
      // 3. 检测Two-Step Verification页面（注册成功后，需要跳过并手动绑定2FA）
      else if (detectTwoStepVerification && await detectTwoStepVerification()) {
        this.tasklog({ message: '✅ 检测到Two-Step Verification页面（注册成功）', logID: 'State-Check' });
        return 301;
      }
      
      // 4. 检测强制手机验证页面（注册过程中出现，需要切换代理）
      else if (detectForcedPhoneVerification && await detectForcedPhoneVerification()) {
        this.tasklog({ message: '⚠️ 检测到强制手机验证页面（注册失败）', logID: 'State-Check' });
        return 401; // 需要切换代理重试
      }
      
      // 5. 检测其他验证页面
      else if (url.includes('ap/cvf/verify')) {
        this.tasklog({ message: '⚠️ 检测到验证页面', logID: 'State-Check' });
        return 401; // Verification required
      } 
      
      else {
        throw new Error('等待页面跳转...');
      }
    });
  }

  /**
   * 处理注册状态
   * 根据检查到的状态码调用相应的处理流程
   */
  async handleRegistrationStatus(status, handlers = {}) {
    const {
      handle2FASetup = null,
      handle2FAManualSetup = null,
      retryRegistration = null
    } = handlers;
    
    this.tasklog({ message: `处理注册状态: ${status}`, logID: 'State-Handle' });
    
    switch (status) {
      case 201: // 2FA setup page
        if (handle2FASetup) {
          this.tasklog({ message: '执行2FA自动设置流程', logID: 'State-Handle' });
          await handle2FASetup();
        } else {
          this.tasklog({ message: '未定义2FA自动设置处理器', logID: 'Warn-State' });
        }
        break;
        
      case 301: // Need to navigate to 2FA manually
        if (handle2FAManualSetup) {
          this.tasklog({ message: '执行2FA手动设置流程', logID: 'State-Handle' });
          await handle2FAManualSetup();
        } else {
          this.tasklog({ message: '未定义2FA手动设置处理器', logID: 'Warn-State' });
        }
        break;
        
      case 401: // Need phone verification
        this.tasklog({ message: '需要重试注册（强制手机验证）', logID: 'State-Handle' });
        
        if (retryRegistration) {
          await retryRegistration();
        } else {
          this.tasklog({ message: '未定义重试注册处理器', logID: 'Warn-State' });
        }
        
        // 重新检查状态
        const retryStatus = await this.checkRegistrationStatus(handlers.checkStatusOptions || {});
        
        switch (retryStatus) {
          case 201:
            if (handle2FASetup) {
              await handle2FASetup();
            }
            break;
          case 301:
            if (handle2FAManualSetup) {
              await handle2FAManualSetup();
            }
            break;
          case 401:
            this.tasklog({ 
              message: '重试后仍需手机验证，注册失败', 
              logID: 'Error-State' 
            });
            throw new Error('PHONE_VERIFICATION_REQUIRED');
        }
        break;
        
      default:
        this.tasklog({ message: `未知的注册状态: ${status}`, logID: 'Error-State' });
        throw new Error(`UNKNOWN_REGISTRATION_STATUS_${status}`);
    }
  }

  /**
   * 完整的注册状态检查和处理流程
   * 集成checkRegistrationStatus和handleRegistrationStatus
   */
  async checkAndHandleRegistrationStatus(handlers = {}) {
    try {
      const status = await this.checkRegistrationStatus(handlers.checkStatusOptions || {});
      await this.handleRegistrationStatus(status, handlers);
      return status;
    } catch (error) {
      this.tasklog({ 
        message: `注册状态处理异常: ${error.message}`, 
        logID: 'Error-State' 
      });
      throw error;
    }
  }
}

module.exports = StateOperations;
