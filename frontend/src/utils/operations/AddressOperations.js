/**
 * 地址绑定操作类 - 负责地址信息填写和提交
 */

const BaseOperations = require('./BaseOperations');
const AddressService = require('../../refactored-backend/services/address/AddressService');

class AddressOperations extends BaseOperations {
  /**
   * 点击添加地址按钮
   */
  async clickAddAddress() {
    this.tasklog({ message: '点击添加地址', logID: 'RG-Info-Operate' });
    
    const addButton = this.page.locator('#ya-myab-address-add-link, #address-ui-widgets-enterAddressFullName').first();
    await this.clickElement(addButton, {
      title: '桌面端，主站，点击添加地址',
      waitForURL: true
    });
  }

  /**
   * 填写电话号码
   */
  async fillPhoneNumber(phone) {
    this.tasklog({ message: '填写电话号码', logID: 'RG-Info-Operate' });
    await this.fillInput(
      this.page.locator('#address-ui-widgets-enterAddressPhoneNumber'),
      phone,
      { title: '桌面端，主站，填写电话号码' }
    );
  }

  /**
   * 填写地址行1
   */
  async fillAddressLine1(address) {
    this.tasklog({ message: '填写地址', logID: 'RG-Info-Operate' });
    await this.fillInput(
      this.page.locator('#address-ui-widgets-enterAddressLine1'),
      address,
      { title: '桌面端，主站，填写地址' }
    );
  }

  /**
   * 填写城市
   */
  async fillCity(city) {
    this.tasklog({ message: '填写城市', logID: 'RG-Info-Operate' });
    const locator = this.page.locator('#address-ui-widgets-enterAddressCity');
    const existing = await locator.inputValue().catch(() => '');

    if (existing && existing.trim().length > 0) {
      this.tasklog({ message: '城市输入框已有值，保留网站自动填充', logID: 'RG-Info-Operate' });
      return;
    }

    await this.fillInput(
      locator,
      city,
      { title: '桌面端，主站，填写城市' }
    );
  }

  /**
   * 选择州
   */
  async selectState(stateCode) {
    this.tasklog({ message: `选择州: ${stateCode}`, logID: 'RG-Info-Operate' });
    
    const stateDropdown = this.page.locator('#address-ui-widgets-enterAddressStateOrRegion');
    await stateDropdown.selectOption(stateCode);
    await this.waitRandom(500, 1000);
  }

  /**
   * 填写邮编
   */
  async fillPostalCode(postalCode) {
    this.tasklog({ message: '填写邮编', logID: 'RG-Info-Operate' });
    const locator = this.page.locator('#address-ui-widgets-enterAddressPostalCode');
    const existing = await locator.inputValue().catch(() => '');

    if (existing && existing.trim().length > 0) {
      this.tasklog({ message: '邮编输入框已有值，保留网站自动填充', logID: 'RG-Info-Operate' });
      return;
    }

    await this.fillInput(
      locator,
      postalCode,
      { title: '桌面端，主站，填写邮编' }
    );
  }

