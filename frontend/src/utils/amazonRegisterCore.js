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

class AmazonRegisterCore {
  constructor(config) {
    // 从配置中提取所有必要参数
    this.page = config.page;
    this.config = config;
    
    // 初始化地址生成服务
    this.addressService = config.addressService || new AddressService();
    
    // Private state
    this.registerTime = config.registerTime || Date.now();
    this.emailServiceInfo = null;
    this.addressInfo = null;
    this.suggestedAddress = false;
    
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
  }

  /**
   * 日志记录
   */
  tasklog(log) {
    this.logs.push({
      timestamp: Date.now(),
      ...log
    });
    console.log(`[${log.logID}] ${log.message}`, log.account || '');
  }

  /**
   * 错误创建
   */
  createError(error) {
    throw new CustomError(error.message, error.logID);
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
        await this.page.goto('https://www.google.com/', {
          timeout: 60000,
          waitUntil: 'domcontentloaded'
        });
        
        const language = await this.page.evaluate(() => navigator.language);
        this.config.language = language;
        this.tasklog({ logID: 'LANGUAGE_DETECTED', message: `检测到语言: ${language}` });
      }
      
      // 2. 根据语言导航到对应的 sell.amazon 页面
      const language = this.config.language || 'en-US';
      const sellUrl = this.getSellUrlByLanguage(language);
      
      this.tasklog({ logID: 'NAVIGATE_SELL', message: `导航到卖家中心: ${sellUrl}` });
      await this.page.goto(sellUrl, {
        timeout: 60000,
        waitUntil: 'load'
      });
      
      await this.page.waitForTimeout(utilRandomAround(3000, 5000));
      
      // 检测并处理站点选择弹窗（首次访问可能出现）
      await this.handleCountrySelectionPopup();
      
      // 3. 点击注册按钮
      await this.clickSignUp();
      await this.clickCreateAccount();
      
      // 4. 生成用户名和密码
      const username = utilEmailToName(this.accountInfo.user);
      if (!this.accountInfo.password) {
        this.accountInfo.password = utilGeneratePassword(username);
      }
      
      // 5. 填写注册表单
      await this.fillUsername(username);
      await this.fillEmail(this.accountInfo.user);
      await this.fillPassword(this.accountInfo.password);
      await this.fillPasswordConfirm(this.accountInfo.password);
      
      // 6. 提交注册
      this.registerTime = Date.now();
      await this.submitRegistration();
      
      // 等待页面稳定，让captcha有机会加载
      await this.page.waitForTimeout(utilRandomAround(2000, 3000));
      
      // 7. 处理 Captcha（如果存在）
      if (await this.checkCaptcha()) {
        this.updateRegisterConfig(conf => { conf.isCaptcha = true; });
        this.tasklog({ message: '需要人机验证', logID: 'Warn-Info' });
        await this.solveCaptcha();
        this.tasklog({ message: '人机验证完成', logID: 'RG-Info-Operate' });
      } else {
        this.tasklog({ message: '无需人机验证', logID: 'RG-Info-Operate' });
      }
      
      // 8. 邮箱验证
      const emailCode = await this.getEmailVerificationCode();
      await this.fillEmailCode(emailCode);
      await this.submitEmailVerification();
      
      // 9. 检查注册状态
      const status = await this.checkRegistrationStatus();
      
      switch (status) {
        case 201: // 2FA setup page
          if (this.config.enable2FA) {
            await this.handle2FASetup();
          }
          break;
          
        case 301: // Need to navigate to 2FA manually
          if (this.config.enable2FA) {
            await this.handle2FAManualSetup();
          }
          break;
          
        case 401: // Need phone verification
          await this.retryRegistration();
          const retryStatus = await this.checkRegistrationStatus();
          
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
          break;
      }
      
      // 10. 地址绑定（如果启用）
      if (this.config.bindAddress) {
        this.tasklog({ logID: 'ADDRESS_BIND', message: '准备绑定地址' });
        await this.bindAddress();
      }
      
      this.tasklog({ logID: 'REGISTER_SUCCESS', message: '注册完成', account: this.accountInfo.user });
      
