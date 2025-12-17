/**
 * RegisterOperations - Amazon Account Registration Operations
 * 
 * This service handles the complete Amazon account registration workflow:
 * - Account creation with email and password
 * - CAPTCHA solving using external API
 * - Email verification code extraction
 * - Phone number verification
 * - 2FA (Two-Factor Authentication) setup with TOTP
 * - Address binding (optional)
 * 
 * Workflow:
 * 1. Navigate to Amazon seller registration page
 * 2. Fill in account information (name, email, password)
 * 3. Solve CAPTCHA if required
 * 4. Verify email with OTP code
 * 5. Setup 2FA with authenticator app
 * 6. Optionally bind address
 */

const {
  utilRandomAround,
  utilFluctuateAround,
  utilEmailToName,
  utilGeneratePassword,
  utilExtractEmailCode,
  utilFlattenObject,
  utilGenerateTOTP,
  utilGenerateGridPositions,
  createPollingFactory,
  CustomError
} = require('../../../utils/toolUtils');

class RegisterOperations {
  /**
   * @param {Object} taskPublicService - Task public service instance
   * @param {Object} emailService - Email service for verification codes
   */
  constructor(taskPublicService, emailService) {
    this._tp_ = taskPublicService;
    this.emailService = emailService;
    
    // Private state
    this.registerTime = null;
    this.emailServiceInfo = null;
    this.accountInfo = null;
  }

