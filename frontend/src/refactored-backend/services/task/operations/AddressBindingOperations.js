/**
 * AddressBindingOperations - Amazon Address Binding Operations
 * 
 * This service handles the Amazon address binding workflow:
 * - Navigate to account address settings
 * - Fill in address form (line1, city, state, postal code, phone)
 * - Handle Amazon's address suggestions
 * - Confirm and save address
 * 
 * Workflow:
 * 1. Get initial address info from Amazon page or generate new
 * 2. Navigate to address management page
 * 3. Add new address with auto-suggestions handling
 * 4. Fill form fields in random order for human-like behavior
 * 5. Submit and confirm address
 */

const {
  utilRandomAround,
  utilFluctuateAround,
  createPollingFactory
} = require('../../../utils/toolUtils');

class AddressBindingOperations {
  /**
   * @param {Object} taskPublicService - Task public service instance
   * @param {Object} addressService - Address generation service
   */
  constructor(taskPublicService, addressService) {
    this._tp_ = taskPublicService;
    this.addressService = addressService;
    
    // Private state
    this.suggestedAddress = false;
    this.addressInfo = null;
  }

  /**
   * Main address binding workflow
   */
  async execute() {
    // Get address info from current Amazon page or generate new
    await this.getInitialAddressInfo();
    
    const { postCode } = this.addressInfo;
    
    // Generate address details (normalize different addressService return shapes)
    const genRes = postCode
      ? await this.addressService.generatePostalCodeAddress(postCode)
      : await this.addressService.generateRandomAddress();

    const genData = (genRes && genRes.data) ? genRes.data : genRes;

    const phone = genData.phoneNumber || genData.randomPhone || genData.phone || null;
    const addressLine1 = genData.addressLine1 || genData.address1 || '';
    const city = genData.city || genData.placeName || '';
    const stateCode = genData.stateCode || genData.countryCode || genData.stateAbbr || genData.state || '';
    const postalCode = genData.postalCode || genData.zip || genData.postal || '';
    
    // Navigate to address management
    await this.goToHomepage();
    await this.goToAccountAddress();
    await this.clickAddAddress();
    
    // Fill form in random order for human-like behavior
    const enterAddressFirst = Math.random() < 0.5;
    
    if (enterAddressFirst) {
      await this.fillPhoneNumber(phone);
      await this.fillAddressLine1(addressLine1);
    } else {
      await this.fillAddressLine1(addressLine1);
    }
    
    // Check for Amazon's address suggestions
    await this.handleAddressSuggestions();
    
    // Fill remaining fields if no suggestion was selected
    if (!this.suggestedAddress) {
      await this.fillCity(city);
      await this.selectState(stateCode);
      await this.fillPostalCode(postalCode);
    }
    
    // Fill phone number if not filled yet
    if (!enterAddressFirst) {
      await this.fillPhoneNumber(phone);
    }
    
    await this.submitAddress();
    await this.confirmSuggestedAddress();
    await this.goToNavLogo();
  }

