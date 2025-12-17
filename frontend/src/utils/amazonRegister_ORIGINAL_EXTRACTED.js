/**
 * ============================================
 * Amazon Registration - Original Toolbox Code
 * ============================================
 * 
 * 从原始 toolbox 的 task.worker.js 中提取的完整 Amazon 批量注册代码
 * 原文件: C:\Users\sxh\AppData\Local\toolbox\lib\resources\task.worker.js
 * 提取时间: 2024
 * 
 * 这是 NestJS 服务类的原始实现，包含完整的 Playwright 自动化逻辑
 */

// ============================================
// RegisterDesktopOperateService - 注册服务类
// ============================================

class RegisterDesktopOperateService {
    constructor(_tp_, emailSerive) {
        this._tp_ = _tp_;
        this.emailSerive = emailSerive;
        this.#registerTime = null;
        this.#emailServiceInfo = null;
        this.#accountInfo = null;
    }

    // ========== 私有变量 ==========
    #registerTime;
    #emailServiceInfo;
    #accountInfo;

    // ========== 页面导航操作 ==========

    /**
     * 点击首页 Logo
     */
    async #mainOperateNavlogo() {
        return this.#onClick(this._tp_.ctxPage.locator('#nav-logo-sprites'), {
            title: '桌面端，主站，首页logo',
            waitForURL: true
        });
    }

    /**
     * 打开个人中心
     */
    async #mainOperateHomepage() {
        this._tp_.tasklog({ message: '打开个人中心', logID: 'RG-Info-Operate' });
        return this.#onClick(this._tp_.ctxPage.locator('a[data-nav-role="signin"]').first(), {
            title: '桌面端，主站，打开个人中心',
            waitForURL: true
        });
    }

    /**
     * 打开安全中心
     */
    async #mainOperateLoginSecurity() {
        this._tp_.tasklog({ message: '打开安全中心', logID: 'RG-Info-Operate' });
        return this.#onClick(this._tp_.ctxPage.locator('a[href*="ap/cnep"]').first(), {
            title: '桌面端，主站，打开安全中心',
            waitForURL: true
        });
    }

    /**
     * 打开两步验证
     */
    async #mainOperateStepVerification() {
        this._tp_.tasklog({ message: '打开两步验证', logID: 'RG-Info-Operate' });
        return this.#onClick(this._tp_.ctxPage.locator('a[href*="/a/settings/approval/setup/register?"]'), {
            title: '桌面端，主站，打开两步验证',
            waitForURL: true
        });
    }

    /**
     * 选择语言
     */
    async #mainOperateLanguageSelect() {
        await this._tp_.ctxPage.waitForTimeout(utilRandomAround(5000, 7500));
        const languageSelect = this._tp_.ctxPage.locator('button[data-popup-id="footer-nav-country-picker-popup"]');
        await languageSelect.waitFor();
        await languageSelect.evaluate(el => {
            el.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        });
        await this._tp_.ctxPage.waitForTimeout(utilRandomAround(5000, 7500));
        this._tp_.tasklog({ message: '选择语言', logID: 'RG-Info-Operate' });
        return this.#onClick(languageSelect, {
            title: '桌面端，主站，选择语言'
        });
    }

    /**
     * 进入主站
     */
    async #mainOperateSellRegister() {
        await this._tp_.ctxPage.waitForTimeout(utilRandomAround(3000, 5000));
        this._tp_.tasklog({ message: '进入主站', logID: 'RG-Info-Operate' });
        return this.#onClick(this._tp_.ctxPage.locator('a[href*="https://sell.amazon.com?initialSessionID"]'), {
            title: '桌面端，主站，进入主站',
            waitForURL: this._tp_.taskRegisterConfig.language === 'en-US'
        });
    }

    /**
     * 准备注册
     */
    async #mainOperateSellSigninUp() {
        this._tp_.tasklog({ message: '准备注册', logID: 'RG-Info-Operate' });
        await this._tp_.ctxPage.waitForTimeout(utilRandomAround(5000, 7500));
        return this.#onClick(this._tp_.ctxPage.locator('.button.button-type-primary.font-size-xlarge.button-focus-default').first(), {
            title: '桌面端，主站，准备注册',
            waitForURL: true
        });
    }

    /**
     * 创建账户
     */
    async #mainOperateSellCreate() {
        this._tp_.tasklog({ message: '创建账户', logID: 'RG-Info-Operate' });
        return this.#onClick(this._tp_.ctxPage.locator('#createAccountSubmit'), {
            title: '桌面端，主站，创建账户',
            waitForURL: true,
            waitUntil: 'networkidle'
        });
    }

    // ========== 表单填写操作 ==========

    /**
     * 输入用户名
     */
    async #mainOperateAccountUsername(name) {
        this._tp_.tasklog({ message: '输入用户名', logID: 'RG-Info-Operate' });
        return this.#onFill(this._tp_.ctxPage.locator('#ap_customer_name'), name, {
            title: '桌面端，主站，填写用户名',
            preDelay: utilRandomAround(1000, 2000),
            postDelay: utilRandomAround(4000, 6000),
        });
    }

    /**
     * 输入邮箱
     */
    async #mainOperateAccountEmail(email) {
        this._tp_.tasklog({ message: '输入邮箱', logID: 'RG-Info-Operate' });
        return this.#onFill(this._tp_.ctxPage.locator('#ap_email'), email, {
            title: '桌面端，主站，填写邮箱',
            preDelay: utilRandomAround(1000, 2000),
            postDelay: utilRandomAround(4000, 6000),
        });
    }

    /**
     * 输入密码
     */
    async #mainOperateAccountPassword(password) {
        this._tp_.tasklog({ message: '输入密码', logID: 'RG-Info-Operate' });
        return this.#onFill(this._tp_.ctxPage.locator('#ap_password'), password, {
            title: '桌面端，主站，填写密码',
            preDelay: utilRandomAround(1000, 2000),
            postDelay: utilRandomAround(2000, 2500),
        });
    }

    /**
     * 再次确定密码
     */
    async #mainOperateAccountReEnterPassword(password) {
        this._tp_.tasklog({ message: '再次确定密码', logID: 'RG-Info-Operate' });
        return this.#onFill(this._tp_.ctxPage.locator('#ap_password_check'), password, {
            title: '桌面端，主站，再次确定密码',
            preDelay: utilRandomAround(1000, 2000),
            postDelay: utilRandomAround(2000, 2500),
        });
    }

    /**
     * 提交注册
     */
    async #mainOperateSellContinue() {
        this._tp_.tasklog({ message: '提交注册', logID: 'RG-Info-Operate' });
        return this.#onClick(this._tp_.ctxPage.locator('#continue'), {
            title: '桌面端，主站，提交注册',
            waitForURL: true
        });
    }

    // ========== 验证码处理 ==========

    /**
     * 点击 Captcha 坐标
     */
    async #mainOperateCaptchaSpot(position) {
        return this._tp_.ctxPage.locator('#captcha-container').locator('canvas').first().click({
            delay: utilFluctuateAround(150),
            position
        });
    }

    /**
     * 确认 Captcha
     */
    async #mainOperateCaptchaConfirm() {
        return this.#onClick(this._tp_.ctxPage.locator('#amzn-btn-verify-internal'), {
            title: '桌面端，主站，过人机验证',
            waitForURL: true,
            waitUntil: 'networkidle'
        });
    }

    /**
     * 填写邮箱验证码
     */
    async #mainOperateSecurityCode(code) {
        this._tp_.tasklog({ message: '填写邮箱验证码', logID: 'RG-Info-Operate' });
        return this.#onFill(this._tp_.ctxPage.locator('input.cvf-widget-input.cvf-widget-input-code.cvf-autofocus').first(), code, {
            title: '桌面端，主站，填写邮箱验证码',
            preDelay: utilRandomAround(1000, 2000),
            postDelay: utilRandomAround(2000, 2500),
        });
    }

    /**
     * 确定添加邮箱
     */
    async #mainOperateVerify(waitUntil = 'networkidle') {
        this._tp_.tasklog({ message: '确定添加邮箱', logID: 'RG-Info-Operate' });
        return this.#onClick(this._tp_.ctxPage.locator('#cvf-submit-otp-button'), {
            title: '桌面端，主站，确定添加邮箱',
            waitForURL: true,
            waitUntil
        });
    }

    // ========== 手机号处理 ==========

    /**
     * 填写手机号
     */
    async #mainOperatePhoneNumber(number) {
        this._tp_.tasklog({ message: '填写手机号', logID: 'RG-Info-Operate' });
        return this.#onFill(this._tp_.ctxPage.locator('#cvfPhoneNumber'), number, {
            title: '桌面端，主站，填写手机号',
            preDelay: utilRandomAround(1000, 2000),
            postDelay: utilRandomAround(2000, 2500),
        });
    }

    /**
     * 提交手机号
     */
    async #mainOperateAddPhoneNumber() {
        this._tp_.tasklog({ message: '提交手机号', logID: 'RG-Info-Operate' });
        return this.#onClick(this._tp_.ctxPage.locator('#a-autoid-0').locator('.a-button-input.notranslate'), {
            title: '桌面端，主站，提交手机号'
        });
    }

    /**
     * 填写手机验证码
     */
    async #mainOperatePhoneNumberCode(code) {
        this._tp_.tasklog({ message: '填写手机验证码', logID: 'RG-Info-Operate' });
        return this.#onFill(this._tp_.ctxPage.locator('#cvf-input-code'), code, {
            title: '桌面端，主站，填写手机验证码',
            preDelay: utilRandomAround(1000, 2000),
            postDelay: utilRandomAround(2000, 2500),
        });
    }

    /**
     * 确定添加手机号
     */
    async #mainOperateAddPhoneSumbit() {
        this._tp_.tasklog({ message: '确定添加手机号', logID: 'RG-Info-Operate' });
        return this.#onClick(this._tp_.ctxPage.locator('#cvf-submit-otp-button').locator('.a-button-input.notranslate'), {
            title: '桌面端，主站，确定添加手机号',
            waitForURL: true,
            waitUntil: 'networkidle'
        });
    }

    // ========== 2FA 操作 ==========

    /**
     * 填写 2FA 验证码
     */
    async #mainOperate2faCode(code) {
        this._tp_.tasklog({ message: '填写2FA验证码', logID: 'RG-Info-Operate' });
        return this.#onFill(this._tp_.ctxPage.locator('#ch-auth-app-code-input'), code, {
            title: '桌面端，主站，填写2FA验证码'
        });
    }

    /**
     * 添加 2FA
     */
    async #mainOperate2faSubmit() {
        this._tp_.tasklog({ message: '添加2FA', logID: 'RG-Info-Operate' });
        return this.#onClick(this._tp_.ctxPage.locator('#ch-auth-app-submit'), {
            title: '桌面端，主站，添加2FA',
            waitForURL: true
        });
    }

    /**
     * 选择添加 2FA
     */
    async #mainOperateAuthenticatorApp() {
        const box = this._tp_.ctxPage.locator('#sia-otp-accordion-totp-header');
        const expanded = await box.getAttribute('aria-expanded');
        if (expanded === 'false') {
            this._tp_.tasklog({ message: '选择添加2FA', logID: 'RG-Info-Operate' });
            await this.#onClick(box, {
                title: '桌面端，主站，选择添加2FA'
            });
        }
    }

    /**
     * 填写开启 2FA 邮件验证码
     */
    async #mainOperateInputBoxOtp(code) {
        this._tp_.tasklog({ message: '填写开启2FA邮件验证码', logID: 'RG-Info-Operate' });
        return this.#onFill(this._tp_.ctxPage.locator('#input-box-otp'), code, {
            title: '桌面端，主站，填写开启2FA邮件验证码'
        });
    }

    /**
     * 提交两步验证
     */
    async mainOperateSetupVerification() {
        const enableMfaFormSubmit = this._tp_.ctxPage.locator('#enable-mfa-form-submit');
        await enableMfaFormSubmit.waitFor();
        await enableMfaFormSubmit.evaluate(el => {
            el.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest'
            });
        });
        this._tp_.tasklog({ message: '提交两步验证', logID: 'RG-Info-Operate' });
        return this.#onClick(enableMfaFormSubmit, {
            title: '桌面端，主站，提交两步验证',
            waitForURL: true
        });
    }

    // ========== 基础交互方法 ==========

    /**
     * 点击元素
     */
    async #onClick(element, options) {
        const oldUrl = this._tp_.ctxPage.url();
        try {
            await element.click({ delay: utilFluctuateAround(150) });
            await this._tp_.ctxPage.waitForTimeout(utilRandomAround(2000, 5000));
            if (options.waitForURL) {
                await this._tp_.ctxPage.waitForURL(u => u.href !== oldUrl, { timeout: 120000 });
                await this._tp_.ctxPage.waitForLoadState(options.waitUntil || 'load').catch(() => { });
            }
        }
        catch {
            this._tp_.createError({ message: `${options.title} 操作失败`, logID: 'Error-Info' });
        }
    }

    /**
     * 填写表单
     */
    async #onFill(element, str, options) {
        const chars = str.split('');
        try {
            await element.click({ delay: utilRandomAround(150) });
            await this._tp_.ctxPage.waitForTimeout(options.preDelay || utilRandomAround(250, 500));
            for (let i = 0; i < chars.length; i++) {
                await element.press(chars[i], { delay: utilFluctuateAround(options.slowMo || 120) });
            }
            await this._tp_.ctxPage.waitForTimeout(options.postDelay || utilRandomAround(1000, 1500));
        }
        catch {
            this._tp_.createError({ message: `${options.title} 操作失败`, logID: 'Error-Info' });
        }
    }

    // ========== 检查状态 ==========

    /**
     * 检查是否需要 Captcha
     */
    async #checkIsCaptcha() {
        try {
            await this._tp_.ctxPage.locator('#cvf-aamation-container').waitFor({ timeout: 3000 });
            return true;
        }
        catch {
            return false;
        }
    }

    /**
     * 获取注册状态
     */
    async #registerSetupStatus() {
        const workflow = createPollingFactory({ interval: 5000, maxWait: 60000 });
        return workflow(async () => {
            const url = this._tp_.ctxPage.url();
            if (url.includes('/a/settings/approval/setup/register?')) {
                return Promise.resolve(201);
            }
            else if (url.includes('/a/settings/otpdevices/add?')) {
                return Promise.resolve(301);
            }
            else if (url.includes('ap/cvf/verify')) {
                return Promise.resolve(401);
            }
            else {
                throw new Error('error');
            }
        });
    }

    // ========== Captcha 处理 ==========

    /**
     * 获取 Captcha 数据
     */
    async #captchaSource() {
        try {
            const response = await this._tp_.ctxPage.waitForResponse(/ait\/ait\/ait\/problem\?.+$/, { timeout: 60000 });
            if (response.request().timing().startTime > this.#registerTime) {
                const data = await response.json();
                const token = '58e9d0ae-8322-4c89-b6c5-cd035a684b02';
                const { assets, localized_assets } = data;
                return { token, queries: JSON.parse(assets.images), question: localized_assets.target0 };
            }
        }
        catch {
            this._tp_.createError({ message: '获取Captcha数据失败', logID: 'Error-Info' });
        }
    }

    /**
     * 解析 Captcha
     */
    async #getCaptchaPass(props) {
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
                    'Authorization': `Bearer ${props.token}`,
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
            }
            else {
                throw new Error('error');
            }
        }, props);
    }

    /**
     * 过 Captcha
     */
    async #filterCaptcha() {
        const captchaSource = await this.#captchaSource();
        const result = await this.#getCaptchaPass(captchaSource);
        const position = utilGenerateGridPositions({
            width: 324,
            height: 324,
            source: result,
            gap: 16,
            padding: 16
        });
        for (let i = 0; i < result.length; i++) {
            await this.#mainOperateCaptchaSpot(position[i]);
            await this._tp_.ctxPage.waitForTimeout(utilRandomAround(750, 1000));
        }
        await this.#mainOperateCaptchaConfirm();
    }

    // ========== 验证码获取 ==========

    /**
     * 获取邮箱验证码
     */
    async #getEmailVerifyCode() {
        await this._tp_.ctxPage.waitForTimeout(utilRandomAround(10000, 15000));
        const { refresh_token, client_id } = this.#emailServiceInfo;
        const workflow = createPollingFactory({
            error: (error) => {
                this._tp_.tasklog({ message: `获取邮箱验证码失败，${error.message}，重试`, logID: 'Warn-Info' });
            },
            complete: () => {
                this._tp_.createError({ message: '获取邮箱验证码失败', logID: 'Error-Info' });
            },
            stop: () => this._tp_.taskRegisterConfig.pageClose
        });
        return workflow(async (start) => {
            const res = await this.emailSerive.getInboxLatest({ refresh_token, client_id });
            if (!Array.isArray(res) || res.length === 0)
                throw new Error('没有取到任何邮件');
            const mail = res.find(m => m.from === 'account-update@amazon.com' && m.timestamp > start);
            if (!mail)
                throw new Error('没有取到预期邮件');
            this._tp_.tasklog({ message: '获取邮箱验证码成功', logID: 'RG-Info-Operate' });
            return utilExtractEmailCode(mail.html)[0];
        }, this.#registerTime);
    }

    /**
     * 获取手机验证码
     */
    async #getPhoneVerifyCode(api) {
        await this._tp_.ctxPage.waitForTimeout(utilRandomAround(10000, 15000));
        const workflow = createPollingFactory({
            error: (error) => {
                this._tp_.tasklog({ message: `获取手机验证码失败，${error.message}，重试`, logID: 'Warn-Info' });
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
            }
            else if (contentType.includes('application/json')) {
                const jsonData = await res.json();
                text = utilFlattenObject(jsonData);
            }
            else {
                throw new Error('接口返回格式不正确');
            }
            const match = codeRegex.exec(text);
            if (!match)
                throw new Error('未识别到验证码');
            this._tp_.tasklog({ message: '获取手机验证码成功', logID: 'RG-Info-Operate' });
            return match[0];
        }, /\b\d{6}\b/, api);
    }

    /**
     * 获取 2FA Secret
     */
    async #get2faSecret() {
        this._tp_.tasklog({ message: '等待绑定2FA', logID: 'RG-Info-Operate' });
        const _2faText = await this._tp_.ctxPage.locator('#sia-auth-app-formatted-secret').innerText();
        this.#accountInfo.otpSecret = _2faText.replace(/\s+/g, '');
    }

    /**
     * 获取稳定的 TOTP
     */
    async #getStableTOTP() {
        await this._tp_.ctxPage.waitForTimeout(utilRandomAround(20000, 25000));
        const { remainingTime } = await utilGenerateTOTP(this.#accountInfo.otpSecret);
        if (remainingTime < 4) {
            await this._tp_.ctxPage.waitForTimeout(utilRandomAround(5000, 7000));
        }
        return utilGenerateTOTP(this.#accountInfo.otpSecret);
    }

    // ========== 请求数据 ==========

    /**
     * 请求手机号
     */
    #requestPhone(containerCode) {
        return new Promise(resolve => {
            nodeEmitter.once('RESPONSE_PHONE', (info) => {
                resolve(info);
            });
            nodeEmitter.emit('REQUEST_PHONE', containerCode);
        });
    }

    /**
     * 请求邮箱
     */
    #requestEmail(containerCode) {
        return new Promise(resolve => {
            nodeEmitter.once('RESPONSE_EMAIL', (info) => {
                resolve(info);
            });
            nodeEmitter.emit('REQUEST_EMAIL', containerCode);
        });
    }

    // ========== 状态处理 ==========

    /**
     * 尝试重新注册
     */
    async #tryRegisterAgain() {
        this._tp_.tasklog({ message: '需要绑定手机，尝试重新注册', logID: 'Warn-Info' });
        await this._tp_.ctxPage.waitForTimeout(utilRandomAround(1000, 1500));
        while (!this._tp_.ctxPage.url().includes('/ap/register?')) {
            await this._tp_.ctxPage.goBack();
            await this._tp_.ctxPage.waitForTimeout(utilRandomAround(1000, 1500));
        }
        await this.#mainOperateAccountPassword(this.#accountInfo.password);
        await this.#mainOperateAccountReEnterPassword(this.#accountInfo.password);
        this.#registerTime = Date.now();
        await this.#mainOperateSellContinue();
        if (await this.#checkIsCaptcha()) {
            await this.#filterCaptcha();
        }
        const code2 = await this.#getEmailVerifyCode();
        await this.#mainOperateSecurityCode(code2);
        await this.#mainOperateVerify();
    }

    /**
     * 状态 201 处理
     */
    async #status201() {
        this.#registerSuccess();
        await this.#mainOperateAuthenticatorApp();
        await this.#get2faSecret();
        this._tp_.tasklog({ message: '2FAToken获取成功', logID: 'RG-Info-Operate' });
        const otp = await this.#getStableTOTP();
        await this.#mainOperate2faCode(otp.code);
        await this.#mainOperate2faSubmit();
        this._tp_.tasklog({ message: '绑定2FA成功', logID: 'RG-Bind-Otp', account: {
                userEmail: this.#accountInfo.user,
                otpSecret: this.#accountInfo.otpSecret
            } });
        try {
            await this._tp_.ctxPage.goto('https://www.amazon.com', { timeout: 15000 });
        }
        catch { }
    }

    /**
     * 状态 301 处理
     */
    async #status301() {
        this.#registerSuccess();
        await this._tp_.ctxPage.goto('https://www.amazon.com', { timeout: 60000 });
        await this.#mainOperateHomepage();
        await this.#mainOperateLoginSecurity();
        await this.#mainOperateStepVerification();
        await this.#mainOperateAuthenticatorApp();
        await this.#get2faSecret();
        this._tp_.tasklog({ message: '2FAToken获取成功', logID: 'RG-Info-Operate' });
        const otp = await this.#getStableTOTP();
        await this.#mainOperate2faCode(otp.code);
        this.#registerTime = Date.now();
        await this.#mainOperate2faSubmit();
        const code = await this.#getEmailVerifyCode();
        await this.#mainOperateInputBoxOtp(code);
        await this.#mainOperateVerify('load');
        this._tp_.tasklog({ message: '绑定2FA成功', logID: 'RG-Bind-Otp', account: {
                userEmail: this.#accountInfo.user,
                otpSecret: this.#accountInfo.otpSecret
            } });
        await this.mainOperateSetupVerification();
        if (!this._tp_.taskRegisterConfig.bindAddress)
            await this.#mainOperateNavlogo();
    }

    /**
     * 状态 401 处理
     */
    async #status401() {
        const { number, api } = await this.#requestPhone(this._tp_.taskBaseConfig.containerCode);
        await this.#mainOperatePhoneNumber(number);
        await this.#mainOperateAddPhoneNumber();
        const phoneCode = await this.#getPhoneVerifyCode(api);
        await this.#mainOperatePhoneNumberCode(phoneCode);
        await this.#mainOperateAddPhoneSumbit();
        this.#registerSuccess();
    }

    /**
     * 注册成功
     */
    #registerSuccess() {
        this._tp_.tasklog({
            message: '注册成功，等待绑定2FA',
            logID: 'RG-Success',
            account: {
                userEmail: this.#accountInfo.user,
                password: this.#accountInfo.password
            }
        });
    }

    // ========== 主流程 ==========

    /**
     * 默认注册流程
     */
    async default() {
        // 选择语言（非美国站点）
        if (this._tp_.taskRegisterConfig.language !== 'en-US')
            await this.#mainOperateLanguageSelect();
        
        // 进入主站（非美国站点）
        if (this._tp_.taskRegisterConfig.language !== 'en-US')
            await this.#mainOperateSellRegister();
        
        // 准备注册
        await this.#mainOperateSellSigninUp();
        await this.#mainOperateSellCreate();
        
        // 请求邮箱
        const { user, client_id, refresh_token } = await this.#requestEmail(this._tp_.taskBaseConfig.containerCode);
        this.#emailServiceInfo = { client_id, refresh_token };
        
        // 生成账户信息
        const username = utilEmailToName(user);
        const password = utilGeneratePassword(username);
        this.#accountInfo = { user, password };
        
        // 填写注册信息
        await this.#mainOperateAccountUsername(username);
        await this.#mainOperateAccountEmail(user);
        await this.#mainOperateAccountPassword(password);
        await this.#mainOperateAccountReEnterPassword(password);
        this.#registerTime = Date.now();
        await this.#mainOperateSellContinue();
        
        // 处理 Captcha
        if (await this.#checkIsCaptcha()) {
            this._tp_.updateRegisterConfig(conf => { conf.isCaptcha = true; });
            this._tp_.tasklog({ message: '需要人机验证', logID: 'Warn-Info' });
            await this.#filterCaptcha();
        }
        
        // 邮箱验证
        const code1 = await this.#getEmailVerifyCode();
        await this.#mainOperateSecurityCode(code1);
        await this.#mainOperateVerify();
        
        // 根据状态处理
        switch (await this.#registerSetupStatus()) {
            case 201: {
                await this.#status201();
                break;
            }
            case 301: {
                await this.#status301();
                break;
            }
            case 401: {
                await this.#tryRegisterAgain();
                switch (await this.#registerSetupStatus()) {
                    case 201: {
                        await this.#status201();
                        break;
                    }
                    case 301: {
                        await this.#status301();
                        break;
                    }
                    case 401: {
                        this._tp_.updateRegisterConfig(conf => {
                            conf.notUseEmail = this.#accountInfo.user;
                        });
                        this._tp_.createError({ message: '注册失败', logID: 'Error-Info' });
                        break;
                    }
                }
                break;
            }
        }
    }
}

