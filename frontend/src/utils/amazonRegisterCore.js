
/**
 * Amazon Registration Core Logic
 * 完全基于 refactored-backend/services/task/operations/RegisterOperations.js
 * 这是从原始 toolbox task.worker.js 提取的完整核心逻辑
 * 
 * 主要功能：
 * 1. 语言选择和导航
 * 2. 账号注册表单填写
 * 3. Captcha 自动解析和提交
 * 4. 邮箱验证码获取和验证
 * 5. 手机验证（可选）
 * 6. 2FA 绑定（TOTP）
 * 7. 地址绑定（可选）
 * 8. 多种注册状态处理
 */

const {
  generateRandomDelay: utilRandomAround,
  generateFluctuatingDelay: utilFluctuateAround,
  extractNameFromEmail: utilEmailToName,
  generatePasswordFromName: utilGeneratePassword,
  extractEmailVerificationCode: utilExtractEmailCode,
  flattenObject: utilFlattenObject,
  generateTOTP: utilGenerateTOTP,
  generateGridPositions: utilGenerateGridPositions,
  createPollingFactory,
  CustomError
} = require('../refactored-backend/utils/toolUtils');
// 注意：慢速逐字逻辑已合并到 `fillInput` 中，移除独立的 generateSlowType 引用

const eventEmitter = require('../refactored-backend/utils/eventEmitter');

// 导入反机器人检测工具
const {
  scrollDownAndUp,
  humanClickLocator,
  humanTypeLocator
} = require('./pageUtils');

// 导入邮件服务
const msGraphMail = require('./msGraphMail');

// 导入地址生成服务
const AddressService = require('../refactored-backend/services/address/AddressService');

// 导入手机号生成工具
const PhoneGenerator = require('./phoneGenerator');

// ⚠️ 导入独立的Captcha处理模块（请勿在此文件中修改Captcha逻辑）
const CaptchaHandler = require('./captchaHandler');

// 导入Canvas图片验证码处理模块（用于Amazon图片验证）
const CaptchaCanvasCapture = require('../../CaptchaCanvasCapture');

// 导入操作管理器
const OperationsManager = require('./operations/OperationsManager');

class AmazonRegisterCore {
  constructor(config) {
    // 从配置中提取所有必要参数
    this.page = config.page;
    this.config = config;
    
    // 初始化地址生成服务
    this.addressService = config.addressService || new AddressService();
    
    // 初始化Captcha处理器（独立模块，避免被其他代码影响）
    this.captchaHandler = null; // 延迟初始化
    
    // 初始化Canvas图片验证码处理器
    this.captchaCanvasCapture = null; // 延迟初始化
    
    // Private state
    this.registerTime = config.registerTime || Date.now();
    this.emailServiceInfo = null;
    this.addressInfo = null;
    this.suggestedAddress = false;
    
    // 代理管理
    this.currentProxy = config.proxy || null;
    this.proxyPrefix = config.proxyPrefix || null;
    this.proxyPassword = config.proxyPassword || null;
    this.proxyPool = config.proxyPool || []; // 代理池
    this.currentProxyIndex = config.proxyIndex || 0;
    // 代理国家：如果配置了就使用配置；否则从支持列表中随机选择一个
    (function() {
      const SUPPORTED_PROXY_COUNTRIES = [
        'IN','ID','JP','KR','HK','PH','SG','VN','MM','TH','MY','TW','KP','BD','BT','MV','NP','PK','LK','BH','KW','OM',
        'SE','QA','SA','AE','YE','CY','IQ','IL','JO','LB','PS','SY','AF','AM','AZ','IR','TR','KZ','KG','TJ','TM','UZ','GE','TL','MO',
        'GB','FR','RU','IT','DE','LU','BY','BE','AT','ES','IE','FI','VA','PT','LV','PL','LT','HU','MD','NL','CH','MC','CZ','NO','IS','GR','MT','EE','UA','HR',
        'US','CA','JM','LC','MX','PA','BR','AR','CO','CL','VE','PE','NZ','PW','AU','MG','MZ','ZA','ET','KE','GH','NG','DZ'
      ];
      const cfg = (config.proxyCountry || '').toString().trim().toUpperCase();
      if (cfg && SUPPORTED_PROXY_COUNTRIES.includes(cfg)) {
        this.proxyCountry = cfg;
      } else {
        this.proxyCountry = SUPPORTED_PROXY_COUNTRIES[Math.floor(Math.random() * SUPPORTED_PROXY_COUNTRIES.length)];
      }
    }).call(this);
    this.autoDeleteOnFailure = config.autoDeleteOnFailure || false; // 失败时自动删除环境（开关控制）
    
    // 重试配置
    this.maxRetries = config.maxRetries || 3; // 单步骤最大重试次数
    this.maxProxyRetries = 2; // 强制手机验证时最大代理切换次数
    this.currentProxyRetryCount = 0; // 当前代理重试次数
    
    // 注册尝试标记
    this.isRetryingRegistration = false; // 是否正在重试整个注册流程
    
    // 从 emailLine 中解析邮箱、密码和邮箱服务信息
    // emailLine 格式: email----password----client_id----refresh_token
    let email, password, refresh_token, client_id;
    if (config.emailLine) {
      const parts = config.emailLine.split('----');
      email = parts[0];
      password = config.password || parts[1] || null;
      client_id = parts[2] || null; // 第3部分是 client_id
      refresh_token = parts[3] || null; // 第4部分是 refresh_token
      
      // 如果有 refresh_token，设置 emailServiceInfo
      if (refresh_token && client_id) {
        this.emailServiceInfo = {
          refresh_token: refresh_token,
          client_id: client_id // 使用 emailLine 中的真实 client_id
        };
      }
    } else {
      email = config.email;
      password = config.password;
    }
    
    this.accountInfo = {
      user: email,
      password: password,
      name: config.name || (email ? email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '') : 'User')
    };
    this.logs = [];
    
