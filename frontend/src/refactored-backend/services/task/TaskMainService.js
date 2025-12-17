/**
 * TaskMainService - Main Task Orchestration Service
 * 
 * This service orchestrates all task workflows:
 * - Connect to CDP browser
 * - Create and manage Playwright pages
 * - Route tasks to appropriate operation services
 * - Handle task lifecycle (start, progress, completion)
 * - Error handling and cleanup
 * 
 * Supported Tasks:
 * - checklive: Card testing workflow
 * - register: Account registration workflow
 */

const { chromium } = require('playwright');
const { CustomError } = require('../../utils/toolUtils');
const { nodeEmitter } = require('../../utils/eventEmitter');
const { CheckliveOperations } = require('./operations/CheckliveOperations');
const { RegisterOperations } = require('./operations/RegisterOperations');
const { AddressBindingOperations } = require('./operations/AddressBindingOperations');

class TaskMainService {
  /**
   * @param {Object} taskPublicService - Task public service instance
   * @param {Object} emailService - Email service instance
   * @param {Object} addressService - Address service instance
   */
  constructor(taskPublicService, emailService, addressService) {
    this._tp_ = taskPublicService;
    this.emailService = emailService;
    this.addressService = addressService;
  }

  /**
   * Main task runner
   * @param {Object} payload - Task payload
   * @param {string} payload.type - Task type ('checklive' or 'register')
   * @param {Object} payload.common - Common task configuration
   * @param {Object} payload.checklive - Checklive-specific configuration (optional)
   * @param {Object} payload.register - Register-specific configuration (optional)
   */
  async runTask(payload) {
    switch (payload.type) {
      case 'checklive':
        await this.runCheckliveTask(payload);
        break;
      case 'register':
        await this.runRegisterTask(payload);
        break;
      default:
        throw new Error(`Unknown task type: ${payload.type}`);
    }
  }

  /**
   * Run check-live (card testing) task
   */
  async runCheckliveTask(options) {
    const { common, checklive } = options;
    const { containerCode, ws, serial, remark } = common;
    
    // Initialize task configuration
    this._tp_.taskCheckliveInitMaps({ common, checklive });
    
    this._tp_.tasklog({
      containerCode,
      serial,
      remark,
      logID: 'CL-Start',
      message: '测活任务开始'
    });
    
    try {
      // Create browser page
      const page = await this.createNewPage(ws);
      this._tp_.taskInitPage(page);
      
      // Monitor signin status
      page?.on('framenavigated', frame => {
        if (frame === page.mainFrame() && frame.url().includes('/ap/signin')) {
          this._tp_.updateCheckliveConfig(conf => {
            conf.isSignin = true;
          });
        }
      });
      
      // Navigate to Amazon
      await this.navigateTo('https://www.amazon.com/ref=nav_logo');
      
      // Update task status
      nodeEmitter.emit('TASK_STATUS', { containerCode, currentStatus: 'progress' });
      
      // Execute check-live operations
      const checkliveOps = new CheckliveOperations(this._tp_);
      await checkliveOps.execute();
      
      await this._tp_.ctxPage.waitForLoadState('domcontentloaded', { timeout: 60000 });
    } catch (error) {
      this.handleTaskError(error);
    } finally {
      // Calculate results
      const { cardRecord, defaultCardCount, isSignin } = this._tp_.taskCheckliveConfig;
      const delTimeCount = cardRecord.filter(item => !('delTime' in item)).length;
      
      this._tp_.tasklog({
        rawCount: isSignin ? 0 : defaultCardCount + delTimeCount,
        logID: 'CL-End',
        message: '测活任务结束'
      });
      
      await this.cleanupBrowser();
      nodeEmitter.emit('TASK_STATUS', { containerCode, currentStatus: 'complete' });
    }
  }