  /**
   * 提交地址表单
   */
  async submitAddress() {
    this.tasklog({ message: '提交地址', logID: 'RG-Info-Operate' });
    
    const submitButton = this.page.locator('#address-ui-widgets-form-submit-button');
    
    // 确保按钮可见
    const isVisible = await submitButton.isVisible({ timeout: 5000 }).catch(() => false);
    if (!isVisible) {
      this.tasklog({ 
        message: '警告：提交按钮不可见，尝试滚动到视图', 
        logID: 'RG-Info-Operate' 
      });
      
      await submitButton.evaluate(el => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      await this.waitRandom(1000, 1500);
    }
    
    await this.clickElement(submitButton, {
      title: '桌面端，主站，提交地址',
      waitForURL: true
    });
    
    await this.waitRandom(2000, 3000);
  }

  /**
   * 处理地址建议弹窗
   */
  async handleAddressSuggestions() {
    await this.waitRandom(2000, 3000);
    
    const suggestionButton = this.page.locator('#address-ui-widgets-use-address-as-entered');
    const isVisible = await suggestionButton.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (isVisible) {
      this.tasklog({ message: '处理地址建议弹窗', logID: 'RG-Info-Operate' });
      await this.clickElement(suggestionButton, { title: '使用输入的地址' });
    }
  }

  /**
   * 生成随机地址数据
   */
  async generateAddressData(postalCode) {
    this.tasklog({ message: '开始生成真实地址', logID: 'RG-Info-Operate' });
    
    const addressService = new AddressService();
    const result = await addressService.generateRandomAddress(postalCode);

    // 地址服务可能返回 { data: {...} } 或直接返回数据对象
    const addressData = (result && result.data) ? result.data : result;

    if (!addressData) {
      throw new Error(`地址生成失败: 返回数据为空`);
    }
    
    this.tasklog({ 
      message: `已生成真实地址: ${addressData.addressLine1}, ${addressData.city}, ${addressData.stateCode} ${addressData.postalCode}`, 
      logID: 'RG-Info-Operate' 
    });
    
    return addressData;
  }

  /**
   * 选择地址自动补全下拉框中的第一个选项
   */
  async selectFirstAddressAutocomplete() {
    try {
      await this.waitRandom(1000, 1500);
      
      // 寻找下拉框选项
      const optionCount = await this.page.locator('ul[role="listbox"] li').count();
      
      if (optionCount > 0) {
        this.tasklog({ message: '选择第一个地址补全选项', logID: 'RG-Info-Operate' });
        const firstOption = this.page.locator('ul[role="listbox"] li').first();
        await firstOption.click();
        await this.waitRandom(500, 1000);
        return true;
      }
      
      return false;
    } catch (error) {
      this.tasklog({ 
        message: `选择地址补全失败: ${error.message}`, 
        logID: 'Warn-Info' 
      });
      return false;
    }
  }

  /**
   * 处理地址保存确认界面
   */
  async handleAddressSaveConfirmation() {
    try {
      await this.waitRandom(2000, 3000);
      
      // 寻找保存或确认按钮
      const buttons = await this.page.$$('button');
      
      for (const button of buttons) {
        const text = await button.innerText().catch(() => '');
        if (text && (text.includes('Add address') || text.includes('确认') || text.includes('保存'))) {
          this.tasklog({ message: '点击地址保存确认按钮', logID: 'RG-Info-Operate' });
          await button.click();
          await this.waitRandom(1000, 1500);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * 确认建议的地址
   */
  async confirmSuggestedAddress() {
    try {
      await this.waitRandom(1000, 1500);
      
      const confirmButton = this.page.locator('#address-ui-widgets-use-suggested-address');
      const isVisible = await confirmButton.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (isVisible) {
        this.tasklog({ message: '确认Amazon建议的地址', logID: 'RG-Info-Operate' });
        await this.clickElement(confirmButton, { title: '确认建议的地址' });
        return true;
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * 完整的地址绑定流程
   */
  async bindAddress(accountInfo = {}, config = {}) {
    try {
      this.tasklog({ logID: 'ADDRESS_BIND_START', message: '开始地址绑定流程' });
      
      // 获取初始地址信息
      const addressInfo = await this.getInitialAddressInfo();
      const { postCode } = addressInfo;
      
      // 生成真实地址数据
      this.tasklog({ message: '正在生成真实地址信息...', logID: 'RG-Info-Operate' });
      
      let addressData;
      if (config.addressData) {
        addressData = config.addressData;
        this.tasklog({ message: '使用配置的地址数据', logID: 'RG-Info-Operate' });
      } else {
        const result = postCode 
          ? await this.generateAddressData(postCode)
          : await this.generateAddressData();
        addressData = result;
        
        this.tasklog({ 
          message: `已生成真实地址: ${addressData.addressLine1}, ${addressData.city}, ${addressData.stateCode} ${addressData.postalCode}`, 
          logID: 'RG-Info-Operate' 
        });
      }
      
      // 解构地址数据
      let { phoneNumber, addressLine1, city, stateCode, postalCode } = addressData;
      
      // 使用用户上传的手机号或生成新号
      if (config.phone) {
        phoneNumber = config.phone;
      } else if (!phoneNumber || phoneNumber === 'undefined') {
        const PhoneGenerator = require('../phoneGenerator');
        const phoneGen = new PhoneGenerator();
        phoneNumber = phoneGen.generatePhone();
        this.tasklog({ 
          message: `未上传手机号文件，已自动生成手机号: ${phoneNumber}`, 
          logID: 'RG-Info-Operate' 
        });
      }
      
      // 导航到地址管理
      await this.waitRandom(2000, 3000);
      await this.clickAddAddress();
      
      // 填写表单
      const enterAddressFirst = Math.random() < 0.5;
      if (enterAddressFirst) {
        await this.fillAddressFields({ phoneNumber, addressLine1 });
      } else {
        await this.fillAddressFields({ addressLine1 });
      }
      
      // 处理地址建议
      await this.handleAddressSuggestions();
      
      // 填写剩余字段
      if (!this.suggestedAddress) {
        await this.fillAddressFields({ city, stateCode, postalCode });
        await this.selectState(stateCode);
      }
      
      // 填写电话号码
      if (!enterAddressFirst) {
        await this.fillPhoneNumber(phoneNumber);
      }
      
      // 提交地址
      await this.submitAddress();
      
      // 处理确认
      await this.handleAddressSaveConfirmation();
      await this.confirmSuggestedAddress();
      
      this.tasklog({ logID: 'ADDRESS_BIND_SUCCESS', message: '地址绑定完成' });
      return true;
      
    } catch (error) {
      this.tasklog({ logID: 'ADDRESS_BIND_ERROR', message: `地址绑定失败: ${error.message}` });
      throw error;
    }
  }

  /**
   * 获取初始地址信息
   */
  async getInitialAddressInfo() {
    try {
      this.tasklog({ message: '获取初始地址信息', logID: 'RG-Info-Operate' });
      
      // 扫描页面中的邮编字段（如果有）
      const postalCodeInput = this.page.locator('input[name*="postal"], input[name*="zip"]').first();
      const postCode = await postalCodeInput.inputValue().catch(() => '');
      
      // 扫描其他初始信息
      const nameInput = this.page.locator('input[name*="name"]').first();
      const name = await nameInput.inputValue().catch(() => '');
      
      this.tasklog({ 
        message: `已获取初始信息: 邮编=${postCode}, 名字=${name}`, 
        logID: 'RG-Info-Operate' 
      });
      
      return {
        postCode: postCode,
        name: name
      };
    } catch (error) {
      this.tasklog({ 
        message: `获取初始地址信息失败: ${error.message}`, 
        logID: 'Warn-Info' 
      });
      return {};
    }
  }

  /**
   * 填写地址字段（支持多个字段）
   */
  async fillAddressFields(fields = {}) {
    const candidates = [];
    
    if (fields.addressLine1) {
      candidates.push({
        fill: () => this.fillAddressLine1(fields.addressLine1),
        name: 'addressLine1'
      });
    }
    if (fields.city) {
      candidates.push({
        fill: () => this.fillCity(fields.city),
        name: 'city'
      });
    }
    if (fields.postalCode) {
      candidates.push({
        fill: () => this.fillPostalCode(fields.postalCode),
        name: 'postalCode'
      });
    }
    if (fields.phoneNumber) {
      candidates.push({
        fill: () => this.fillPhoneNumber(fields.phoneNumber),
        name: 'phoneNumber'
      });
    }
    
    if (candidates.length === 0) {
      return;
    }
    
    // 随机选择一个字段执行删除重填
    const idx = Math.floor(Math.random() * candidates.length);
    
    for (let i = 0; i < candidates.length; i++) {
      await candidates[i].fill();
      
      if (i === idx) {
        // 这个字段执行删除重填
        await this.waitRandom(500, 1000);
        await candidates[i].fill();
      }
    }
  }
}

module.exports = AddressOperations;
