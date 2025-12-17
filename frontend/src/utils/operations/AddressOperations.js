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
    await this.fillInput(
      this.page.locator('#address-ui-widgets-enterAddressCity'),
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
    await this.fillInput(
      this.page.locator('#address-ui-widgets-enterAddressPostalCode'),
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
    
    if (!result.success) {
      throw new Error(`地址生成失败: ${result.error}`);
    }
    
    const addressData = result.data;
    
    this.tasklog({ 
      message: `已生成真实地址: ${addressData.addressLine1}, ${addressData.city}, ${addressData.stateCode} ${addressData.postalCode}`, 
      logID: 'RG-Info-Operate' 
    });
    
    return addressData;
  }
}

module.exports = AddressOperations;