  /**
   * Run registration task
   */
  async runRegisterTask(options) {
    const { common, register } = options;
    const { containerCode, ws, serial, remark } = common;
    
    // Initialize task configuration
    this._tp_.taskRegisterInitMaps({ common, register });
    
    this._tp_.tasklog({
      containerCode,
      serial,
      remark,
      logID: 'RG-Start',
      message: '注册任务开始'
    });
    
    try {
      // Create browser page
      const page = await this.createNewPage(ws);
      
      // Monitor page close event
      page.on('close', () => {
        this._tp_.updateRegisterConfig(conf => { conf.pageClose = true; });
        console.log('页面关闭');
      });
      
      this._tp_.taskInitPage(page);
      
      // Get browser language
      await this.navigateTo('https://www.google.com/', 'domcontentloaded');
      const language = await page.evaluate(() => navigator.language);
      this._tp_.updateRegisterConfig(conf => { conf.language = language; });
      
      // Navigate to appropriate Amazon site based on language
      await this.navigateByLanguage(language);
      
      // Update task status
      nodeEmitter.emit('TASK_STATUS', { containerCode, currentStatus: 'progress' });
      
      // Execute registration operations
      const registerOps = new RegisterOperations(this._tp_, this.emailService);
      await registerOps.execute();
      
      // Optionally bind address
      if (register.bindAddress) {
        const addressOps = new AddressBindingOperations(this._tp_, this.addressService);
        await addressOps.execute();
      }
    } catch (error) {
      this.handleTaskError(error);
    } finally {
      await this.cleanupBrowser();
      nodeEmitter.emit('TASK_STATUS', { containerCode, currentStatus: 'complete' });
      
      const { notUseEmail } = this._tp_.taskRegisterConfig;
      this._tp_.tasklog({
        ...(notUseEmail ? { notUseEmail } : {}),
        logID: 'RG-End',
        message: '注册任务结束'
      });
    }
  }

  /**
   * Navigate to Amazon site based on browser language
   */
  async navigateByLanguage(language) {
    const languageMap = {
      'pl': 'https://sell.amazon.pl',
      'es-ES': 'https://sell.amazon.es',
      'de-DE': 'https://sell.amazon.de',
      'en-US': 'https://sell.amazon.com',
      'nl': 'https://sell.amazon.nl',
      'fr': 'https://sell.amazon.com.be',
      'fr-FR': 'https://sell.amazon.fr',
      'it-IT': 'https://sell.amazon.it',
      'en-GB': 'https://sell.amazon.co.uk'
    };
    
    const url = languageMap[language] || 'https://sell.amazon.com';
    await this.navigateTo(url);
  }

  /**
   * Create new Playwright page via CDP connection
   */
  async createNewPage(ws) {
    try {
      const browser = await chromium.connectOverCDP(ws, { timeout: 60000 });
      const contexts = browser.contexts();
      const context = contexts[contexts.length - 1];
      
      return await context.newPage();
    } catch (error) {
      this._tp_.createError({ message: '创建标签页失败', logID: 'Error-Info' });
    }
  }

  /**
   * Navigate to URL with error handling
   */
  async navigateTo(url, waitUntil = 'load') {
    try {
      await this._tp_.ctxPage.goto(url, { waitUntil, timeout: 60000 });
    } catch (error) {
      const errorMessage = this.parseNavigationError(error);
      this._tp_.createError({
        message: `加载亚马逊失败，${errorMessage}`,
        logID: 'Error-Info'
      });
    }
  }

  /**
   * Parse navigation error into user-friendly message
   */
  parseNavigationError(error) {
    const errorString = String(error);
    
    const errorMap = {
      'ERR_SSL_VERSION_OR_CIPHER_MISMATCH': 'SSL/TLS 连接异常',
      'ERR_SSL_PROTOCOL_ERROR': '网络链接失败，断网',
      'ERR_CERT_COMMON_NAME_INVALID': '域名与证书 CN 不匹配',
      'ERR_CONNECTION_CLOSED': 'TLS 握手后连接被关闭',
      'ERR_CONNECTION_RESET': 'TLS 握手失败后重置',
      'ERR_SSL_PINNED_KEY_NOT_IN_CERT_CHAIN': '证书不匹配',
      'ERR_SSL_OBSOLETE_VERSION': '浏览器禁用SSL/TLS'
    };
    
    for (const [key, message] of Object.entries(errorMap)) {
      if (errorString.includes(key)) {
        return message;
      }
    }
    
    return '网络异常';
  }

  /**
   * Handle task errors
   */
  handleTaskError(error) {
    const isCustom = error instanceof CustomError;
    const message = error.message.includes('net::ERR')
      ? '代理网络异常'
      : String(error.message);
    const logID = isCustom ? error.logID : 'Error-Info';
    
    this._tp_.tasklog({ message, logID });
  }

  /**
   * Cleanup browser resources
   */
  async cleanupBrowser() {
    try {
      this._tp_.ctxPage.removeAllListeners();
      await this._tp_.ctxPage.close();
    } catch {
      this._tp_.createError({ message: '关闭标签页失败', logID: 'Error-Info' });
    }
  }
}

module.exports = { TaskMainService };