      return {
        success: true,
        account: {
          userEmail: this.accountInfo.user,
          userPass: this.accountInfo.pass,
          userName: this.accountInfo.name,
          otpSecret: this.accountInfo.otpSecret
        },
        registerSuccess: true,
        otpSuccess: !!this.accountInfo.otpSecret,
        addressBound: this.config.bindAddress === true,
        logs: this.logs
      };
      
    } catch (error) {
      console.error('注册失败:', error);
      this.tasklog({ logID: 'REGISTER_ERROR', message: `注册失败: ${error.message}` });
      return {
        success: false,
        error: error.message,
        account: {
          userEmail: this.accountInfo.user,
          userPass: this.accountInfo.pass,
          userName: this.accountInfo.name,
          otpSecret: this.accountInfo.otpSecret || null
        },
        registerSuccess: false,
        otpSuccess: false,
        addressBound: false,
        logs: this.logs
      };
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

  async clickCreateAccount() {
    this.tasklog({ message: '创建账户', logID: 'RG-Info-Operate' });
    return this.clickElement(this.page.locator('#createAccountSubmit'), {
      title: '桌面端，主站，创建账户',
      waitForURL: true,
      waitUntil: 'networkidle'
    });
  }

  /**
   * ============================================
   * 表单填写
   * ============================================
   */
  async fillUsername(name) {
    this.tasklog({ message: '输入用户名', logID: 'RG-Info-Operate' });
    return this.fillInput(this.page.locator('#ap_customer_name'), name, {
      title: '桌面端，主站，填写用户名',
      preDelay: utilRandomAround(1000, 2000),
      postDelay: utilRandomAround(4000, 6000)
    });
  }

  async fillEmail(email) {
    this.tasklog({ message: '输入邮箱', logID: 'RG-Info-Operate' });
    return this.fillInput(this.page.locator('#ap_email'), email, {
      title: '桌面端，主站，填写邮箱',
      preDelay: utilRandomAround(1000, 2000),
      postDelay: utilRandomAround(4000, 6000)
    });
  }

  async fillPassword(password) {
    this.tasklog({ message: '输入密码', logID: 'RG-Info-Operate' });
    return this.fillInput(this.page.locator('#ap_password'), password, {
      title: '桌面端，主站，填写密码',
      preDelay: utilRandomAround(1000, 2000),
      postDelay: utilRandomAround(2000, 2500)
    });
  }

  async fillPasswordConfirm(password) {
    this.tasklog({ message: '再次确定密码', logID: 'RG-Info-Operate' });
    return this.fillInput(this.page.locator('#ap_password_check'), password, {
      title: '桌面端，主站，再次确定密码',
      preDelay: utilRandomAround(1000, 2000),
      postDelay: utilRandomAround(2000, 2500)
    });
  }

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
   * ============================================
   * Captcha 处理 - 完全照搬 RegisterOperations.js
   * ============================================
   */
  async checkCaptcha() {
    try {
      // 增加等待时间，给captcha更多加载时间
      await this.page.locator('#cvf-aamation-container').waitFor({ timeout: 10000 });
      this.tasklog({ message: '检测到验证码界面', logID: 'RG-Info-Operate' });
      return true;
    } catch {
      // 也检查一下是否有Start Puzzle按钮（某些情况下会先显示这个）
      try {
        await this.page.locator('#amzn-btn-submit').waitFor({ timeout: 2000 });
        this.tasklog({ message: '检测到验证码前置界面', logID: 'RG-Info-Operate' });
        return true;
      } catch {
        return false;
      }
    }
  }

  async solveCaptcha() {
    try {
      this.tasklog({ message: '========== 开始处理验证码 ==========', logID: 'RG-Info-Operate' });
      
      // 1. 获取验证码数据
      this.tasklog({ message: '步骤1: 获取验证码数据...', logID: 'RG-Info-Operate' });
      const captchaSource = await this.getCaptchaData();
      
      if (!captchaSource) {
        this.tasklog({ message: '未能获取验证码数据', logID: 'Error-Info' });
        throw new Error('获取验证码数据失败');
      }
      
      // 2. 调用 API 解析验证码
      this.tasklog({ message: '步骤2: 调用 API 解析验证码...', logID: 'RG-Info-Operate' });
      const result = await this.getCaptchaSolution(captchaSource);
      
      if (!result || result.length === 0) {
        this.tasklog({ message: 'API 未返回有效结果', logID: 'Error-Info' });
        throw new Error('验证码解析失败');
      }
      
      // 3. 生成点击坐标
      this.tasklog({ message: `步骤3: 生成 ${result.length} 个点击坐标...`, logID: 'RG-Info-Operate' });
      const position = utilGenerateGridPositions({
        width: 324,
        height: 324,
        source: result,
        gap: 16,
        padding: 16
      });
      
      this.tasklog({ message: `生成坐标完成: ${JSON.stringify(position)}`, logID: 'RG-Info-Operate' });
      
      // 4. 依次点击每个位置
      this.tasklog({ message: `步骤4: 开始点击 ${result.length} 个位置...`, logID: 'RG-Info-Operate' });
      for (let i = 0; i < result.length; i++) {
        this.tasklog({ message: `点击第 ${i + 1}/${result.length} 个位置`, logID: 'RG-Info-Operate' });
        await this.clickCaptchaPosition(position[i]);
        await this.page.waitForTimeout(utilRandomAround(750, 1000));
      }
      
      // 5. 提交验证码
      this.tasklog({ message: '步骤5: 提交验证码...', logID: 'RG-Info-Operate' });
      await this.submitCaptcha();
      
      this.tasklog({ message: '========== 验证码处理完成 ==========', logID: 'RG-Info-Operate' });
    } catch (error) {
      this.tasklog({ message: `验证码处理失败: ${error.message}`, logID: 'Error-Info' });
      this.tasklog({ message: `错误堆栈: ${error.stack}`, logID: 'Error-Info' });
      throw error;
    }
  }



  async getCaptchaData() {
    try {
      this.tasklog({ message: '等待验证码数据响应...', logID: 'RG-Info-Operate' });
      const response = await this.page.waitForResponse(
        /ait\/ait\/ait\/problem\?.+$/,
        { timeout: 60000 }
      );
      
      if (response.request().timing().startTime > this.registerTime) {
        const data = await response.json();
        const token = '58e9d0ae-8322-4c89-b6c5-cd035a684b02';
        const { assets, localized_assets } = data;
        
        this.tasklog({ message: '成功获取验证码数据', logID: 'RG-Info-Operate' });
        this.tasklog({ message: `验证码问题: ${localized_assets.target0}`, logID: 'RG-Info-Operate' });
        this.tasklog({ message: `图片数量: ${JSON.parse(assets.images).length}`, logID: 'RG-Info-Operate' });
        
        return {
          token,
          queries: JSON.parse(assets.images),
          question: localized_assets.target0
        };
      } else {
        this.tasklog({ message: '验证码响应时间早于注册时间，忽略', logID: 'Warn-Info' });
        return null;
      }
    } catch (error) {
      this.tasklog({ message: `获取验证码数据失败: ${error.message}`, logID: 'Error-Info' });
      this.createError({ message: '获取Captcha数据失败', logID: 'Error-Info' });
      return null;
    }
  }

  async getCaptchaSolution(props) {
    this.tasklog({ message: '开始调用 captcha.run API 解析验证码...', logID: 'RG-Info-Operate' });
    this.tasklog({ message: `API Token: ${props.token}`, logID: 'RG-Info-Operate' });
    
    const workflow = createPollingFactory({
      interval: 5000,
      error: () => {
        this.tasklog({ message: '解析captcha失败，重试中...', logID: 'Warn-Info' });
      },
      complete: () => {
        this.createError({ message: '解析captcha失败', logID: 'Error-Info' });
      }
    });
    
    return workflow(async (props) => {
      this.tasklog({ message: '正在发送请求到 captcha.run...', logID: 'RG-Info-Operate' });
      
      const response = await fetch('https://api.captcha.run/v2/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${props.token}`
        },
        body: JSON.stringify({
          captchaType: 'UniformITM',
          question: props.question,
          queries: props.queries
        })
      });
      
      const data = await response.json();
      this.tasklog({ message: `API 响应: ${JSON.stringify(data)}`, logID: 'RG-Info-Operate' });
      
      if (data.result && data.result.type === 'multi' && data.result.objects && data.result.objects.length === 5) {
        this.tasklog({ message: `解析captcha成功，找到 ${data.result.objects.length} 个目标`, logID: 'RG-Info-Operate' });
        return data.result.objects;
      } else {
        this.tasklog({ message: `API 返回格式不符合预期: ${JSON.stringify(data)}`, logID: 'Warn-Info' });
        throw new Error('API返回结果格式错误或目标数量不正确');
      }
    }, props);
  }

  async clickCaptchaPosition(position) {
    // 完全按照 toolbox 的 #mainOperateCaptchaSpot 实现
    // 添加额外的等待和调试日志
    await this.page.waitForTimeout(utilRandomAround(300, 500));
    
    this.tasklog({ 
      message: `点击验证码位置: (${position.x}, ${position.y})`, 
      logID: 'RG-Info-Operate' 
    });
    
    return this.page
      .locator('#captcha-container')
      .locator('canvas')
      .first()
      .click({
        delay: utilFluctuateAround(150),
        position
      });
  }

  async submitCaptcha() {
    // 完全按照 toolbox 的 #mainOperateCaptchaConfirm 实现
    this.tasklog({ message: '提交验证码', logID: 'RG-Info-Operate' });
    
    return this.clickElement(
      this.page.locator('#amzn-btn-verify-internal'),
      {
        title: '桌面端，主站，过人机验证',
        waitForURL: true,
        waitUntil: 'networkidle'
      }
    );
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

  async submitEmailVerification(waitUntil = 'networkidle') {
    this.tasklog({ message: '确定添加邮箱', logID: 'RG-Info-Operate' });
    return this.clickElement(this.page.locator('#cvf-submit-otp-button'), {
      title: '桌面端，主站，确定添加邮箱',
      waitForURL: true,
      waitUntil
    });
  }

  /**
   * ============================================
   * 注册状态检查和处理
   * ============================================
   */
  async checkRegistrationStatus() {
    const workflow = createPollingFactory({ interval: 5000, maxWait: 60000 });
    
    return workflow(async () => {
      const url = this.page.url();
      
      if (url.includes('/a/settings/approval/setup/register?')) {
        return Promise.resolve(201); // 2FA setup page
      } else if (url.includes('/a/settings/otpdevices/add?')) {
        return Promise.resolve(301); // Add OTP device page
      } else if (url.includes('ap/cvf/verify')) {
        return Promise.resolve(401); // Verification required
      } else {
        throw new Error('error');
      }
    });
  }

  async handleRegistrationStatus(status) {
    switch (status) {
      case 201: // 2FA setup page
        await this.handle2FASetup();
        break;
        
      case 301: // Need to navigate to 2FA manually
        await this.handle2FAManualSetup();
        break;
        
      case 401: // Need phone verification
        await this.retryRegistration();
        const retryStatus = await this.checkRegistrationStatus();
        
        switch (retryStatus) {
          case 201:
            await this.handle2FASetup();
            break;
          case 301:
            await this.handle2FAManualSetup();
            break;
          case 401:
            this.config.notUseEmail = this.accountInfo.user;
            this.createError({ message: '注册失败', logID: 'Error-Info' });
            break;
        }
        break;
    }
  }

  /**
   * ============================================
   * 2FA 处理
   * ============================================
   */
  async handle2FASetup() {
    this.logRegistrationSuccess();
    
    await this.expandAuthenticatorApp();
    await this.get2FASecret();
    this.tasklog({ message: '2FAToken获取成功', logID: 'RG-Info-Operate' });
    
    const otp = await this.getStableTOTP();
    await this.fill2FACode(otp.code);
    await this.submit2FA();
    
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
    this.logRegistrationSuccess();
    
    // 检查是否在手机绑定页面（无OTP认证的情况）
    const currentUrl = this.page.url();
    if (currentUrl.includes('ap/cvf/verify')) {
      this.tasklog({ message: '检测到手机绑定页面（无OTP认证），准备跳过', logID: 'RG-Info-Operate' });
      await this.skipPhoneVerification();
      // 跳过后等待页面稳定
      await this.page.waitForTimeout(utilRandomAround(2000, 3000));
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
    await this.goToAccountSettings();
    await this.goToLoginSecurity();
    await this.goToStepVerification();
    await this.expandAuthenticatorApp();
    await this.get2FASecret();
    this.tasklog({ message: '2FAToken获取成功', logID: 'RG-Info-Operate' });
    
    const otp = await this.getStableTOTP();
    await this.fill2FACode(otp.code);
    
    this.registerTime = Date.now();
    await this.submit2FA();
    
    const code = await this.getEmailVerificationCode();
    await this.fill2FAEmailCode(code);
    await this.submitEmailVerification('load');
    
    this.tasklog({
      message: '绑定2FA成功',
      logID: 'RG-Bind-Otp',
      account: {
        userEmail: this.accountInfo.user,
        otpSecret: this.accountInfo.otpSecret
      }
    });
    
    await this.submitTwoStepVerification();
    
    // 如果不绑定地址，跳转到首页
    if (!this.config.bindAddress) {
      await this.goToNavLogo();
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
    // 1. 先尝试点击radio按钮选择"使用验证器应用"选项
    const radioSelectors = [
      'input[type="radio"][value="totp"]',
      '#auth-TOTP',
      'input[name="otpDeviceContext"][value="totp"]',
      'input[value="totp"]'
    ];
    
    let radioClicked = false;
    for (const selector of radioSelectors) {
      try {
        const radio = this.page.locator(selector).first();
        const isVisible = await radio.isVisible({ timeout: 2000 }).catch(() => false);
        
        if (isVisible) {
          this.tasklog({ message: '选择使用验证器应用', logID: 'RG-Info-Operate' });
          await radio.click();
          await this.page.waitForTimeout(utilRandomAround(1000, 1500));
          radioClicked = true;
          break;
        }
      } catch (error) {
        // 继续尝试下一个选择器
      }
    }
    
    // 2. 再检查并展开accordion（如果需要）
    const box = this.page.locator('#sia-otp-accordion-totp-header');
    const boxExists = await box.count().then(c => c > 0);
    
    if (boxExists) {
      const expanded = await box.getAttribute('aria-expanded');
      
      if (expanded === 'false') {
        this.tasklog({ message: '展开验证器应用配置区域', logID: 'RG-Info-Operate' });
        await this.clickElement(box, {
          title: '桌面端，主站，展开验证器应用配置'
        });
      }
    }
  }

  async fill2FACode(code) {
    this.tasklog({ message: '填写2FA验证码', logID: 'RG-Info-Operate' });
    return this.fillInput(
      this.page.locator('#ch-auth-app-code-input'),
      code,
      {
        title: '桌面端，主站，填写2FA验证码'
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
    return this.fillInput(this.page.locator('#input-box-otp'), code, {
      title: '桌面端，主站，填写开启2FA邮件验证码'
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
    
    // 确认页面出现了，处理复选框和提交按钮
    this.tasklog({ message: '检测到两步验证确认页面', logID: 'RG-Info-Operate' });
    
    // 检查是否有"Don't require OTP on this browser"复选框
    const trustDeviceCheckbox = this.page.locator('input[name="trustThisDevice"]');
    const isCheckboxVisible = await trustDeviceCheckbox.isVisible().catch(() => false);
    
    if (isCheckboxVisible) {
      // 如果复选框存在且未勾选，则勾选它
      const isChecked = await trustDeviceCheckbox.isChecked();
      if (!isChecked) {
        await trustDeviceCheckbox.check();
        await this.page.waitForTimeout(utilRandomAround(500, 1000));
      }
    }
    
    // 滚动到按钮位置
    await enableMfaFormSubmit.evaluate(el => {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    
    // 点击确认按钮
    this.tasklog({ message: '确认开启两步验证', logID: 'RG-Info-Operate' });
    return this.clickElement(enableMfaFormSubmit, {
      title: '桌面端，主站，确认开启两步验证',
      waitForURL: true
    });
  }

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
   * ============================================
   * 导航辅助方法
   * ============================================
   */
  async goToAccountSettings() {
    this.tasklog({ message: '打开个人中心', logID: 'RG-Info-Operate' });
    return this.clickElement(
      this.page.locator('a[data-nav-role="signin"]').first(),
      {
        title: '桌面端，主站，打开个人中心',
        waitForURL: true
      }
    );
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
    return this.clickElement(
      this.page.locator('a[href*="/a/settings/approval/setup/register?"]'),
      {
        title: '桌面端，主站，打开两步验证',
        waitForURL: true
      }
    );
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
    } catch {
      this.createError({
        message: `${options.title} 操作失败`,
        logID: 'Error-Info'
      });
    }
  }

  async fillInput(element, str, options = {}) {
    try {
      // 使用简化的人类打字模拟（避免过度滚动和删除重打）
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
      
      // 直接输入，不使用humanTypeLocator的删除重打功能
      await element.click({ delay: utilRandomAround(150) });
      await this.page.waitForTimeout(200 + Math.random() * 300);
      
      // 逐字符输入，带随机延迟
      for (const ch of str.split('')) {
        await this.page.keyboard.type(ch, { delay: 50 + Math.random() * 120 });
        if (Math.random() < 0.05) {
          await this.page.waitForTimeout(Math.random() * 300); // 偶尔暂停，但时间更短
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
      const { phoneNumber, addressLine1, city, stateCode, postalCode } = addressData;
      
      // 导航到地址管理（跳过登录检查，因为此时肯定已登录）
      await this.goToHomepage(true);
      await this.goToAccountAddress();
      await this.clickAddAddress();
      
      // 填写表单（随机顺序模拟人类行为 - 与toolbox逻辑完全一致）
      const enterAddressFirst = Math.random() < 0.5;
      
      if (enterAddressFirst) {
        await this.fillPhoneNumber(phoneNumber);
        await this.fillAddressLine1(addressLine1);
      } else {
        await this.fillAddressLine1(addressLine1);
      }
      
      // 检查亚马逊的地址建议（与toolbox一致）
      await this.handleAddressSuggestions();
      
      // 如果没有选择建议地址，填写剩余字段（与toolbox一致）
      if (!this.suggestedAddress) {
        await this.fillCity(city);
        await this.selectState(stateCode);
        await this.fillPostalCode(postalCode);
      }
      
      // 填写电话号码（如果还没填 - 与toolbox一致）
      if (!enterAddressFirst) {
        await this.fillPhoneNumber(phoneNumber);
      }
      
      // 提交地址表单（与toolbox一致）
      await this.submitAddress();
      await this.confirmSuggestedAddress();
      await this.goToNavLogo();
      
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
   */
  async fillPhoneNumber(number) {
    this.tasklog({ message: '输入手机号', logID: 'RG-Info-Operate' });
    return this.fillInput(
      this.page.locator('#address-ui-widgets-enterAddressPhoneNumber'),
      number,
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
    await this.fillInput(
      this.page.locator('#address-ui-widgets-enterAddressLine1'),
      line,
      {
        title: '桌面端，主站，输入地址1'
      }
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
    this.tasklog({ message: '输入城市', logID: 'RG-Info-Operate' });
    return this.fillInput(
      this.page.locator('#address-ui-widgets-enterAddressCity'),
      city,
      {
        title: '桌面端，主站，输入城市'
      }
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
    this.tasklog({ message: '输入邮编', logID: 'RG-Info-Operate' });
    return this.fillInput(
      this.page.locator('#address-ui-widgets-enterAddressPostalCode'),
      postCode,
      {
        title: '桌面端，主站，输入邮编'
      }
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