  /**
   * Address Info Operations
   */
  async getInitialAddressInfo() {
    const workflow = createPollingFactory({
      error: () => {
        this._tp_.tasklog({ message: '获取地址信息失败，重试中...', logID: 'Warn-Info' });
      },
      stop: () => this._tp_.taskRegisterConfig.pageClose
    });
    
    return workflow(async () => {
      const address = await this._tp_.ctxPage.locator('#glow-ingress-line1').innerText();
      const postCode = address.replace(/\D/g, '');
      
      if (!postCode || postCode.length !== 5) {
        throw new Error('error');
      }
      
      const addressInfo = await fetch(`https://api.zippopotam.us/us/${postCode}`);
      
      if (!addressInfo.ok) {
        throw new Error('error');
      }
      
      const data = await addressInfo.json();
      
      this.addressInfo = {
        postCode,
        placeName: data.places[0]["place name"],
        state: data.places[0].state,
        stateAbbr: data.places[0]["state abbreviation"]
      };
      
      this._tp_.tasklog({ message: '获取地址信息成功', logID: 'RG-Info-Operate' });
    });
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

  async goToAccountAddress() {
    this._tp_.tasklog({ message: '打开地址设置', logID: 'RG-Info-Operate' });
    return this.clickElement(
      this._tp_.ctxPage.locator('a[href*="/a/addresses"]').first(),
      {
        title: '桌面端，主站，打开地址设置',
        waitForURL: true
      }
    );
  }

  async clickAddAddress() {
    this._tp_.tasklog({ message: '准备添加地址', logID: 'RG-Info-Operate' });
    return this.clickElement(
      this._tp_.ctxPage.locator('.a-box.first-desktop-address-tile').first(),
      {
        title: '桌面端，主站，准备添加地址',
        waitForURL: true
      }
    );
  }

  /**
   * Form Filling Operations
   */
  async fillPhoneNumber(number) {
    this._tp_.tasklog({ message: '输入手机号', logID: 'RG-Info-Operate' });
    return this.fillInput(
      this._tp_.ctxPage.locator('#address-ui-widgets-enterAddressPhoneNumber'),
      number,
      {
        title: '桌面端，主站，输入手机号',
        clearContent: true
      }
    );
  }

  async fillAddressLine1(line) {
    this._tp_.tasklog({ message: '输入地址1', logID: 'RG-Info-Operate' });
    return this.fillInput(
      this._tp_.ctxPage.locator('#address-ui-widgets-enterAddressLine1'),
      line,
      {
        title: '桌面端，主站，输入地址1'
      }
    );
  }

  async fillCity(city) {
    this._tp_.tasklog({ message: '输入城市', logID: 'RG-Info-Operate' });
    return this.fillInput(
      this._tp_.ctxPage.locator('#address-ui-widgets-enterAddressCity'),
      city,
      {
        title: '桌面端，主站，输入城市'
      }
    );
  }

  async selectState(value) {
    this._tp_.tasklog({ message: '选择州', logID: 'RG-Info-Operate' });
    return this._tp_.ctxPage
      .locator('#address-ui-widgets-enterAddressStateOrRegion-dropdown-nativeId')
      .selectOption(value);
  }

  async fillPostalCode(postCode) {
    this._tp_.tasklog({ message: '输入邮编', logID: 'RG-Info-Operate' });
    return this.fillInput(
      this._tp_.ctxPage.locator('#address-ui-widgets-enterAddressPostalCode'),
      postCode,
      {
        title: '桌面端，主站，输入邮编'
      }
    );
  }

  async submitAddress() {
    this._tp_.tasklog({ message: '确定添加地址', logID: 'RG-Info-Operate' });
    return this.clickElement(
      this._tp_.ctxPage.locator('#address-ui-widgets-form-submit-button').first(),
      {
        title: '桌面端，主站，确定添加地址',
        waitForURL: true
      }
    );
  }

  /**
   * Address Suggestion Operations
   */
  async handleAddressSuggestions() {
    const suggestion = this._tp_.ctxPage.locator('.awz-address-suggestion-item');
    
    try {
      await suggestion.waitFor({ timeout: 3000 });
      this.suggestedAddress = true;
    } catch {}
    
    if (this.suggestedAddress) {
      this._tp_.tasklog({ message: '选择亚马逊接口地址', logID: 'RG-Info-Operate' });
      return this.clickElement(suggestion.first(), {
        title: '桌面端，主站，选择亚马逊接口地址'
      });
    }
  }

  async confirmSuggestedAddress() {
    const suggested = this._tp_.ctxPage.locator(
      '.a-box-group.a-spacing-base.a-spacing-top-base'
    );
    
    try {
      await suggested.waitFor({ timeout: 3000 });
      this._tp_.tasklog({ message: '确定添加建议的地址', logID: 'RG-Info-Operate' });
      
      return this.clickElement(
        this._tp_.ctxPage
          .locator('input[name="address-ui-widgets-saveOriginalOrSuggestedAddress"]')
          .first(),
        {
          title: '桌面端，主站，确定添加建议的地址',
          waitForURL: true
        }
      );
    } catch {
      const successAddress = '/a/addresses?alertId=yaab-enterAddressSucceed';
      
      if (this._tp_.ctxPage.url().includes(successAddress)) {
        this._tp_.tasklog({ message: '地址添加成功', logID: 'RG-Info-Operate' });
      }
    }
  }

  /**
   * Helper Methods
   */
  async clickElement(element, options) {
    const oldUrl = this._tp_.ctxPage.url();
    
    try {
      await element.click({ delay: utilRandomAround(1000, 1500) });
      
      await this._tp_.ctxPage.waitForURL(
        u => u.href !== oldUrl,
        {
          timeout: 120000,
          waitUntil: 'load'
        }
      );
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
      if (options.clearContent) {
        await element.press('ControlOrMeta+A', {
          delay: utilFluctuateAround(options.slowMo || 105)
        });
        await this._tp_.ctxPage.waitForTimeout(utilRandomAround(250, 500));
        
        await element.press('Backspace', {
          delay: utilFluctuateAround(options.slowMo || 105)
        });
        await this._tp_.ctxPage.waitForTimeout(utilRandomAround(250, 500));
      }
      
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
}

module.exports = { AddressBindingOperations };