// ============================================
// 工具函数占位符（需要从 tool_1 模块引入）
// ============================================

function utilRandomAround(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function utilFluctuateAround(base) {
    const variance = base * 0.2;
    return Math.floor(base + (Math.random() - 0.5) * variance);
}

function utilEmailToName(email) {
    return email.split('@')[0];
}

function utilGeneratePassword(username) {
    return username + Math.random().toString(36).slice(2, 8).toUpperCase() + '!';
}

function utilExtractEmailCode(html) {
    const match = html.match(/\b\d{6}\b/g);
    return match || [];
}

function utilFlattenObject(obj) {
    return JSON.stringify(obj);
}

function utilGenerateTOTP(secret) {
    // TOTP 生成逻辑（需要实现）
    return { code: '123456', remainingTime: 30 };
}

function utilGenerateGridPositions(config) {
    // 网格位置生成逻辑（需要实现）
    const positions = [];
    const { width, height, source, gap, padding } = config;
    const cellSize = (width - padding * 2 - gap * 2) / 3;
    
    for (let i = 0; i < source.length; i++) {
        const col = source[i] % 3;
        const row = Math.floor(source[i] / 3);
        positions.push({
            x: padding + col * (cellSize + gap) + cellSize / 2,
            y: padding + row * (cellSize + gap) + cellSize / 2
        });
    }
    
    return positions;
}

function createPollingFactory(options) {
    return async function(fn, ...args) {
        const { interval = 3000, maxWait = 60000, error, complete, stop } = options;
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWait) {
            if (stop && stop()) {
                throw new Error('Polling stopped by user');
            }
            
            try {
                return await fn(...args);
            } catch (err) {
                if (error) error(err);
                await new Promise(resolve => setTimeout(resolve, interval));
            }
        }
        
        if (complete) complete();
        throw new Error('Polling timeout');
    };
}

// ============================================
// 导出
// ============================================

module.exports = {
    RegisterDesktopOperateService
};