    // 初始化操作管理器
    this.ops = new OperationsManager(this.page, this.config, this.tasklog.bind(this), this.accountInfo);
  }

  /**
   * 任务日志记录 - 供OperationsManager使用
   */
  tasklog(log) {
    this.logs.push({
      timestamp: Date.now(),
      ...log
    });
    console.log(`[${log.logID}] ${log.message}`, log.account || '');
  }

  /**
   * 带重试的操作执行
   */
  async withRetry(fn, fnName, maxRetries = this.maxRetries) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[重试] ${fnName} - 尝试 ${attempt}/${maxRetries}`);
        return await fn();
      } catch (error) {
        lastError = error;
        console.warn(`[重试] ${fnName} - 第 ${attempt} 次尝试失败: ${error.message}`);
        
        if (attempt < maxRetries) {
          console.log('[重试] 刷新页面后重试...');
          try {
            await this.page.reload({ waitUntil: 'networkidle', timeout: 30000 });
            await this.page.waitForTimeout(utilRandomAround(2000, 3000));
            
            // 刷新后检测页面状态
            const pageState = await this.detectCurrentPageState();
            
            // 根据页面状态决定是否需要特殊处理
            if (pageState === 'login') {
              console.log('[重试] ⚠️ 刷新后进入登录页，说明注册未成功，需要切换代理重新注册');
              throw new Error('RETRY_REGISTRATION');
            } else if (pageState === 'two-step-verification') {
              console.log('[重试] ⚠️ 刷新后仍是Two-Step Verification，需要切换代理');
              throw new Error('NEED_PROXY_SWITCH');
            } else if (pageState === 'forced-phone-verification') {
              console.log('[重试] ⚠️ 刷新后仍是强制手机验证，需要切换代理');
              throw new Error('NEED_PROXY_SWITCH');
            } else if (pageState === 'error') {
              console.log('[重试] ⚠️ 页面状态检测失败，继续重试');
            } else {
              console.log(`[重试] ✓ 页面状态: ${pageState}，继续执行`);
            }
            
          } catch (reloadError) {
            // 如果是特殊错误，向上抛出
            if (reloadError.message === 'RETRY_REGISTRATION' || reloadError.message === 'NEED_PROXY_SWITCH') {
              throw reloadError;
            }
            console.warn('[重试] 页面刷新警告:', reloadError.message);
          }
        }
      }
    }
    
    console.error(`[重试] ❌ ${fnName} 在 ${maxRetries} 次尝试后仍然失败`);
    throw lastError;
  }

  // ========================================
  // 委托方法 - 调用操作类
  // ========================================
  
  /**
   * 检测当前页面状态 - 委托到 LoginStatusOperations
   */
  async detectCurrentPageState() {
    return await this.ops.loginStatus.detectCurrentPageState();
  }

  /**
   * FormOperations 委托方法
   */
  async clickSignUp() {
    return await this.ops.form.clickSignUp();
  }

  async clickCreateAccount() {
    return await this.ops.form.clickCreateAccount();
  }

  async fillUsername(name) {
    return await this.ops.form.fillUsername(name);
  }

  async fillEmail(email) {
    return await this.ops.form.fillEmail(email);
  }

  async fillPassword(password) {
    return await this.ops.form.fillPassword(password);
  }

  async fillPasswordConfirm(password) {
    return await this.ops.form.fillPasswordConfirm(password);
  }

  async submitRegistration() {
    return await this.ops.form.submitRegistration();
  }

  async fillEmailCode(code) {
    return await this.ops.form.fillEmailCode(code);
  }

  async submitEmailVerification(waitUntil = 'networkidle') {
    return await this.ops.form.submitEmailVerification(waitUntil);
  }

  async fillRegistrationFields(username, email, password) {
    return await this.ops.form.fillRegistrationFields(username, email, password);
  }

  async skipPhoneVerification() {
    return await this.ops.form.skipPhoneVerification();
  }

  async skipTwoStepVerification() {
    return await this.ops.form.skipTwoStepVerification();
  }

  async retryRegistration(accountInfo = {}) {
    return await this.ops.form.retryRegistration(accountInfo);
  }

  /**
   * NavigationOperations 委托方法
   */
  async handleCountrySelectionPopup() {
    return await this.ops.navigation.handleCountrySelectionPopup();
  }

  async handleTSVSetupHowtoPage() {
    return await this.ops.navigation.handleTSVSetupHowtoPage();
  }

  /**
   * LoginStatusOperations 委托方法
   */
  async detectTSVSetupHowtoPage() {
    return await this.ops.loginStatus.detectTSVSetupHowtoPage();
  }

  async detectLoginPage() {
    return await this.ops.loginStatus.detectLoginPage();
  }

  async detectForcedPhoneVerification() {
    return await this.ops.loginStatus.detectForcedPhoneVerification();
  }

  async detectTwoStepVerification() {
    return await this.ops.loginStatus.detectTwoStepVerification();
  }

  async detectPuzzlePage() {
    return await this.ops.loginStatus.detectPuzzlePage();
  }

  async detectUnusualActivityError() {
    return await this.ops.loginStatus.detectUnusualActivityError();
  }

  /**
   * 错误创建
   */
  createError(error) {
    // Normalize to object with message and logID (CustomError expects an object)
    const msg = (error && (error.message || error.toString())) || 'Unknown error';
    const logID = (error && error.logID) || null;
    throw new CustomError({ message: msg, logID });
  }

  /**
   * 更新配置
   */
  updateRegisterConfig(fn) {
    fn(this.config);
  }

  /**
   * ============================================
   * 主注册流程
   * ============================================
   */
  async execute() {
    try {
      this.tasklog({ logID: 'REGISTER_START', message: '开始注册流程', account: this.accountInfo.user });
      
      // 1. 先导航到 Google 获取浏览器语言（如果未指定）
      if (!this.config.language) {
        this.tasklog({ logID: 'GET_LANGUAGE', message: '获取浏览器语言' });
        try {
          await this.page.goto('https://www.google.com/', {
            timeout: 15000,  // 减少超时时间
            waitUntil: 'domcontentloaded'
          });
          
          const language = await this.page.evaluate(() => navigator.language);
          this.config.language = language;
          this.tasklog({ logID: 'LANGUAGE_DETECTED', message: `检测到语言: ${language}` });
        } catch (error) {
          console.warn('[语言检测] Google访问超时，使用默认语言 en-US');
          this.tasklog({ logID: 'GET_LANGUAGE', message: 'Google访问超时，使用默认语言 en-US' });
          this.config.language = 'en-US';
        }
      }
      
      // 2. 根据语言导航到对应的 sell.amazon 页面
      const language = this.config.language || 'en-US';
      const sellUrl = this.getSellUrlByLanguage(language);
      
      this.tasklog({ logID: 'NAVIGATE_SELL', message: `导航到卖家中心: ${sellUrl}` });
      console.log('[导航] 正在打开卖家中心页面...');
      
      try {
        await this.page.goto(sellUrl, {
          timeout: 60000,
          waitUntil: 'domcontentloaded'  // 改用domcontentloaded，更快且更可靠
        });
        console.log('[导航] ✓ 卖家中心页面加载成功');
      } catch (gotoError) {
        console.error('[导航] ❌ 首次导航失败，尝试重试...', gotoError.message);
        this.tasklog({ logID: 'NAVIGATE_RETRY', message: '首次导航失败，正在重试...' });
        
        // 重试一次
        await this.page.goto(sellUrl, {
          timeout: 60000,
          waitUntil: 'domcontentloaded'
        });
        console.log('[导航] ✓ 重试后页面加载成功');
      }
      
      await this.page.waitForTimeout(utilRandomAround(3000, 5000));
      
      // 检测并处理站点选择弹窗（首次访问可能出现）
      await this.handleCountrySelectionPopup();
      
      // 3. 点击注册按钮（带重试）
      await this.withRetry(
        () => this.clickSignUp(),
        '点击SignUp按钮'
      );
      
      await this.withRetry(
        () => this.clickCreateAccount(),
        '点击CreateAccount按钮'
      );
      
      // 4. 生成用户名和密码
      const username = utilEmailToName(this.accountInfo.user);
      if (!this.accountInfo.password) {
        this.accountInfo.password = utilGeneratePassword(username);
      }
      
      // 5. 填写注册表单（带重试）
      // 5. 填写注册表单（带重试）
      await this.withRetry(
        () => this.fillRegistrationFields(username, this.accountInfo.user, this.accountInfo.password),
        '填写注册表单'
      );
      
      // 6. 提交注册（带重试）
      this.registerTime = Date.now();
      await this.withRetry(
        () => this.submitRegistration(),
        '提交注册'
      );
      
      // 等待页面稳定，让captcha有机会加载
      await this.page.waitForTimeout(utilRandomAround(2000, 3000));
      
      // 7. 处理 Captcha（如果存在）
      this.tasklog({ message: '开始检测验证码...', logID: 'RG-Info-Operate' });
      const hasCaptcha = await this.checkCaptcha();
      console.log('[注册] 验证码检测结果:', hasCaptcha);
      
      if (hasCaptcha) {
        this.updateRegisterConfig(conf => { conf.isCaptcha = true; });
        this.tasklog({ message: '需要人机验证', logID: 'Warn-Info' });
        await this.solveCaptcha();
        this.tasklog({ message: '人机验证完成', logID: 'RG-Info-Operate' });
        
        // 异步监控验证码是否真正完成（后台运行，不阻塞主流程）
        await this.monitorCaptchaCompletion();
        
        // ⏳ 等待页面跳转回注册界面
        await this.page.waitForTimeout(utilRandomAround(3000, 5000));
      } else {
        this.tasklog({ message: '无需人机验证', logID: 'RG-Info-Operate' });
      }
      
      // ✅ 在邮箱验证前检查异常活动错误
      // （验证码提交后跳回注册页，此时异常活动错误会显示在邮箱框上方）
      await this.checkForAnomalies('开始邮箱验证前');
      
      // 8. 邮箱验证（带重试）
      const emailCode = await this.withRetry(
        () => this.getEmailVerificationCode(),
        '获取邮箱验证码'
      );
      
      await this.withRetry(
        () => this.fillEmailCode(emailCode),
        '填写邮箱验证码'
      );
      
      await this.withRetry(
        () => this.submitEmailVerification(),
        '提交邮箱验证'
      );
      
      // 8.5 等待页面稳定
      await this.page.waitForTimeout(utilRandomAround(2000, 3000));
      
      // 8.6 检查是否出现新的Captcha（邮箱验证后可能出现）
      if (await this.checkCaptcha()) {
        console.log('[注册] ⚠️ 邮箱验证后出现Captcha，开始处理...');
        this.updateRegisterConfig(conf => { conf.isCaptcha = true; });
        this.tasklog({ message: '邮箱验证后需要人机验证', logID: 'Warn-Info' });
        await this.solveCaptcha();
        this.tasklog({ message: '人机验证完成', logID: 'RG-Info-Operate' });
        
        // 异步监控验证码是否真正完成（后台运行，不阻塞主流程）
        await this.monitorCaptchaCompletion();
        
        // 验证完成后再次等待
        await this.page.waitForTimeout(utilRandomAround(2000, 3000));
      }
      
      // 9. 检查注册状态（包括2FA设置、手机验证等）
      const status = await this.ops.state.checkRegistrationStatus({
        detectTwoStepVerification: this.detectTwoStepVerification.bind(this),
        detectForcedPhoneVerification: this.detectForcedPhoneVerification.bind(this)
      });
      
      switch (status) {
        case 201: // 2FA setup page (注册成功，进入2FA绑定)
          if (this.config.enable2FA) {
            console.log('[注册] ✅ 注册成功，开始2FA绑定流程...');
            await this.handle2FASetup();
          } else {
            console.log('[注册] ✅ 注册成功（未启用2FA）');
          }
          break;
          
        case 301: // Need to navigate to 2FA manually
          if (this.config.enable2FA) {
            console.log('[注册] ✅ 注册成功，需要手动导航到2FA页面...');
            await this.handle2FAManualSetup();
          }
          break;
          
        case 401: // 检测到强制手机验证或其他验证问题
          console.log('[注册] ⚠️ 检测到验证问题，判断是否需要切换代理...');
          
          // 检查是否是强制手机验证（需要切换代理）
          // 禁用自动代理切换 - 每次都创建额外环境
          // if (await this.detectForcedPhoneVerification()) {
          //   console.log('[注册] ⚠️ 确认为强制手机验证，尝试切换代理重试...');
          //   const switchResult = await this.ops.nav.switchProxyAndRetry(this.config);
          //   if (switchResult.success) {
          //     console.log('[注册] ✓ 代理切换成功，重新开始注册流程...');
          //     this.isRetryingRegistration = true;
          //     return await this.execute();
          //   } else {
          //     console.error('[注册] ❌ 代理切换失败，标记为失败');
          //     throw new Error('强制手机验证无法绕过：' + switchResult.error);
          //   }
          // } else {
            // 普通验证问题，尝试重试
            console.log('[注册] 尝试重试验证流程...');
            await this.retryRegistration();
            const retryStatus = await this.ops.state.checkRegistrationStatus({
              detectTwoStepVerification: this.detectTwoStepVerification.bind(this),
              detectForcedPhoneVerification: this.detectForcedPhoneVerification.bind(this)
            });
            
            switch (retryStatus) {
              case 201:
                if (this.config.enable2FA) {
                  await this.handle2FASetup();
                }
                break;
              case 301:
                if (this.config.enable2FA) {
                  await this.handle2FAManualSetup();
                }
                break;
              case 401:
                this.updateRegisterConfig(conf => {
                  conf.notUseEmail = this.accountInfo.user;
                });
                this.createError({ message: '注册失败', logID: 'Error-Info' });
                break;
            }
          // }
          break;
      }
      
      // 10. 地址绑定（如果启用）
      if (this.config.bindAddress) {
        this.tasklog({ logID: 'ADDRESS_BIND', message: '准备绑定地址' });
        await this.bindAddress();
      }
      
      this.tasklog({ logID: 'REGISTER_SUCCESS', message: '注册完成', account: this.accountInfo.user });
      await this.handleRegisterSuccess();
      return {
        success: true,
        account: {
          userEmail: this.accountInfo.user,
          userPass: this.accountInfo.password,
          userName: this.accountInfo.name,
          otpSecret: this.accountInfo.otpSecret
        },
        registerSuccess: true,
        otpSuccess: !!this.accountInfo.otpSecret,
        addressBound: this.config.bindAddress === true,
        logs: this.logs
      };
      
    } catch (error) {
      // ⚠️ 特殊错误需要重新抛出给主进程处理，不能被转成返回值
      if (error.message === 'UNUSUAL_ACTIVITY_ERROR_RETRY' && error.unusualActivityRetry) {
        console.log('[注册] 🔴 捕获到异常活动错误，重新抛出给主进程处理');
        throw error;
      }
      
      if (error.message === 'PUZZLE_PAGE_DETECTED_RETRY' && error.puzzleRetry) {
        console.log('[注册] 🔴 捕获到Puzzle错误，重新抛出给主进程处理');
        throw error;
      }
      
      // 如果检测到需要切换代理的情况
      // 禁用自动代理切换 - 每次都创建额外环境
      // if (error.message === 'NEED_PROXY_SWITCH' && !this.isRetryingRegistration) {
      //   console.log('[注册] 🔄 检测到需要切换代理，尝试切换代理并重新注册...');
      //   const switchResult = await this.switchProxyAndRetry();
      //   if (switchResult.success) {
      //     console.log('[注册] ✓ 代理切换成功，重新开始注册流程...');
      //     this.isRetryingRegistration = true;
      //     this.registerTime = Date.now();
      //     return await this.execute();
      //   } else {
      //     console.error('[注册] ❌ 代理切换失败:', switchResult.error);
      //     throw new Error('代理切换失败：' + switchResult.error);
      //   }
      // }
      
      // 如果是登录页面检测触发的重新注册请求
      if (error.message === 'RETRY_REGISTRATION' && !this.isRetryingRegistration) {
        console.log('[注册] 🔄 检测到登录页面，重新执行注册流程...');
        this.isRetryingRegistration = true;
        
        // 初始化重试计数器
        if (!this.retryRegistrationCount) {
          this.retryRegistrationCount = 0;
        }
        this.retryRegistrationCount++;
        
        // 最多重试2次，防止无限循环
        const MAX_REGISTRATION_RETRIES = 2;
        if (this.retryRegistrationCount > MAX_REGISTRATION_RETRIES) {
          const errorMsg = `注册失败：重新执行注册流程已失败 ${this.retryRegistrationCount} 次，放弃重试`;
          console.error('[注册] ❌ ' + errorMsg);
          this.tasklog({ logID: 'REGISTER_ERROR', message: errorMsg });
          throw new Error(errorMsg);
        }
        
        // 重置部分状态并重试
        this.registerTime = Date.now();
        console.log(`[注册] 📝 开始第 ${this.retryRegistrationCount} 次重新注册尝试...`);
        
        // 重新执行注册流程
        return await this.execute();
      }
      
      console.error('注册失败:', error);
      this.tasklog({ logID: 'REGISTER_ERROR', message: `注册失败: ${error.message}` });
      
      await this.handleRegisterFailure(error);
      return {
        success: false,
        error: error.message,
        account: {
          userEmail: this.accountInfo.user,
          userPass: this.accountInfo.password,
          userName: this.accountInfo.name,
          otpSecret: this.accountInfo.otpSecret || null
        },
        registerSuccess: false,
        otpSuccess: false,
        addressBound: false,
        logs: this.logs
      };
    } finally {
      try {
        await this.ops.cleanup.ensureFinalCleanup({
          lastOutcome: this._lastOutcome || 'failure',
          autoDeleteOnFailure: this.autoDeleteOnFailure,
          accountInfo: this.accountInfo,
          accountManagerAPI: this.config.accountManagerAPI,
          page: this.page,
          browser: this.config.browser,
          hubstudio: this.config.hubstudio,
          containerCode: this.config.containerCode
        });
      } catch (finalErr) {
        console.warn('[清理] 最终清理失败:', finalErr && finalErr.message ? finalErr.message : finalErr);
      }
    }
  }

  /**
   * 检测页面上的异常活动错误
   * ⚠️ 只检测异常活动错误，不检测 Puzzle（Puzzle 由 solveCaptcha 内部处理）
   * 在验证码提交后可能回到注册页并出现异常活动错误
   * 如果检测到异常则直接抛出错误（由execute的catch块处理）
   * 
   * @param {string} step - 当前步骤名称，用于日志
   * @throws {Error} 如果检测到异常活动错误
   */
  async checkForAnomalies(step = '未知步骤') {
    try {
      console.log(`\n[异常检测] ========== 在"${step}"检查异常活动错误 ==========`);
      
      // ✅ 只检测异常活动错误
      console.log('[异常检测] 检测异常活动错误...');
      const hasUnusualActivity = await this.detectUnusualActivityError();
      if (hasUnusualActivity) {
        console.log('[异常检测] ❌ 检测到异常活动错误！准备执行恢复流程...');
        this.tasklog({ 
          message: `在"${step}"检测到异常活动错误，执行恢复流程`, 
          logID: 'Warn-Info' 
        });
        await this.ops.captcha.handleUnusualActivityError();
        // handleUnusualActivityError 会抛出错误
        return;
      }
      
      console.log(`[异常检测] ✅ 在"${step}"未检测到异常活动，继续流程\n`);
      
    } catch (error) {
      // 这里捕获的都是需要重新抛出的特殊错误
      console.log(`[异常检测] 🔴 检测到需要处理的错误: ${error.message}`);
      throw error;
    }
  }

  /**
   * 根据语言获取对应的 sell.amazon URL
   */
  getSellUrlByLanguage(language) {
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
    
    return languageMap[language] || 'https://sell.amazon.com';
  }

  /**
   * ============================================
   * 语言选择和导航
   * ============================================
   */
  async selectLanguage() {
    // 先模拟人类浏览页面
    await scrollDownAndUp(this.page);
    await this.page.waitForTimeout(utilRandomAround(5000, 7500));
    
    const languageSelect = this.page.locator(
      'button[data-popup-id="footer-nav-country-picker-popup"]'
    );
    await languageSelect.waitFor();
    
    await languageSelect.evaluate(el => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    
    await this.page.waitForTimeout(utilRandomAround(5000, 7500));
    this.tasklog({ message: '选择语言', logID: 'RG-Info-Operate' });
    
    return this.clickElement(languageSelect, {
      title: '桌面端，主站，选择语言'
    });
  }

  async goToSellRegister() {
    await this.page.waitForTimeout(utilRandomAround(3000, 5000));
    this.tasklog({ message: '进入主站', logID: 'RG-Info-Operate' });
    
    return this.clickElement(
      this.page.locator('a[href*="https://sell.amazon.com?initialSessionID"]'),
      {
        title: '桌面端，主站，进入主站',
        waitForURL: this.config.language === 'en-US'
      }
    );
  }















  /**
   * Puzzle 页面检测与恢复
   * ============================================
   */

  /**
   * 处理Puzzle页面恢复流程
   * 1. 关闭当前浏览器
   * 2. 删除浏览器环境
   * 3. 通知主进程进行重新注册
   */
  
  /**
   * ============================================
   * Captcha 处理
   * ============================================
   */


  /**
   * ============================================
   * Captcha 处理 - 使用独立模块
   * ⚠️ 请勿修改此处代码！Captcha逻辑在 captchaHandler.js 中
   * ============================================
   */
  
  /**
   * 获取或创建Captcha处理器实例
   */
  getCaptchaHandler() {
    if (!this.captchaHandler) {
      this.captchaHandler = new CaptchaHandler(
        this.page,
        this.tasklog.bind(this),
        this.registerTime
      );
    }
    return this.captchaHandler;
  }

  /**
   * 获取或创建Canvas图片验证码处理器实例
   * @returns {CaptchaCanvasCapture} Canvas验证码处理器
   */
  getCaptchaCanvasCaptureHandler() {
    if (!this.captchaCanvasCapture) {
      // yescaptcha clientKey（需要根据实际配置调整）
      const clientKey = this.config.yescaptchaClientKey || '0336ef0e8b28817fc0a209170829f1c43cefee7481336';
      this.captchaCanvasCapture = new CaptchaCanvasCapture(clientKey);
    }
    return this.captchaCanvasCapture;
  }
  
  /**
   * 检测是否需要处理Captcha
   * 委托给独立的CaptchaHandler模块
   */
  async checkCaptcha() {
    return this.getCaptchaHandler().checkCaptcha();
  }

  /**
   * 异步监控验证码是否真正完成
   * 提交验证码后，异步检测1分钟内是否还在验证界面
   * 如果1分钟后仍然在验证界面，说明验证失败，会自动处理失败流程
   * 
   * 注意：此方法返回立即返回（不等待监控完成），但监控会在后台进行
   */
  async monitorCaptchaCompletion() {
    try {
      console.log('[验证码监控] 开始异步监控验证码是否真正完成...');
      
      // 启动后台监控任务（不阻塞主流程）
      // 这个Promise不会被等待，但会在后台独立运行
      (async () => {
        try {
          // 监控时间：1分钟
          const monitorDurationMs = 60000;
          const checkIntervalMs = 5000; // 每5秒检查一次
          const startTime = Date.now();
          
          while (Date.now() - startTime < monitorDurationMs) {
            try {
              // 检查是否还在Captcha界面
              const stillInCaptcha = await this.checkCaptcha();
              
              if (!stillInCaptcha) {
                console.log('[验证码监控] ✅ 验证码已成功完成，页面已离开验证界面');
                return;
              }
            } catch (checkError) {
              // 检查过程中出错（可能页面已关闭），停止监控
              console.log('[验证码监控] ℹ️ 监控检查过程出错，可能页面已关闭，停止监控:', checkError.message);
              return;
            }
            
            // 继续等待
            await this.page.waitForTimeout(checkIntervalMs);
          }
          
          // 如果1分钟后仍在验证界面，说明验证失败
          console.error('[验证码监控] ❌ 监控超时：1分钟后仍在验证界面，说明验证失败');
          this.tasklog({ 
            message: '验证码监控失败：提交后1分钟仍在验证界面，验证未通过', 
            logID: 'Error-Info' 
          });
          
          // 触发失败恢复流程
          // 这里我们不能直接抛出异常（因为不在主流程中），但可以记录状态
          try {
            this._captchaMonitorFailed = true;
            this._captchaFailureReason = '验证码监控超时：1分钟后仍在验证界面';
          } catch (e) {}
          
        } catch (error) {
          console.error('[验证码监控] 监控异常:', error.message);
          this.tasklog({ 
            message: `验证码监控异常: ${error.message}`, 
            logID: 'Error-Info' 
          });
          // 记录监控失败状态
          try {
            this._captchaMonitorFailed = true;
            this._captchaFailureReason = error.message;
          } catch (e) {}
        }
      })().catch(err => {
        // 捕获后台任务中的任何未处理异常
        console.error('[验证码监控] 后台任务未处理的异常:', err);
      });
      
    } catch (error) {
      console.error('[验证码监控] 设置监控失败:', error.message);
    }
  }

  /**
   * 底层统一关闭/停止/删除方法
   * - 负责按顺序尝试关闭 page -> browser -> hubstudio.stopBrowser
   * - 如果 deleteContainer 为 true，则尝试删除容器（deleteContainer 或 destroyContainer）
   * - 此方法可被需要立即清理并删除环境的恢复路径调用，也会被 finally 中的 _ensureFinalCleanup 间接调用
   */
  /**
   * 处理Captcha验证
   * 优先使用Canvas图片验证码处理器，降级到原有的CaptchaHandler
   */
  async solveCaptcha() {
    try {
      // 检测是否有Canvas图片验证码容器（Amazon的选择式图片验证）
      const canvasContainerExists = await Promise.race([
        this.page.locator('#cvf-aamation-container').count().then(c => c > 0),
        this.page.locator('#captcha-container').count().then(c => c > 0),
        Promise.resolve(false).then(() => new Promise(resolve => setTimeout(() => resolve(false), 1000)))
      ]);
      
      // 如果检测到Canvas容器，使用CaptchaCanvasCapture处理
      if (canvasContainerExists) {
        this.tasklog({ message: '🖼️ 检测到Canvas图片验证码，使用CaptchaCanvasCapture处理', logID: 'RG-Info-Operate' });
        const success = await this.handleImageCaptchaWithCanvasCapture();
        if (success) {
          return;
        }
        // 如果CaptchaCanvasCapture失败，降级到原有处理器
        this.tasklog({ message: '⚠️ CaptchaCanvasCapture处理失败，尝试使用CaptchaHandler...', logID: 'Warn-Info' });
      }
      
      // 使用原有的CaptchaHandler处理其他类型验证码
      return this.getCaptchaHandler().solveCaptcha();
      
    } catch (error) {
      this.tasklog({ message: `验证码处理异常: ${error.message}，尝试使用CaptchaHandler`, logID: 'Warn-Info' });
      // 异常时降级到原有处理器
      return this.getCaptchaHandler().solveCaptcha();
    }
  }

  /**
   * 使用Canvas图片验证码处理器处理Amazon图片验证
   * 专门针对Amazon的选择式图片验证（3x3网格）
   * 
   * @returns {Promise<boolean>} 是否成功完成验证
   */
  async handleImageCaptchaWithCanvasCapture() {
    try {
      this.tasklog({ message: '🖼️ 检测到图片验证码，使用CaptchaCanvasCapture处理...', logID: 'RG-Info-Operate' });
      
      // 1. 获取Canvas验证码处理器
      const captureHandler = this.getCaptchaCanvasCaptureHandler();
      
      // 2. 完整的验证流程：截图 -> 提取提示 -> 识别 -> 点击 -> 提交
      const result = await captureHandler.solveWithYescaptcha(this.page);
      
      if (!result || !result.success) {
        this.tasklog({ 
          message: `❌ Canvas验证码处理失败: ${result?.message || '未知错误'}`, 
          logID: 'Error-Info' 
        });
        return false;
      }
      
      this.tasklog({ 
        message: `✅ Canvas验证码已完成，识别到的目标: ${result.question}`, 
        logID: 'RG-Info-Operate' 
      });
      
      // 3. 点击识别出的目标位置
      if (result.solution && result.solution.label) {
        this.tasklog({ 
          message: `📍 开始点击识别的目标位置 (${result.solution.label})...`, 
          logID: 'RG-Info-Operate' 
        });
        
        await captureHandler.clickTargets(this.page, result.solution);
        
        this.tasklog({ 
          message: '✅ 所有目标位置已点击', 
          logID: 'RG-Info-Operate' 
        });
      }
      
      // 4. 提交验证
      this.tasklog({ 
        message: '🔄 正在提交验证...', 
        logID: 'RG-Info-Operate' 
      });
      
      await captureHandler.submitVerification(this.page);
      
      this.tasklog({ 
        message: '✅ 图片验证提交完成，等待页面响应...', 
        logID: 'RG-Info-Operate' 
      });
      
      // 5. 等待页面稳定（不在这里检查异常，因为页面还在加载跳转）
      await this.page.waitForTimeout(2000);
      
      return true;
    } catch (error) {
      this.tasklog({ 
        message: `❌ 图片验证码处理异常: ${error.message}`, 
        logID: 'Error-Info' 
      });
      
      // 验证失败，返回false但不中断流程，让主流程继续
      return false;
    }
  }

  /**
   * ============================================
   * 邮箱验证
   * ============================================
   */
  async getEmailVerificationCode() {
    // 检查是否有邮箱服务信息
    if (!this.emailServiceInfo || !this.emailServiceInfo.refresh_token) {
      this.tasklog({ 
        message: '未配置邮箱服务信息，无法自动获取验证码。请手动输入验证码。', 
        logID: 'Warn-Info' 
      });
      throw new Error('未配置邮箱服务信息，无法自动获取验证码');
    }
    
    this.tasklog({ message: '等待邮件验证码...', logID: 'RG-Info-Operate' });
    this.tasklog({ message: `记录时间: ${new Date(this.registerTime).toLocaleString('zh-CN')} (${this.registerTime})`, logID: 'RG-Info-Operate' });
    
    const { refresh_token, client_id } = this.emailServiceInfo;
    
    try {
      // 使用 msGraphMail 模块的 waitForVerificationEmail 方法
      const code = await msGraphMail.waitForVerificationEmail(
        this.accountInfo.user,
        refresh_token,
        client_id,
        {
          maxRetries: 24,           // 最多重试24次 (2分钟)
          retryInterval: 5000,      // 每5秒检查一次
          searchKeyword: '',        // 不使用搜索，直接获取最新邮件
          fromFilter: 'amazon',     // 过滤 Amazon 发件人
          startTime: this.registerTime, // 关键：只获取提交注册后的邮件
          onProgress: (progress) => {
            // 只记录重要信息，避免日志过多
            if (progress.type === 'success' || progress.type === 'error') {
              this.tasklog({ 
                message: progress.message, 
                logID: progress.type === 'success' ? 'RG-Info-Operate' : 'Warn-Info' 
              });
            }
          }
        }
      );
      
      this.tasklog({ message: `获取邮箱验证码成功: ${code}`, logID: 'RG-Info-Operate' });
      return code;
      
    } catch (error) {
      this.tasklog({ 
        message: `获取邮箱验证码失败: ${error.message}`, 
        logID: 'Error-Info' 
      });
      throw error;
    }
  }

  /**
   * ============================================
   * 注册状态检查和处理
   * ============================================
   */
  /**
   * ============================================
   * 2FA 处理
   * ============================================
   */
  async handle2FASetup() {
    this.ops.form.logRegistrationSuccess(this.accountInfo);
    
    // 正常的2FA绑定流程（直接在2FA设置页面）
    await this.ops.twoFactorAuth.expandAuthenticatorApp();
    await this.ops.twoFactorAuth.get2FASecret();
    this.tasklog({ message: '2FAToken获取成功', logID: 'RG-Info-Operate' });
    
    const otp = await this.ops.twoFactorAuth.getStableTOTP();
    await this.ops.twoFactorAuth.fill2FACode(otp.code);
    await this.ops.twoFactorAuth.submit2FA();
    
    this.tasklog({
      message: '绑定2FA成功',
      logID: 'RG-Bind-Otp',
      account: {
        userEmail: this.accountInfo.user,
        otpSecret: this.accountInfo.otpSecret
      }
    });
    
    // 2FA完成后跳转到首页
    this.tasklog({ message: '2FA完成，跳转到首页', logID: 'RG-Info-Operate' });
    try {
      await this.page.goto('https://www.amazon.com', { timeout: 15000 });
      await this.page.waitForTimeout(utilRandomAround(2000, 3000));
      
      // 检测并处理站点选择弹窗
      await this.handleCountrySelectionPopup();
    } catch (error) {
      this.tasklog({ message: '跳转首页失败，继续执行', logID: 'RG-Info-Operate' });
    }
  }

  async handle2FAManualSetup() {
    this.ops.form.logRegistrationSuccess(this.accountInfo);
    
    // 检查是否在Two-Step Verification页面
    if (await this.ops.loginStatus.detectTwoStepVerification()) {
      this.tasklog({ message: '检测到Two-Step Verification页面，准备跳过', logID: 'RG-Info-Operate' });
      await this.ops.form.skipTwoStepVerification();
      await this.page.waitForTimeout(utilRandomAround(2000, 3000));
    }
    // 或者检查是否在手机绑定页面（无OTP认证的情况）
    else {
      const currentUrl = this.page.url();
      if (currentUrl.includes('ap/cvf/verify')) {
        this.tasklog({ message: '检测到手机绑定页面（无OTP认证），准备跳过', logID: 'RG-Info-Operate' });
        await this.ops.form.skipPhoneVerification();
        // 跳过后等待页面稳定
        await this.page.waitForTimeout(utilRandomAround(2000, 3000));
      }
    }
    
    // 注册完成后先等待页面稳定，然后导航到首页
    this.tasklog({ message: '等待页面稳定后导航到首页', logID: 'RG-Info-Operate' });
    await this.page.goto('https://www.amazon.com', { timeout: 60000, waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(utilRandomAround(2000, 3000));
    
    // 检测并处理站点选择弹窗
    await this.handleCountrySelectionPopup();
    
    // 确保个人中心元素可见（处理简化版首页）
    await this.ensureAccountMenuVisible();
    
    // 进入个人中心设置
    await this.ops.navigation.goToAccountSettings();
    await this.ops.navigation.goToLoginSecurity();
    await this.ops.navigation.goToStepVerification();
    await this.ops.twoFactorAuth.expandAuthenticatorApp();
    await this.ops.twoFactorAuth.get2FASecret();
    this.tasklog({ message: '2FAToken获取成功', logID: 'RG-Info-Operate' });
    
    const otp = await this.ops.twoFactorAuth.getStableTOTP();
    await this.ops.twoFactorAuth.fill2FACode(otp.code);
    
    this.registerTime = Date.now();
    await this.ops.twoFactorAuth.submit2FA();
    
    const code = await this.ops.emailVerification.getEmailVerificationCode();
    await this.ops.twoFactorAuth.fill2FAEmailCode(code);
    await this.ops.emailVerification.submitEmailVerification('load');
    
    this.tasklog({
      message: '绑定2FA成功',
      logID: 'RG-Bind-Otp',
      account: {
        userEmail: this.accountInfo.user,
        otpSecret: this.accountInfo.otpSecret
      }
    });
    
    // 提交2FA确认，如果出现TSV设置说明页会在该方法中处理
    await this.ops.twoFactorAuth.submitTwoStepVerification();
    
    // 如果没有出现TSV，继续原有流程：地址绑定或跳转首页
    if (!this.config.bindAddress) {
      await this.ops.navigation.goToNavLogo();
    }
    // 如果要绑定地址，不跳转，直接在当前页面继续后续流程
  }

  async get2FASecret() {
    this.tasklog({ message: '等待绑定2FA', logID: 'RG-Info-Operate' });
    const text2fa = await this.page
      .locator('#sia-auth-app-formatted-secret')
      .innerText();
    this.accountInfo.otpSecret = text2fa.replace(/\s+/g, '');
  }

  async getStableTOTP() {
    await this.page.waitForTimeout(utilRandomAround(20000, 25000));
    
    const { remainingTime } = await utilGenerateTOTP(this.accountInfo.otpSecret);
    
    if (remainingTime < 4) {
      await this.page.waitForTimeout(utilRandomAround(5000, 7000));
    }
    
    return utilGenerateTOTP(this.accountInfo.otpSecret);
  }

  async expandAuthenticatorApp() {
    this.tasklog({ message: '选择验证器应用选项并展开配置', logID: 'RG-Info-Operate' });
    
    // 1. 先尝试找到并点击"Use an authenticator app"的radio按钮
    const radioSelectors = [
      // 按优先级排列
      'label:has-text("Use an authenticator app") input[type="radio"]',
      'input[type="radio"][value*="totp"]',
      'input[type="radio"][value*="app"]',
      'input[name*="otpDeviceContext"][value*="totp"]',
      'input[type="radio"]:nth-of-type(2)',  // 通常第二个radio是认证器应用选项
    ];
    
    let radioFound = false;
    for (const selector of radioSelectors) {
      try {
        const radio = this.page.locator(selector).first();
        const count = await radio.count().then(c => c > 0);
        
        if (count) {
          // 检查radio是否已选中
          const isChecked = await radio.isChecked().catch(() => false);
          
          if (!isChecked) {
            this.tasklog({ message: '点击选择"使用验证器应用"选项', logID: 'RG-Info-Operate' });
            await radio.click({ timeout: 5000 });
            await this.page.waitForTimeout(utilRandomAround(800, 1200));
          }
          
          radioFound = true;
          break;
        }
      } catch (error) {
        // 继续尝试下一个选择器
        console.log(`[expandAuthenticatorApp] 选择器 "${selector}" 失败:`, error.message);
      }
    }
    
    // 2. 展开accordion - 无论radio点击成功与否都尝试展开
    try {
      const box = this.page.locator('#sia-otp-accordion-totp-header');
      const boxExists = await box.count().then(c => c > 0);
      
      if (boxExists) {
        const expanded = await box.getAttribute('aria-expanded').catch(() => 'false');
        
        if (expanded === 'false') {
          this.tasklog({ message: '展开验证器应用配置区域', logID: 'RG-Info-Operate' });
          await box.click({ timeout: 5000 });
          await this.page.waitForTimeout(utilRandomAround(800, 1200));
        } else {
          this.tasklog({ message: '验证器应用配置已展开', logID: 'RG-Info-Operate' });
        }
      }
    } catch (error) {
      this.tasklog({ message: `展开accordion失败: ${error.message}`, logID: 'Warn-Info' });
    }
  }

  async fill2FACode(code) {
    this.tasklog({ message: '填写2FA验证码', logID: 'RG-Info-Operate' });
    
    const codeInput = this.page.locator('#ch-auth-app-code-input');
    
    // 确保元素可见
    try {
      await codeInput.waitFor({ state: 'visible', timeout: 10000 });
    } catch (e) {
      this.tasklog({ message: `2FA验证码输入框未出现（10秒超时）: ${e.message}`, logID: 'Warn-Info' });
      throw new Error(`2FA验证码输入框不可见: ${e.message}`);
    }
    
    // 滚动到输入框
    await codeInput.evaluate(el => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    
    await this.page.waitForTimeout(utilRandomAround(500, 1000));
    
    return this.fillInput(
      codeInput,
      code,
      {
        title: '桌面端，主站，填写2FA验证码',
        skipVisibilityCheck: true  // 已在上面做过waitFor和scroll，跳过重复检查
      }
    );
  }

  async submit2FA() {
    this.tasklog({ message: '添加2FA', logID: 'RG-Info-Operate' });
    
    const submitButton = this.page.locator('#ch-auth-app-submit');
    await submitButton.waitFor();
    
    // 滚动到按钮位置
    await submitButton.evaluate(el => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    
    await this.page.waitForTimeout(utilRandomAround(1000, 1500));
    
    return this.clickElement(submitButton, {
      title: '桌面端，主站，添加2FA',
      waitForURL: true
    });
  }

  async fill2FAEmailCode(code) {
    this.tasklog({ message: '填写开启2FA邮件验证码', logID: 'RG-Info-Operate' });
    
    const emailCodeInput = this.page.locator('#input-box-otp');
    
    // 确保元素可见
    try {
      await emailCodeInput.waitFor({ state: 'visible', timeout: 10000 });
    } catch (e) {
      this.tasklog({ message: `2FA邮件验证码输入框未出现（10秒超时）: ${e.message}`, logID: 'Warn-Info' });
      throw new Error(`2FA邮件验证码输入框不可见: ${e.message}`);
    }
    
    // 滚动到输入框
    await emailCodeInput.evaluate(el => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    
    await this.page.waitForTimeout(utilRandomAround(500, 1000));
    
    return this.fillInput(emailCodeInput, code, {
      title: '桌面端，主站，填写开启2FA邮件验证码',
      skipVisibilityCheck: true  // 已在上面做过waitFor和scroll，跳过重复检查
    });
  }

  async submitTwoStepVerification() {
    // 等待确认页面加载
    await this.page.waitForTimeout(utilRandomAround(1000, 1500));
    
    // 检查确认按钮是否存在（设置5秒超时）
    const enableMfaFormSubmit = this.page.locator('#enable-mfa-form-submit');
    const isButtonVisible = await enableMfaFormSubmit.isVisible({ timeout: 5000 }).catch(() => false);
    
    // 如果确认页面没有出现，直接返回继续后续流程
    if (!isButtonVisible) {
      this.tasklog({ message: '未出现两步验证确认页面，继续后续流程', logID: 'RG-Info-Operate' });
      return;
    }
    
    // 确认页面出现了，直接点击提交按钮进入主页
    this.tasklog({ message: '检测到两步验证确认页面，直接提交进入主页', logID: 'RG-Info-Operate' });
    
    // 滚动到按钮位置
    await enableMfaFormSubmit.evaluate(el => {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    
    // 点击确认按钮进入主页
    this.tasklog({ message: '点击确认按钮进入主页', logID: 'RG-Info-Operate' });
    
    // 不使用 waitForURL: true，因为可能会重定向到TSV页面或其他页面
    // 改为手动点击并等待页面稳定
    await this.clickElement(enableMfaFormSubmit, {
      title: '两步验证确认页面，点击按钮进入主页',
      waitForURL: false
    });
    
    // 等待页面加载和渲染完成
    console.log('[submitTwoStepVerification] 点击后等待页面加载...');
    await this.page.waitForTimeout(utilRandomAround(2000, 3000));
    
    // 点击按钮后，立即检测是否出现TSV设置说明页
    console.log('[submitTwoStepVerification] 开始检测TSV设置说明页...');
    const currentUrl = this.page.url();
    console.log('[submitTwoStepVerification] 当前URL:', currentUrl);
    
    if (await this.detectTSVSetupHowtoPage()) {
      console.log('[submitTwoStepVerification] ✅ 检测到TSV设置说明页，进行处理');
      this.tasklog({ message: '检测到Two-Step Verification设置说明页，跳过进入首页', logID: 'RG-Info-Operate' });
      
      // 直接导航到亚马逊首页，不点击TSV页面的按钮
      await this.handleTSVSetupHowtoPage();
      
      // 等待首页加载
      await this.page.waitForTimeout(utilRandomAround(2000, 3000));
      
      // 检测并处理站点选择弹窗
      await this.handleCountrySelectionPopup();
      
      console.log('[submitTwoStepVerification] ✅ TSV处理完成，已进入首页');
      return;
    }
    
    console.log('[submitTwoStepVerification] ❌ 未检测到TSV设置说明页，已进入主页');
    return;
  }

  /**
   * 检测并处理OTP完成后可能出现的TSV设置说明页
  /**
   * 跳过手机验证（点击取消按钮）
   * 当邮箱验证后进入手机绑定页面但没有OTP认证时使用
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
   * 用于注册成功后出现的手机绑定页面
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
   * 确保个人中心菜单可见
   * 处理首页简化版本没有个人中心的情况
   */
  async ensureAccountMenuVisible() {
    try {
      this.tasklog({ message: '检查个人中心菜单是否可见...', logID: 'RG-Info-Operate' });
      
      // 检查个人中心元素是否存在且可见
      const accountMenu = this.page.locator('a[data-nav-role="signin"]').first();
      const isVisible = await accountMenu.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (isVisible) {
        this.tasklog({ message: '个人中心菜单可见', logID: 'RG-Info-Operate' });
        return true;
      }
      
      // 如果不可见，可能是简化版首页，刷新页面
      this.tasklog({ message: '个人中心菜单不可见，可能是简化版首页，刷新页面...', logID: 'Warn-Info' });
      await this.page.reload({ waitUntil: 'domcontentloaded' });
      await this.page.waitForTimeout(utilRandomAround(2000, 3000));
      
      // 再次检查
      const isVisibleAfterReload = await accountMenu.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (isVisibleAfterReload) {
        this.tasklog({ message: '刷新后个人中心菜单已可见', logID: 'RG-Info-Operate' });
        return true;
      }
      
      // 如果还是不可见，再刷新一次
      this.tasklog({ message: '个人中心菜单仍不可见，再次刷新...', logID: 'Warn-Info' });
      await this.page.reload({ waitUntil: 'domcontentloaded' });
      await this.page.waitForTimeout(utilRandomAround(2000, 3000));
      
      const isFinalVisible = await accountMenu.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (isFinalVisible) {
        this.tasklog({ message: '第二次刷新后个人中心菜单已可见', logID: 'RG-Info-Operate' });
        return true;
      }
      
      this.tasklog({ message: '警告：多次刷新后个人中心菜单仍不可见，继续尝试', logID: 'Warn-Info' });
      return false;
    } catch (error) {
      this.tasklog({ message: `检查个人中心菜单失败: ${error.message}`, logID: 'Warn-Info' });
      return false;
    }
  }

  /**
   * 检测并处理站点选择弹窗
   * 如果出现"Choosing your Amazon website"弹窗，点击"Go to Amazon.com"
   */
  async handleCountrySelectionPopup() {
    try {
      this.tasklog({ message: '检测站点选择弹窗...', logID: 'RG-Info-Operate' });
      
      // 等待一小段时间让弹窗有机会出现
      await this.page.waitForTimeout(1000);
      
      // 检测弹窗是否存在 - 查找包含"Choosing your Amazon website"的文本
      const popupText = await this.page.locator('text=Choosing your Amazon website').count().then(c => c > 0);
      
      if (!popupText) {
        // 尝试检测其他可能的弹窗标识
        const visitingText = await this.page.locator('text=Visiting from').count().then(c => c > 0);
        if (!visitingText) {
          this.tasklog({ message: '未检测到站点选择弹窗', logID: 'RG-Info-Operate' });
          return false;
        }
      }
      
      this.tasklog({ message: '检测到站点选择弹窗，准备点击美国站', logID: 'RG-Info-Operate' });
      
      // 查找"Go to Amazon.com"按钮
      const usButton = this.page.locator('button, a').filter({ hasText: /Go to Amazon\.com/i }).first();
      const buttonExists = await usButton.count().then(c => c > 0);
      
      if (buttonExists) {
        this.tasklog({ message: '找到"Go to Amazon.com"按钮，点击...', logID: 'RG-Info-Operate' });
        await usButton.click();
        await this.page.waitForTimeout(utilRandomAround(2000, 3000));
        this.tasklog({ message: '已切换到美国站', logID: 'RG-Info-Operate' });
        return true;
      }
      
      // 如果没找到精确按钮，尝试查找包含"Amazon.com"的按钮
      const alternativeButton = this.page.locator('button, a').filter({ hasText: /Amazon\.com(?!\.au)/i }).first();
      const altExists = await alternativeButton.count().then(c => c > 0);
      
      if (altExists) {
        this.tasklog({ message: '找到美国站按钮（备选），点击...', logID: 'RG-Info-Operate' });
        await alternativeButton.click();
        await this.page.waitForTimeout(utilRandomAround(2000, 3000));
        this.tasklog({ message: '已切换到美国站', logID: 'RG-Info-Operate' });
        return true;
      }
      
      this.tasklog({ message: '警告：检测到弹窗但未找到美国站按钮', logID: 'Warn-Info' });
      return false;
    } catch (error) {
      this.tasklog({ message: `处理站点选择弹窗失败: ${error.message}`, logID: 'Warn-Info' });
      return false;
    }
  }

  /**
   * ============================================
   * 重试注册
   * ============================================
   */
  async retryRegistration() {
    this.tasklog({ message: '需要绑定手机，尝试重新注册', logID: 'Warn-Info' });
    await this.page.waitForTimeout(utilRandomAround(1000, 1500));
    
    // Navigate back to registration page
    while (!this.page.url().includes('/ap/register?')) {
      await this.page.goBack();
      await this.page.waitForTimeout(utilRandomAround(1000, 1500));
    }
    
    await this.ops.form.fillPassword(this.accountInfo.password);
    await this.ops.form.fillPasswordConfirm(this.accountInfo.password);
    
    this.registerTime = Date.now();
    await this.submitRegistration();
    
    if (await this.checkCaptcha()) {
      await this.solveCaptcha();
    }
    
    const code = await this.ops.emailVerification.getEmailVerificationCode();
    await this.ops.emailVerification.fillEmailCode(code);
    await this.ops.emailVerification.submitEmailVerification();
  }

  /**
   * ============================================
   * 导航辅助方法
   * ============================================
   */
  async goToAccountSettings() {
    this.tasklog({ message: '打开个人中心', logID: 'RG-Info-Operate' });
    
    // 点击个人中心链接
    await this.clickElement(
      this.page.locator('a[data-nav-role="signin"]').first(),
      {
        title: '桌面端，主站，打开个人中心',
        waitForURL: true
      }
    );
    
    // 等待页面稳定
    await this.page.waitForTimeout(utilRandomAround(2000, 3000));
    
    // 检测是否进入登录页面
    if (await this.detectLoginPage()) {
      console.log('[注册] ⚠️ 点击个人中心后进入登录页面，说明注册未成功');
      
      // 如果还有重试机会，重新走注册流程
      if (!this.isRetryingRegistration) {
        console.log('[注册] ✓ 开始重新执行注册流程...');
        this.isRetryingRegistration = true;
        
        // 导航到sell页面重新开始
        const language = this.config.language || 'en-US';
        const sellUrl = this.getSellUrlByLanguage(language);
        await this.page.goto(sellUrl, {
          timeout: 60000,
          waitUntil: 'load'
        });
        
        // 抛出特殊错误，由execute方法的catch块重新执行整个流程
        throw new Error('RETRY_REGISTRATION');
      } else {
        throw new Error('注册失败：多次尝试后仍进入登录页面');
      }
    }
    
    this.tasklog({ message: '✓ 成功进入个人中心', logID: 'RG-Info-Operate' });
  }

  async goToLoginSecurity() {
    this.tasklog({ message: '打开安全中心', logID: 'RG-Info-Operate' });
    return this.clickElement(
      this.page.locator('a[href*="ap/cnep"]').first(),
      {
        title: '桌面端，主站，打开安全中心',
        waitForURL: true
      }
    );
  }

  async goToStepVerification() {
    this.tasklog({ message: '打开两步验证', logID: 'RG-Info-Operate' });
    await this.clickElement(
      this.page.locator('a[href*="/a/settings/approval/setup/register?"]'),
      {
        title: '桌面端，主站，打开两步验证',
        waitForURL: true
      }
    );
    
    // 等待页面加载
    await this.page.waitForTimeout(utilRandomAround(2000, 3000));
  }

  /**
   * ============================================
   * Event Emitter 请求邮箱/手机
   * ============================================
   */
  requestEmail(containerCode) {
    return new Promise(resolve => {
      nodeEmitter.once('RESPONSE_EMAIL', (info) => {
        resolve(info);
      });
      nodeEmitter.emit('REQUEST_EMAIL', containerCode);
    });
  }

  requestPhone(containerCode) {
    return new Promise(resolve => {
      nodeEmitter.once('RESPONSE_PHONE', (info) => {
        resolve(info);
      });
      nodeEmitter.emit('REQUEST_PHONE', containerCode);
    });
  }

  /**
   * ============================================
   * 辅助方法
   * ============================================
   */
  async clickElement(element, options) {
    const oldUrl = this.page.url();
    
    try {
      // 使用人类点击模拟（带鼠标轨迹）
      try {
        await humanClickLocator(this.page, element);
      } catch (humanClickError) {
        // 如果人类点击失败，回退到普通点击
        console.log('Human click failed, falling back to normal click:', humanClickError.message);
        await element.click({ delay: utilFluctuateAround(150) });
      }
      
      await this.page.waitForTimeout(utilRandomAround(2000, 5000));
      
      if (options.waitForURL) {
        await this.page.waitForURL(
          u => u.href !== oldUrl,
          { timeout: 120000 }
        );
        await this.page
          .waitForLoadState(options.waitUntil || 'load')
          .catch(() => {});
      }
    } catch (err) {
      // include the underlying error message to aid debugging
      const reason = err && err.message ? `: ${err.message}` : '';
      this.createError({
        message: `${options.title} 操作失败${reason}`,
        logID: 'Error-Info'
      });
    }
  }

  async fillInput(element, str, options = {}) {
    try {
      // 参数验证：确保str不是undefined或null
      if (str === undefined || str === null) {
        const errorMsg = `fillInput参数错误: str为${str} (${options.title || '未知操作'})`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
      
      // 转换为字符串（防止数字等其他类型）
      const inputStr = String(str);
      
      // 确保元素可见（如果没有设置 skipVisibilityCheck）
      if (!options.skipVisibilityCheck) {
        try {
          await element.waitFor({ state: 'visible', timeout: 5000 });
        } catch (e) {
          throw new Error(`元素不可见: ${e.message}`);
        }
        
        // 滚动到元素
        await element.evaluate(el => {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }
      
      // 使用逼真的人类打字模拟
      await this.page.waitForTimeout(
        options.preDelay || utilRandomAround(250, 500)
      );
      
      // 如果需要清空内容，先清空
      if (options.clearContent) {
        await element.click({ delay: utilRandomAround(150) });
        await this.page.keyboard.press('Control+A');
        await this.page.keyboard.press('Backspace');
        await this.page.waitForTimeout(utilRandomAround(200, 400));
      }
      
      // 点击输入框
      await element.click({ delay: utilRandomAround(150) });
      await this.page.waitForTimeout(200 + Math.random() * 300);
      
      // 偶尔会有鼠标移动（更逼真的人类行为）
      if (Math.random() < 0.15) {
        const box = await element.boundingBox();
        if (box) {
          await this.page.mouse.move(
            box.x + Math.random() * box.width * 0.5,
            box.y + Math.random() * box.height * 0.5,
            { steps: 3 }
          );
          await this.page.waitForTimeout(utilRandomAround(100, 300));
        }
      }
      
      // 逐字符输入，带随机延迟
      // 支持慢速按键模式（模拟真实按键事件）或快速 keyboard.type 模式
      const useSlowType = !!options.slowType || (options.minDelayMs !== undefined || options.maxDelayMs !== undefined);
      const minDelayMs = (options.minDelayMs !== undefined) ? options.minDelayMs : (useSlowType ? 500 : 50);
      const maxDelayMs = (options.maxDelayMs !== undefined) ? options.maxDelayMs : (useSlowType ? 2000 : 150);

      if (useSlowType) {
        // 慢速逐字，优先使用 element.press 以触发真实按键事件，失败退回到 element.type
        try {
          try { await element.click({ timeout: 3000 }); } catch (e) { /* ignore */ }
        } catch (e) { }

        for (const ch of inputStr.split('')) {
          const waitMs = utilRandomAround(minDelayMs, maxDelayMs);
          await this.page.waitForTimeout(waitMs);
          try {
            await element.press(ch);
          } catch (e) {
            try { await element.type(ch); } catch (e2) { /* ignore */ }
          }

          if (Math.random() < 0.05) {
            await this.page.waitForTimeout(Math.random() * 300);
          }
        }
      } else {
        for (const ch of inputStr.split('')) {
          await this.page.keyboard.type(ch, { delay: 50 + Math.random() * 120 });
          if (Math.random() < 0.05) {
            // 偶尔暂停，更自然
            await this.page.waitForTimeout(Math.random() * 300);
          }
        }
      }
      
      // 随机的"删除重填"行为（模拟用户输错了然后更正的情况）
      // 默认有小概率（10%）在当前输入字段进行删除重填
      const shouldRandomRetype = (Math.random() < 0.1 && inputStr.length > 2);

      // 如果上层显式要求在该字段强制执行删除重填（用于在一个页面的多个字段中只随机选择一个字段进行删除重填）
      const forceRetype = !!options.forceDeleteRetype;

      if (forceRetype || shouldRandomRetype) {
        const deleteCount = Math.floor(Math.random() * 3) + 1; // 删除1-3个字符
        const reType = inputStr.substring(inputStr.length - deleteCount);

        this.tasklog({ message: `执行删除重填: 删除 ${deleteCount} 字符（force=${forceRetype}）`, logID: 'RG-Info-Operate' });
        await this.page.waitForTimeout(utilRandomAround(200, 500));

        // 删除错误的字符
        for (let i = 0; i < deleteCount; i++) {
          await this.page.keyboard.press('Backspace');
          await this.page.waitForTimeout(50 + Math.random() * 100);
        }

        await this.page.waitForTimeout(utilRandomAround(150, 400));

        // 重新输入被删除的字符
        for (const ch of reType.split('')) {
          await this.page.keyboard.type(ch, { delay: 50 + Math.random() * 120 });
          if (Math.random() < 0.05) {
            await this.page.waitForTimeout(Math.random() * 200);
          }
        }
      }
      
      // 验证输入是否成功（可选）
      const inputValue = await element.inputValue().catch(() => '');
      if (inputValue !== inputStr) {
        console.warn(`⚠️ 输入验证失败: 期望 "${inputStr}", 实际 "${inputValue}"，尝试重新输入...`);
        
        // 清空并重新输入
        await element.click({ delay: utilRandomAround(150) });
        await this.page.keyboard.press('Control+A');
        await this.page.keyboard.press('Backspace');
        await this.page.waitForTimeout(utilRandomAround(200, 400));
        
        // 重新逐字符输入
        for (const ch of inputStr.split('')) {
          await this.page.keyboard.type(ch, { delay: 50 + Math.random() * 120 });
        }
      }
      
      await this.page.waitForTimeout(
        options.postDelay || utilRandomAround(1000, 1500)
      );
    } catch (error) {
      // 记录错误但不中断流程
      console.error(`fillInput 失败 (${options.title || '输入操作'}):`, error.message);
      this.tasklog({
        message: `${options.title || '输入操作'} 失败: ${error.message}`,
        logID: 'Warn-Info'
      });
      throw error; // 仍然抛出错误让上层处理
    }
  }

  /**
   * ========================================
   * 地址绑定功能
   * ========================================
   */

  /**
   * 主地址绑定工作流
   * 从 AddressBindingOperations.js 改编
   */
  async bindAddress() {
    try {
      this.tasklog({ logID: 'ADDRESS_BIND_START', message: '开始地址绑定流程' });
      
      // 获取地址信息（如果需要从页面获取）
      await this.getInitialAddressInfo();
      
      const { postCode } = this.addressInfo;
      
      // 使用地址生成服务获取真实地址信息
      this.tasklog({ message: '正在生成真实地址信息...', logID: 'RG-Info-Operate' });
      
      let addressData;
      if (this.config.addressData) {
        // 如果配置中提供了完整地址数据，直接使用
        addressData = this.config.addressData;
        this.tasklog({ message: '使用配置的地址数据', logID: 'RG-Info-Operate' });
      } else {
        // 使用地址生成服务获取真实地址（与原始toolbox完全一致）
        const result = postCode 
          ? await this.addressService.generatePostalCodeAddress(postCode)
          : await this.addressService.generateRandomAddress();
        
        addressData = result.data;
        this.tasklog({ 
          message: `已生成真实地址: ${addressData.addressLine1}, ${addressData.city}, ${addressData.stateCode} ${addressData.postalCode}`, 
          logID: 'RG-Info-Operate' 
        });
      }
      
      // 解构地址数据（变量名与toolbox保持一致）
      let { phoneNumber, addressLine1, city, stateCode, postalCode } = addressData;
      
      // 优先使用用户上传的手机号（如果配置中有提供）
      if (this.config.phone) {
        phoneNumber = this.config.phone;
        this.tasklog({ 
          message: `使用用户上传的手机号: ${phoneNumber}`, 
          logID: 'RG-Info-Operate' 
        });
      } else if (!phoneNumber || phoneNumber === 'undefined') {
        // 如果没有上传手机号，且地址服务也没有生成手机号，则使用工具类生成
        const phoneGen = new PhoneGenerator();
        phoneNumber = phoneGen.generatePhone();
        this.tasklog({ 
          message: `未上传手机号文件，已自动生成手机号: ${phoneNumber}`, 
          logID: 'RG-Info-Operate' 
        });
      }
      
      // 导航到地址管理（跳过登录检查，因为此时肯定已登录）
      await this.goToHomepage(true);
      await this.goToAccountAddress();
      await this.ops.address.clickAddAddress();
      
      // 填写表单（随机顺序模拟人类行为 - 与toolbox逻辑完全一致）
      const enterAddressFirst = Math.random() < 0.5;
      
      if (enterAddressFirst) {
        // 同页内多个输入框，使用分组填写并随机在其中一个字段执行删除重填
        await this.ops.address.fillAddressFields({ phoneNumber, addressLine1 });
      } else {
        await this.ops.address.fillAddressFields({ addressLine1 });
      }
      
      // 检查亚马逊的地址建议（与toolbox一致）
      await this.ops.address.handleAddressSuggestions();
      
      // 如果没有选择建议地址，填写剩余字段（与toolbox一致）
      if (!this.suggestedAddress) {
        // 在城市/邮编等字段中随机选择一个字段进行删除重填
        await this.ops.address.fillAddressFields({ city, stateCode, postalCode });
        // selectState 仍需要单独调用以设置下拉
        await this.ops.address.selectState(stateCode);
      }
      
      // 填写电话号码（如果还没填 - 与toolbox一致）
      if (!enterAddressFirst) {
        await this.ops.address.fillPhoneNumber(phoneNumber);
      }
      
      // 提交地址表单（与toolbox一致）
      await this.submitAddress();
      
      // 处理地址保存确认界面（如果存在）
      await this.handleAddressSaveConfirmation();
      
      await this.confirmSuggestedAddress();
      await this.ops.navigation.goToNavLogo();
      
      this.tasklog({ logID: 'ADDRESS_BIND_SUCCESS', message: '地址绑定完成' });
      
    } catch (error) {
      this.tasklog({ logID: 'ADDRESS_BIND_ERROR', message: `地址绑定失败: ${error.message}` });
      throw error;
    }
  }

  /**
   * 获取初始地址信息
   */
  async getInitialAddressInfo() {
    const workflow = createPollingFactory({
      error: () => {
        this.tasklog({ message: '获取地址信息失败，重试中...', logID: 'Warn-Info' });
      }
    });
    
    return workflow(async () => {
      try {
        const address = await this.page.locator('#glow-ingress-line1').innerText();
        const postCode = address.replace(/\D/g, '');
        
        if (!postCode || postCode.length !== 5) {
          throw new Error('Invalid post code');
        }
        
        // 尝试从 zippopotam API 获取地址信息
        const response = await fetch(`https://api.zippopotam.us/us/${postCode}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch address info');
        }
        
        const data = await response.json();
        
        this.addressInfo = {
          postCode,
          placeName: data.places[0]["place name"],
          state: data.places[0].state,
          stateAbbr: data.places[0]["state abbreviation"]
        };
        
        this.tasklog({ message: '获取地址信息成功', logID: 'RG-Info-Operate' });
      } catch (error) {
        // 如果获取失败，使用默认值
        this.addressInfo = {
          postCode: this.config.postalCode || '10001',
          placeName: 'New York',
          state: 'New York',
          stateAbbr: 'NY'
        };
        this.tasklog({ message: '使用默认地址信息', logID: 'Info' });
      }
    });
  }

  /**
   * 导航：返回首页Logo
   */
  async goToNavLogo() {
    this.tasklog({ message: '返回首页', logID: 'RG-Info-Operate' });
    return this.clickElement(this.page.locator('#nav-logo-sprites'), {
      title: '桌面端，主站，首页logo',
      waitForURL: true
    });
  }

  /**
   * 检查是否处于登录状态
   */
  async checkLoginStatus() {
    try {
      // 检查是否有"Hello, [用户名]"或"Account & Lists"元素
      const accountElement = this.page.locator('a[data-nav-role="signin"]').first();
      const isVisible = await accountElement.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (!isVisible) {
        this.tasklog({ message: '未找到账户元素', logID: 'RG-Info-Operate' });
        return false;
      }
      
      // 获取元素文本内容
      const text = await accountElement.innerText().catch(() => '');
      this.tasklog({ message: `账户元素文本: ${text}`, logID: 'RG-Info-Operate' });
      
      // 如果包含"Hello"说明已登录
      if (text.includes('Hello')) {
        this.tasklog({ message: '检测到登录状态（Hello）', logID: 'RG-Info-Operate' });
        return true;
      }
      
      // 如果包含"Sign in"说明未登录
      if (text.includes('Sign in')) {
        this.tasklog({ message: '检测到未登录状态（Sign in）', logID: 'RG-Info-Operate' });
        return false;
      }
      
      // 其他情况检查URL是否包含登录页面特征
      const url = this.page.url();
      if (url.includes('/ap/signin') || url.includes('/ap/cvf')) {
        this.tasklog({ message: '当前在登录页面，判定为未登录', logID: 'RG-Info-Operate' });
        return false;
      }
      
      // 如果文本包含Account & Lists，可能已登录
      if (text.includes('Account & Lists') || text.includes('Account')) {
        this.tasklog({ message: '检测到账户菜单，可能已登录', logID: 'RG-Info-Operate' });
        return true;
      }
      
      return false;
    } catch (error) {
      this.tasklog({ message: `登录状态检测失败: ${error.message}`, logID: 'Warn-Info' });
      return false;
    }
  }

  /**
   * 等待登录状态，如果未登录则刷新页面重试
   */
  async ensureLoginStatus(maxRetries = 3) {
    this.tasklog({ message: '开始检查登录状态...', logID: 'RG-Info-Operate' });
    
    for (let i = 0; i < maxRetries; i++) {
      const isLoggedIn = await this.checkLoginStatus();
      
      if (isLoggedIn) {
        this.tasklog({ message: '已确认登录状态', logID: 'RG-Info-Operate' });
        return true;
      }
      
      if (i < maxRetries - 1) {
        this.tasklog({ message: `未检测到登录状态，刷新页面重试 (${i + 1}/${maxRetries})`, logID: 'RG-Info-Operate' });
        await this.page.reload({ waitUntil: 'networkidle' });
        await this.page.waitForTimeout(utilRandomAround(2000, 3000));
      }
    }
    
    this.tasklog({ message: '警告：多次尝试后仍未检测到登录状态，继续执行', logID: 'Warn-Info' });
    return false;
  }

    /**
   * 注册失败统一清理方法
   * 关闭浏览器、删除容器、更新账号管理状态
   */
  async handleRegisterFailure(error) {
    // 统一的失败处理：记录日志、设置状态，由最终清理方法实际执行关闭/删除
    try {
      this.tasklog({ message: `注册失败：${error && error.message ? error.message : String(error)}`, logID: 'REGISTER_FAILURE' });
    } catch (e) {}

    // 设置最后结果为 failure，最终清理会根据此值决定是否删除容器
    try { this._lastOutcome = 'failure'; } catch (e) {}

    // 更新账号管理状态（renderer 或通过 config 提供的 API）
    try {
      const accountApi = (typeof window !== 'undefined' && window.accountManagerAPI) ? window.accountManagerAPI : (this.config && this.config.accountManagerAPI) ? this.config.accountManagerAPI : null;
      if (this.accountInfo && this.accountInfo.user && accountApi && accountApi.updateAccountStatus) {
        await accountApi.updateAccountStatus(this.accountInfo.user, { status: 'failed', error: error && error.message ? error.message : String(error) });
      }
    } catch (e) {
      console.warn('[清理] 更新账号状态失败:', e && e.message ? e.message : e);
    }
  }

  /**
   * 注册成功统一清理方法
   * 关闭浏览器、删除容器、更新账号管理状态
   */
  async handleRegisterSuccess() {
    // 统一的成功处理：记录日志并设置状态，由最终清理方法实际执行关闭（但成功不要删除容器）
    try {
      this.tasklog({ message: '注册成功，准备最终清理', logID: 'REGISTER_SUCCESS' });
    } catch (e) {}

    try { this._lastOutcome = 'success'; } catch (e) {}

    // 更新账号管理状态
    try {
      const accountApi = (typeof window !== 'undefined' && window.accountManagerAPI) ? window.accountManagerAPI : (this.config && this.config.accountManagerAPI) ? this.config.accountManagerAPI : null;
      if (this.accountInfo && this.accountInfo.user && accountApi && accountApi.updateAccountStatus) {
        await accountApi.updateAccountStatus(this.accountInfo.user, { status: 'success' });
      }
    } catch (e) {
      console.warn('[清理] 更新账号状态失败:', e && e.message ? e.message : e);
    }
  }

  /**
   * 导航：打开个人中心
   * @param {boolean} skipLoginCheck - 是否跳过登录状态检查（注册后立即导航时使用）
   */
  async goToHomepage(skipLoginCheck = false) {
    // 只有在需要时才检查登录状态（避免在注册完成后立即导航时出现问题）
    if (!skipLoginCheck) {
      await this.ensureLoginStatus();
    }
    
    this.tasklog({ message: '打开个人中心', logID: 'RG-Info-Operate' });
    return this.clickElement(
      this.page.locator('a[data-nav-role="signin"]').first(),
      {
        title: '桌面端，主站，打开个人中心',
        waitForURL: true
      }
    );
  }

  /**
   * 导航：打开地址设置
   */
  async goToAccountAddress() {
    this.tasklog({ message: '打开地址设置', logID: 'RG-Info-Operate' });
    return this.clickElement(
      this.page.locator('a[href*="/a/addresses"]').first(),
      {
        title: '桌面端，主站，打开地址设置',
        waitForURL: true
      }
    );
  }

  /**
   * 点击添加地址
   */
  async clickAddAddress() {
    this.tasklog({ message: '准备添加地址', logID: 'RG-Info-Operate' });
    return this.clickElement(
      this.page.locator('.a-box.first-desktop-address-tile').first(),
      {
        title: '桌面端，主站，准备添加地址',
        waitForURL: true
      }
    );
  }

  /**
   * 表单填写：电话号码
   * 注意：手机号可能包含 ---- 分隔符和API信息，需要提取纯号码部分
   */
  async fillPhoneNumber(number) {
    // 参数验证
    if (!number) {
      const errorMsg = 'fillPhoneNumber: 手机号参数为空';
      console.error(errorMsg);
      this.tasklog({ message: errorMsg, logID: 'Error-Info' });
      throw new Error(errorMsg);
    }
    
    // 清理手机号：如果包含----分隔符，只取前面的号码部分
    // 例如：+16362163344----http://api1.5sim.net/... => +16362163344
    let cleanNumber = String(number);
    if (cleanNumber.includes('----')) {
      cleanNumber = cleanNumber.split('----')[0];
      console.log(`[地址] 清理手机号: ${number} => ${cleanNumber}`);
      this.tasklog({ 
        message: `手机号包含API信息，已提取纯号码: ${cleanNumber}`, 
        logID: 'RG-Info-Operate' 
      });
    }
    
    this.tasklog({ message: `输入手机号: ${cleanNumber}`, logID: 'RG-Info-Operate' });
    return this.fillInput(
      this.page.locator('#address-ui-widgets-enterAddressPhoneNumber'),
      cleanNumber,
      {
        title: '桌面端，主站，输入手机号',
        clearContent: true
      }
    );
  }

  /**
   * 表单填写：地址行1
   */
  async fillAddressLine1(line) {
    this.tasklog({ message: '输入地址1', logID: 'RG-Info-Operate' });
    const options = arguments[1] || {};
    await this.fillInput(
      this.page.locator('#address-ui-widgets-enterAddressLine1'),
      line,
      Object.assign({
        title: '桌面端，主站，输入地址1',
        clearContent: true  // 清空原有内容，避免重复
      }, options)
    );
    
    // 输入地址后，等待一下让下拉建议出现或确认没有建议
    await this.page.waitForTimeout(utilRandomAround(1500, 2000));
    
    // 检测并选择自动补全下拉框中的第一个地址（如果出现）
    await this.selectFirstAddressAutocomplete();
  }

  /**
   * 选择地址自动补全下拉框中的第一个选项
   * 处理输入地址时出现的实时建议列表
   */
  async selectFirstAddressAutocomplete() {
    try {
      this.tasklog({ message: '检测地址自动补全下拉框...', logID: 'RG-Info-Operate' });
      
      // 亚马逊地址自动补全下拉框的可能选择器
      const dropdownSelectors = [
        '.a-popover-content .a-menu-item',  // 常见的下拉菜单项
        '[role="option"]',  // ARIA 角色选项
        '.a-dropdown-item',  // 下拉选项
        '#address-ui-widgets-enterAddressLine1-dropdown-item-0',  // 特定ID
        'ul[role="listbox"] li'  // listbox 中的项
      ];
      
      for (const selector of dropdownSelectors) {
        const dropdown = this.page.locator(selector).first();
        const exists = await dropdown.count().then(c => c > 0);
        
        if (exists) {
          // 检查是否可见
          const isVisible = await dropdown.isVisible({ timeout: 1000 }).catch(() => false);
          
          if (isVisible) {
            this.tasklog({ message: `找到地址自动补全选项，选择第一个 (${selector})`, logID: 'RG-Info-Operate' });
            await dropdown.click();
            await this.page.waitForTimeout(utilRandomAround(500, 1000));
            this.tasklog({ message: '已选择自动补全地址', logID: 'RG-Info-Operate' });
            return true;
          }
        }
      }
      
      this.tasklog({ message: '未检测到地址自动补全下拉框，继续执行', logID: 'RG-Info-Operate' });
      return false;
    } catch (error) {
      this.tasklog({ message: `处理地址自动补全失败: ${error.message}，继续执行`, logID: 'Warn-Info' });
      return false;
    }
  }

  /**
   * 表单填写：城市
   */
  async fillCity(city) {
    this.tasklog({ message: '检查城市字段...', logID: 'RG-Info-Operate' });
    
    const cityInput = this.page.locator('#address-ui-widgets-enterAddressCity');
    const currentValue = await cityInput.inputValue().catch(() => '');
    
    // 如果已有内容，跳过填写
    if (currentValue && currentValue.trim()) {
      this.tasklog({ message: `城市字段已有内容: ${currentValue}，跳过填写`, logID: 'RG-Info-Operate' });
      return;
    }
    
    this.tasklog({ message: '输入城市', logID: 'RG-Info-Operate' });
    const options = arguments[1] || {};
    return this.fillInput(
      cityInput,
      city,
      Object.assign({ title: '桌面端，主站，输入城市' }, options)
    );
  }

  /**
   * 表单选择：州
   */
  async selectState(value) {
    this.tasklog({ message: '选择州', logID: 'RG-Info-Operate' });
    return this.page
      .locator('#address-ui-widgets-enterAddressStateOrRegion-dropdown-nativeId')
      .selectOption(value);
  }

  /**
   * 表单填写：邮编
   */
  async fillPostalCode(postCode) {
    this.tasklog({ message: '检查邮编字段...', logID: 'RG-Info-Operate' });
    
    const postalCodeInput = this.page.locator('#address-ui-widgets-enterAddressPostalCode');
    const currentValue = await postalCodeInput.inputValue().catch(() => '');
    
    // 如果已有内容，跳过填写
    if (currentValue && currentValue.trim()) {
      this.tasklog({ message: `邮编字段已有内容: ${currentValue}，跳过填写`, logID: 'RG-Info-Operate' });
      return;
    }
    
    this.tasklog({ message: '输入邮编', logID: 'RG-Info-Operate' });
    const options = arguments[1] || {};
    return this.fillInput(
      postalCodeInput,
      postCode,
      Object.assign({ title: '桌面端，主站，输入邮编' }, options)
    );
  }

  /**
   * 提交地址表单
   */
  async submitAddress() {
    // 等待按钮出现并可点击
    const submitButton = this.page.locator('#address-ui-widgets-form-submit-button').first();
    
    try {
      await submitButton.waitFor({ state: 'visible', timeout: 5000 });
      this.tasklog({ message: '找到"Add address"按钮，准备点击', logID: 'RG-Info-Operate' });
    } catch (error) {
      this.tasklog({ message: '警告：未找到提交按钮，尝试继续', logID: 'Warn-Info' });
    }
    
    // 滚动到按钮位置
    await submitButton.evaluate(el => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }).catch(() => {});
    await this.page.waitForTimeout(utilRandomAround(500, 800));
    
    this.tasklog({ message: '点击"Add address"按钮提交地址', logID: 'RG-Info-Operate' });
    return this.clickElement(submitButton, {
      title: '桌面端，主站，确定添加地址',
      waitForURL: true
    });
  }

  /**
   * 检测并处理地址保存确认界面（多语言）
   * 点击"Add address"后可能出现保存确认界面，需要点击保存按钮
   */
  async handleAddressSaveConfirmation() {
    try {
      // 等待页面稳定
      await this.page.waitForTimeout(utilRandomAround(1000, 2000));
      
      // 多语言保存按钮选择器
      const saveButtonSelectors = [
        // 通过ID（最可靠）
        '#address-ui-widgets-form-submit-button',
        // 通过aria-labelledby（多语言支持）
        '[aria-labelledby="address-ui-widgets-form-submit-button-announce"]',
        // 通过通用属性
        'input[type="submit"][name="address-ui-widgets-form-submit-button"]',
        // 通过类名和类型
        'input.a-button-input[type="submit"]'
      ];
      
      // 检测是否存在保存按钮
      let saveButton = null;
      for (const selector of saveButtonSelectors) {
        const count = await this.page.locator(selector).count();
        if (count > 0) {
          saveButton = this.page.locator(selector).first();
          this.tasklog({ 
            message: `检测到地址保存确认界面，找到保存按钮: ${selector}`, 
            logID: 'RG-Info-Operate' 
          });
          break;
        }
      }
      
      // 如果找到保存按钮，则点击
      if (saveButton) {
        // 滚动到按钮位置
        await saveButton.evaluate(el => {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }).catch(() => {});
        await this.page.waitForTimeout(utilRandomAround(500, 800));
        
        this.tasklog({ message: '点击保存按钮确认地址', logID: 'RG-Info-Operate' });
        await this.clickElement(saveButton, {
          title: '桌面端，主站，保存地址确认',
          waitForURL: true
        });
        
        return true;
      } else {
        // 没有保存确认界面，继续后续流程
        this.tasklog({ message: '未检测到地址保存确认界面', logID: 'RG-Info-Operate' });
        return false;
      }
    } catch (error) {
      this.tasklog({ 
        message: `地址保存确认处理异常: ${error.message}`, 
        logID: 'Warn-Info' 
      });
      return false;
    }
  }

  /**
   * 处理亚马逊地址建议（与toolbox完全一致）
   */
  async handleAddressSuggestions() {
    const suggestion = this.page.locator('.awz-address-suggestion-item');
    
    this.suggestedAddress = false;
    
    try {
      await suggestion.waitFor({ timeout: 3000 });
      this.suggestedAddress = true;
    } catch {
      // 没有建议地址，不做任何操作
    }
    
    if (this.suggestedAddress) {
      this.tasklog({ message: '选择亚马逊接口地址', logID: 'RG-Info-Operate' });
      return this.clickElement(suggestion.first(), {
        title: '桌面端，主站，选择亚马逊接口地址'
      });
    }
  }

  /**
   * 确认建议的地址
   */
  async confirmSuggestedAddress() {
    const suggested = this.page.locator(
      '.a-box-group.a-spacing-base.a-spacing-top-base'
    );
    
    try {
      await suggested.waitFor({ timeout: 3000 });
      this.tasklog({ message: '确定添加建议的地址', logID: 'RG-Info-Operate' });
      
      return this.clickElement(
        this.page
          .locator('input[name="address-ui-widgets-saveOriginalOrSuggestedAddress"]')
          .first(),
        {
          title: '桌面端，主站，确定添加建议的地址',
          waitForURL: true
        }
      );
    } catch {
      const successAddress = '/a/addresses?alertId=yaab-enterAddressSucceed';
      
      if (this.page.url().includes(successAddress)) {
        this.tasklog({ message: '地址添加成功', logID: 'RG-Info-Operate' });
      }
    }
  }
}

module.exports = AmazonRegisterCore;