  /**
   * Main registration workflow
   */
  async execute() {
    // Select language if not English
    if (this._tp_.taskRegisterConfig.language !== 'en-US') {
      await this.selectLanguage();
    }
    
    // Navigate to seller registration
    if (this._tp_.taskRegisterConfig.language !== 'en-US') {
      await this.goToSellRegister();
    }
    
    await this.clickSignUp();
    await this.clickCreateAccount();
    
    // Request email account
    const { user, client_id, refresh_token } = await this.requestEmail(
      this._tp_.taskBaseConfig.containerCode
    );
    this.emailServiceInfo = { client_id, refresh_token };
    
    // Generate account credentials
    const username = utilEmailToName(user);
    const password = utilGeneratePassword(username);
    this.accountInfo = { user, password };
    
    // Fill registration form
    await this.fillUsername(username);
    await this.fillEmail(user);
    await this.fillPassword(password);
    await this.fillPasswordConfirm(password);
    
    this.registerTime = Date.now();
    await this.submitRegistration();
    
    // Handle CAPTCHA if present
    if (await this.checkCaptcha()) {
      this._tp_.updateRegisterConfig(conf => { conf.isCaptcha = true; });
      this._tp_.tasklog({ message: '需要人机验证', logID: 'Warn-Info' });
      await this.solveCaptcha();
    }
    
    // Verify email
    const emailCode = await this.getEmailVerificationCode();
    await this.fillEmailCode(emailCode);
    await this.submitEmailVerification();
    
    // Check registration status and handle accordingly
    const status = await this.checkRegistrationStatus();
    
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
            this._tp_.updateRegisterConfig(conf => {
              conf.notUseEmail = this.accountInfo.user;
            });
            this._tp_.createError({ message: '注册失败', logID: 'Error-Info' });
            break;
        }
        break;
    }
  }

  /**
   * Language Selection Operations
   */
  async selectLanguage() {
    await this._tp_.ctxPage.waitForTimeout(utilRandomAround(5000, 7500));
    
    const languageSelect = this._tp_.ctxPage.locator(
      'button[data-popup-id="footer-nav-country-picker-popup"]'
    );
    await languageSelect.waitFor();
    
    await languageSelect.evaluate(el => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    
    await this._tp_.ctxPage.waitForTimeout(utilRandomAround(5000, 7500));
    this._tp_.tasklog({ message: '选择语言', logID: 'RG-Info-Operate' });
    
    return this.clickElement(languageSelect, {
      title: '桌面端，主站，选择语言'
    });
  }

  async goToSellRegister() {
    await this._tp_.ctxPage.waitForTimeout(utilRandomAround(3000, 5000));
    this._tp_.tasklog({ message: '进入主站', logID: 'RG-Info-Operate' });
    
    return this.clickElement(
      this._tp_.ctxPage.locator('a[href*="https://sell.amazon.com?initialSessionID"]'),
      {
        title: '桌面端，主站，进入主站',
        waitForURL: this._tp_.taskRegisterConfig.language === 'en-US'
      }
    );
  }

  async clickSignUp() {
    this._tp_.tasklog({ message: '准备注册', logID: 'RG-Info-Operate' });
    await this._tp_.ctxPage.waitForTimeout(utilRandomAround(5000, 7500));
    
    return this.clickElement(
      this._tp_.ctxPage
        .locator('.button.button-type-primary.font-size-xlarge.button-focus-default')
        .first(),
      {
        title: '桌面端，主站，准备注册',
        waitForURL: true
      }
    );
  }

  async clickCreateAccount() {
    this._tp_.tasklog({ message: '创建账户', logID: 'RG-Info-Operate' });
    return this.clickElement(this._tp_.ctxPage.locator('#createAccountSubmit'), {
      title: '桌面端，主站，创建账户',
      waitForURL: true,
      waitUntil: 'networkidle'
    });
  }

  /**
   * Form Filling Operations
   */
  async fillUsername(name) {
    this._tp_.tasklog({ message: '输入用户名', logID: 'RG-Info-Operate' });
    return this.fillInput(this._tp_.ctxPage.locator('#ap_customer_name'), name, {
      title: '桌面端，主站，填写用户名',
      preDelay: utilRandomAround(1000, 2000),
      postDelay: utilRandomAround(4000, 6000)
    });
  }

  async fillEmail(email) {
    this._tp_.tasklog({ message: '输入邮箱', logID: 'RG-Info-Operate' });
    return this.fillInput(this._tp_.ctxPage.locator('#ap_email'), email, {
      title: '桌面端，主站，填写邮箱',
      preDelay: utilRandomAround(1000, 2000),
      postDelay: utilRandomAround(4000, 6000)
    });
  }

  async fillPassword(password) {
    this._tp_.tasklog({ message: '输入密码', logID: 'RG-Info-Operate' });
    return this.fillInput(this._tp_.ctxPage.locator('#ap_password'), password, {
      title: '桌面端，主站，填写密码',
      preDelay: utilRandomAround(1000, 2000),
      postDelay: utilRandomAround(2000, 2500)
    });
  }

  async fillPasswordConfirm(password) {
    this._tp_.tasklog({ message: '再次确定密码', logID: 'RG-Info-Operate' });
    return this.fillInput(this._tp_.ctxPage.locator('#ap_password_check'), password, {
      title: '桌面端，主站，再次确定密码',
      preDelay: utilRandomAround(1000, 2000),
      postDelay: utilRandomAround(2000, 2500)
    });
  }

  async submitRegistration() {
    this._tp_.tasklog({ message: '提交注册', logID: 'RG-Info-Operate' });
    return this.clickElement(this._tp_.ctxPage.locator('#continue'), {
      title: '桌面端，主站，提交注册',
      waitForURL: true
    });
  }

  /**
   * CAPTCHA Operations
   */
  async checkCaptcha() {
    try {
      await this._tp_.ctxPage.locator('#cvf-aamation-container').waitFor({ timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  async solveCaptcha() {
    const captchaSource = await this.getCaptchaData();
    const result = await this.getCaptchaSolution(captchaSource);
    const positions = utilGenerateGridPositions({
      width: 324,
      height: 324,
      source: result,
      gap: 16,
      padding: 16
    });
    
    for (let i = 0; i < result.length; i++) {
      await this.clickCaptchaPosition(positions[i]);
      await this._tp_.ctxPage.waitForTimeout(utilRandomAround(750, 1000));
    }
    
    await this.submitCaptcha();
  }

  async getCaptchaData() {
    try {
      const response = await this._tp_.ctxPage.waitForResponse(
        /ait\/ait\/ait\/problem\?.+$/,
        { timeout: 60000 }
      );
      
      if (response.request().timing().startTime > this.registerTime) {
        const data = await response.json();
        const token = '58e9d0ae-8322-4c89-b6c5-cd035a684b02';
        const { assets, localized_assets } = data;
        
        return {
          token,
          queries: JSON.parse(assets.images),
          question: localized_assets.target0
        };
      }
    } catch {
      this._tp_.createError({ message: '获取Captcha数据失败', logID: 'Error-Info' });
    }
  }

  async getCaptchaSolution(props) {
    const workflow = createPollingFactory({
      interval: 5000,
      error: () => {
        this._tp_.tasklog({ message: '解析captcha失败，重试中...', logID: 'Warn-Info' });
      },
      complete: () => {
        this._tp_.createError({ message: '解析captcha失败', logID: 'Error-Info' });
      },
      stop: () => this._tp_.taskRegisterConfig.pageClose
    });
    
    return workflow(async (props) => {
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
      
      if (data.result.type === 'multi' && data.result.objects.length === 5) {
        this._tp_.tasklog({ message: '解析captcha成功', logID: 'RG-Info-Operate' });
        return data.result.objects;
      } else {
        throw new Error('error');
      }
    }, props);
  }

  async clickCaptchaPosition(position) {
    return this._tp_.ctxPage
      .locator('#captcha-container')
      .locator('canvas')
      .first()
      .click({
        delay: utilFluctuateAround(150),
        position
      });
  }

  async submitCaptcha() {
    return this.clickElement(
      this._tp_.ctxPage.locator('#amzn-btn-verify-internal'),
      {
        title: '桌面端，主站，过人机验证',
        waitForURL: true,
        waitUntil: 'networkidle'
      }
    );
  }

  /**
   * Email Verification Operations
   */
  async getEmailVerificationCode() {
    await this._tp_.ctxPage.waitForTimeout(utilRandomAround(10000, 15000));
    
    const { refresh_token, client_id } = this.emailServiceInfo;
    
    const workflow = createPollingFactory({
      error: (error) => {
        this._tp_.tasklog({
          message: `获取邮箱验证码失败，${error.message}，重试`,
          logID: 'Warn-Info'
        });
      },
      complete: () => {
        this._tp_.createError({ message: '获取邮箱验证码失败', logID: 'Error-Info' });
      },
      stop: () => this._tp_.taskRegisterConfig.pageClose
    });
    
    return workflow(async (start) => {
      const res = await this.emailService.getInboxLatest({ refresh_token, client_id });
      
      if (!Array.isArray(res) || res.length === 0) {
        throw new Error('没有取到任何邮件');
      }
      
      const mail = res.find(
        m => m.from === 'account-update@amazon.com' && m.timestamp > start
      );
      
      if (!mail) {
        throw new Error('没有取到预期邮件');
      }
      
      this._tp_.tasklog({ message: '获取邮箱验证码成功', logID: 'RG-Info-Operate' });
      return utilExtractEmailCode(mail.html)[0];
    }, this.registerTime);
  }

  async fillEmailCode(code) {
    this._tp_.tasklog({ message: '填写邮箱验证码', logID: 'RG-Info-Operate' });
    return this.fillInput(
      this._tp_.ctxPage
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
    this._tp_.tasklog({ message: '确定添加邮箱', logID: 'RG-Info-Operate' });
    return this.clickElement(this._tp_.ctxPage.locator('#cvf-submit-otp-button'), {
      title: '桌面端，主站，确定添加邮箱',
      waitForURL: true,
      waitUntil
    });
  }

  /**
   * Phone Verification Operations
   */
  async getPhoneVerificationCode(api) {
    await this._tp_.ctxPage.waitForTimeout(utilRandomAround(10000, 15000));
    
    const workflow = createPollingFactory({
      error: (error) => {
        this._tp_.tasklog({
          message: `获取手机验证码失败，${error.message}，重试`,
          logID: 'Warn-Info'
        });
      },
      complete: () => {
        this._tp_.createError({ message: '获取手机验证码失败', logID: 'Error-Info' });
      },
      stop: () => this._tp_.taskRegisterConfig.pageClose
    });
    
    return workflow(async (codeRegex, apiUrl) => {
      let text = '';
      const res = await fetch(apiUrl);
      const contentType = res.headers.get('content-type') || '';
      
      if (contentType.includes('text/html')) {
        text = await res.text();
      } else if (contentType.includes('application/json')) {
        const jsonData = await res.json();
        text = utilFlattenObject(jsonData);
      } else {
        throw new Error('接口返回格式不正确');
      }
      
      const match = codeRegex.exec(text);
      if (!match) {
        throw new Error('未识别到验证码');
      }
      
      this._tp_.tasklog({ message: '获取手机验证码成功', logID: 'RG-Info-Operate' });
      return match[0];
    }, /\b\d{6}\b/, api);
  }

  async fillPhoneNumber(number) {
    this._tp_.tasklog({ message: '填写手机号', logID: 'RG-Info-Operate' });
    return this.fillInput(this._tp_.ctxPage.locator('#cvfPhoneNumber'), number, {
      title: '桌面端，主站，填写手机号',
      preDelay: utilRandomAround(1000, 2000),
      postDelay: utilRandomAround(2000, 2500)
    });
  }

  async submitPhoneNumber() {
    this._tp_.tasklog({ message: '提交手机号', logID: 'RG-Info-Operate' });
    return this.clickElement(
      this._tp_.ctxPage.locator('#a-autoid-0').locator('.a-button-input.notranslate'),
      {
        title: '桌面端，主站，提交手机号'
      }
    );
  }

  async fillPhoneCode(code) {
    this._tp_.tasklog({ message: '填写手机验证码', logID: 'RG-Info-Operate' });
    return this.fillInput(this._tp_.ctxPage.locator('#cvf-input-code'), code, {
      title: '桌面端，主站，填写手机验证码',
      preDelay: utilRandomAround(1000, 2000),
      postDelay: utilRandomAround(2000, 2500)
    });
  }

  async submitPhoneVerification() {
    this._tp_.tasklog({ message: '确定添加手机号', logID: 'RG-Info-Operate' });
    return this.clickElement(
      this._tp_.ctxPage
        .locator('#cvf-submit-otp-button')
        .locator('.a-button-input.notranslate'),
      {
        title: '桌面端，主站，确定添加手机号',
        waitForURL: true,
        waitUntil: 'networkidle'
      }
    );
  }

  /**
   * 2FA Setup Operations
   */
  async get2FASecret() {
    this._tp_.tasklog({ message: '等待绑定2FA', logID: 'RG-Info-Operate' });
    const text2fa = await this._tp_.ctxPage
      .locator('#sia-auth-app-formatted-secret')
      .innerText();
    this.accountInfo.otpSecret = text2fa.replace(/\s+/g, '');
  }

  async getStableTOTP() {
    await this._tp_.ctxPage.waitForTimeout(utilRandomAround(20000, 25000));
    
    const { remainingTime } = await utilGenerateTOTP(this.accountInfo.otpSecret);
    
    if (remainingTime < 4) {
      await this._tp_.ctxPage.waitForTimeout(utilRandomAround(5000, 7000));
    }
    
    return utilGenerateTOTP(this.accountInfo.otpSecret);
  }

  async expandAuthenticatorApp() {
    const box = this._tp_.ctxPage.locator('#sia-otp-accordion-totp-header');
    const expanded = await box.getAttribute('aria-expanded');
    
    if (expanded === 'false') {
      this._tp_.tasklog({ message: '选择添加2FA', logID: 'RG-Info-Operate' });
      await this.clickElement(box, {
        title: '桌面端，主站，选择添加2FA'
      });
    }
  }

  async fill2FACode(code) {
    this._tp_.tasklog({ message: '填写2FA验证码', logID: 'RG-Info-Operate' });
    return this.fillInput(
      this._tp_.ctxPage.locator('#ch-auth-app-code-input'),
      code,
      {
        title: '桌面端，主站，填写2FA验证码'
      }
    );
  }

  async submit2FA() {
    this._tp_.tasklog({ message: '添加2FA', logID: 'RG-Info-Operate' });
    return this.clickElement(this._tp_.ctxPage.locator('#ch-auth-app-submit'), {
      title: '桌面端，主站，添加2FA',
      waitForURL: true
    });
  }

  async fill2FAEmailCode(code) {
    this._tp_.tasklog({ message: '填写开启2FA邮件验证码', logID: 'RG-Info-Operate' });
    return this.fillInput(this._tp_.ctxPage.locator('#input-box-otp'), code, {
      title: '桌面端，主站，填写开启2FA邮件验证码'
    });
  }

  async submitTwoStepVerification() {
    const enableMfaFormSubmit = this._tp_.ctxPage.locator('#enable-mfa-form-submit');
    await enableMfaFormSubmit.waitFor();
    
    await enableMfaFormSubmit.evaluate(el => {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    
    this._tp_.tasklog({ message: '提交两步验证', logID: 'RG-Info-Operate' });
    return this.clickElement(enableMfaFormSubmit, {
      title: '桌面端，主站，提交两步验证',
      waitForURL: true
    });
  }

  /**
   * Registration Status Handling
   */
  async checkRegistrationStatus() {
    const workflow = createPollingFactory({ interval: 5000, maxWait: 60000 });
    
    return workflow(async () => {
      const url = this._tp_.ctxPage.url();
      
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

  async handle2FASetup() {
    this.logRegistrationSuccess();
    
    await this.expandAuthenticatorApp();
    await this.get2FASecret();
    this._tp_.tasklog({ message: '2FAToken获取成功', logID: 'RG-Info-Operate' });
    
    const otp = await this.getStableTOTP();
    await this.fill2FACode(otp.code);
    await this.submit2FA();
    
    this._tp_.tasklog({
      message: '绑定2FA成功',
      logID: 'RG-Bind-Otp',
      account: {
        userEmail: this.accountInfo.user,
        otpSecret: this.accountInfo.otpSecret
      }
    });
    
    try {
      await this._tp_.ctxPage.goto('https://www.amazon.com', { timeout: 15000 });
    } catch {}
  }

  async handle2FAManualSetup() {
    this.logRegistrationSuccess();
    
    await this._tp_.ctxPage.goto('https://www.amazon.com', { timeout: 60000 });
    await this.goToHomepage();
    await this.goToLoginSecurity();
    await this.goToStepVerification();
    await this.expandAuthenticatorApp();
    await this.get2FASecret();
    this._tp_.tasklog({ message: '2FAToken获取成功', logID: 'RG-Info-Operate' });
    
    const otp = await this.getStableTOTP();
    await this.fill2FACode(otp.code);
    
    this.registerTime = Date.now();
    await this.submit2FA();
    
    const code = await this.getEmailVerificationCode();
    await this.fill2FAEmailCode(code);
    await this.submitEmailVerification('load');
    
    this._tp_.tasklog({
      message: '绑定2FA成功',
      logID: 'RG-Bind-Otp',
      account: {
        userEmail: this.accountInfo.user,
        otpSecret: this.accountInfo.otpSecret
      }
    });
    
    await this.submitTwoStepVerification();
    
    if (!this._tp_.taskRegisterConfig.bindAddress) {
      await this.goToNavLogo();
    }
  }

  async retryRegistration() {
    this._tp_.tasklog({ message: '需要绑定手机，尝试重新注册', logID: 'Warn-Info' });
    await this._tp_.ctxPage.waitForTimeout(utilRandomAround(1000, 1500));
    
    // Navigate back to registration page
    while (!this._tp_.ctxPage.url().includes('/ap/register?')) {
      await this._tp_.ctxPage.goBack();
      await this._tp_.ctxPage.waitForTimeout(utilRandomAround(1000, 1500));
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
   * Navigation Operations
   */
  async goToNavLogo() {
    return this.clickElement(this._tp_.ctxPage.locator('#nav-logo-sprites'), {
      title: '桌面端，主站，首页logo',
      waitForURL: true
    });
  }

  async goToHomepage() {
    this._tp_.tasklog({ message: '打开个人中心', logID: 'RG-Info-Operate' });
    return this.clickElement(
      this._tp_.ctxPage.locator('a[data-nav-role="signin"]').first(),
      {
        title: '桌面端，主站，打开个人中心',
        waitForURL: true
      }
    );
  }

  async goToLoginSecurity() {
    this._tp_.tasklog({ message: '打开安全中心', logID: 'RG-Info-Operate' });
    return this.clickElement(
      this._tp_.ctxPage.locator('a[href*="ap/cnep"]').first(),
      {
        title: '桌面端，主站，打开安全中心',
        waitForURL: true
      }
    );
  }

  async goToStepVerification() {
    this._tp_.tasklog({ message: '打开两步验证', logID: 'RG-Info-Operate' });
    return this.clickElement(
      this._tp_.ctxPage.locator('a[href*="/a/settings/approval/setup/register?"]'),
      {
        title: '桌面端，主站，打开两步验证',
        waitForURL: true
      }
    );
  }

  /**
   * Event Emitter Operations
   */
  requestEmail(containerCode) {
    return new Promise(resolve => {
      const { nodeEmitter } = require('../../../utils/eventEmitter');
      nodeEmitter.once('RESPONSE_EMAIL', (info) => {
        resolve(info);
      });
      nodeEmitter.emit('REQUEST_EMAIL', containerCode);
    });
  }

  requestPhone(containerCode) {
    return new Promise(resolve => {
      const { nodeEmitter } = require('../../../utils/eventEmitter');
      nodeEmitter.once('RESPONSE_PHONE', (info) => {
        resolve(info);
      });
      nodeEmitter.emit('REQUEST_PHONE', containerCode);
    });
  }

  /**
   * Helper Methods
   */
  async clickElement(element, options) {
    const oldUrl = this._tp_.ctxPage.url();
    
    try {
      await element.click({ delay: utilFluctuateAround(150) });
      await this._tp_.ctxPage.waitForTimeout(utilRandomAround(2000, 5000));
      
      if (options.waitForURL) {
        await this._tp_.ctxPage.waitForURL(
          u => u.href !== oldUrl,
          { timeout: 120000 }
        );
        await this._tp_.ctxPage
          .waitForLoadState(options.waitUntil || 'load')
          .catch(() => {});
      }
    } catch {
      this._tp_.createError({
        message: `${options.title} 操作失败`,
        logID: 'Error-Info'
      });
    }
  }

  async fillInput(element, str, options) {
    const chars = str.split('');
    
    try {
      await element.click({ delay: utilRandomAround(150) });
      await this._tp_.ctxPage.waitForTimeout(
        options.preDelay || utilRandomAround(250, 500)
      );
      
      for (let i = 0; i < chars.length; i++) {
        await element.press(chars[i], {
          delay: utilFluctuateAround(options.slowMo || 120)
        });
      }
      
      await this._tp_.ctxPage.waitForTimeout(
        options.postDelay || utilRandomAround(1000, 1500)
      );
    } catch {
      this._tp_.createError({
        message: `${options.title} 操作失败`,
        logID: 'Error-Info'
      });
    }
  }

  logRegistrationSuccess() {
    this._tp_.tasklog({
      message: '注册成功，等待绑定2FA',
      logID: 'RG-Success',
      account: {
        userEmail: this.accountInfo.user,
        password: this.accountInfo.password
      }
    });
  }
}

module.exports = { RegisterOperations };
