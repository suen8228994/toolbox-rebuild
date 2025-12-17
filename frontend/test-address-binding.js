/**
 * 测试脚本：地址绑定功能测试
 * 
 * 这个脚本模拟地址绑定的完整流程，包括：
 * 1. 导航到地址管理页面
 * 2. 填写地址表单
 * 3. 处理亚马逊地址建议
 * 4. 确认并保存地址
 */

const AmazonRegisterCore = require('./src/utils/amazonRegisterCore');

// 模拟 Page 对象（扩展版，支持地址绑定操作）
class MockPage {
  constructor(initialUrl) {
    this._url = initialUrl;
    this._logs = [];
    this._formData = {};
  }
  
  url() {
    return this._url;
  }
  
  setUrl(url) {
    this._url = url;
    this._logs.push(`URL changed to: ${url}`);
  }
  
  async goto(url, options) {
    this._url = url;
    this._logs.push(`goto: ${url}`);
  }
  
  async waitForTimeout(ms) {
    this._logs.push(`wait: ${ms}ms`);
  }
  
  async evaluate(fn) {
    return 'en-US';
  }
  
  locator(selector) {
    return new MockLocator(selector, this);
  }
  
  async waitForURL(predicate, options) {
    this._logs.push('waitForURL called');
  }
  
  async waitForLoadState(state) {
    this._logs.push(`waitForLoadState: ${state}`);
    return Promise.resolve();
  }
  
  mouse = {
    move: async (x, y) => {
      this._logs.push(`mouse move: (${x}, ${y})`);
    },
    click: async (x, y) => {
      this._logs.push(`mouse click: (${x}, ${y})`);
    }
  };
  
  getLogs() {
    return this._logs;
  }
  
  getFormData() {
    return this._formData;
  }
}

class MockLocator {
  constructor(selector, page) {
    this.selector = selector;
    this.page = page;
  }
  
  first() {
    return this;
  }
  
  async click(options) {
    this.page._logs.push(`click: ${this.selector}`);
    
    // 模拟 URL 变化
    if (this.selector.includes('data-nav-role="signin"')) {
      this.page.setUrl('https://www.amazon.com/gp/css/homepage.html');
    } else if (this.selector.includes('/a/addresses')) {
      this.page.setUrl('https://www.amazon.com/a/addresses');
    } else if (this.selector.includes('first-desktop-address-tile')) {
      this.page.setUrl('https://www.amazon.com/a/addresses/add');
    } else if (this.selector.includes('submit-button')) {
      this.page.setUrl('https://www.amazon.com/a/addresses?alertId=yaab-enterAddressSucceed');
    } else if (this.selector.includes('nav-logo')) {
      this.page.setUrl('https://www.amazon.com/');
    }
  }
  
  async boundingBox() {
    // Mock 方法，返回一个假的边界框
    return {
      x: 100,
      y: 100,
      width: 100,
      height: 50
    };
  }
  
  async fill(value) {
    this.page._logs.push(`fill: ${this.selector} = ${value}`);
    this.page._formData[this.selector] = value;
  }
  
  async press(key, options) {
    this.page._logs.push(`press: ${key}`);
  }
  
  async innerText() {
    // 模拟地址显示
    if (this.selector.includes('glow-ingress-line1')) {
      return 'Deliver to New York 10001';
    }
    return 'Mock Text';
  }
  
  async getAttribute(attr) {
    return 'false';
  }
  
  async selectOption(value) {
    this.page._logs.push(`selectOption: ${this.selector} = ${value}`);
    this.page._formData[this.selector] = value;
  }
  
  async waitFor(options) {
    // 模拟没有地址建议
    throw new Error('Element not found');
  }
}

// 测试用例
async function testAddressBinding() {
  console.log('='.repeat(60));
  console.log('测试 Amazon 地址绑定功能');
  console.log('='.repeat(60));
  console.log();
  
  // 测试用例 1: 完整地址绑定流程
  console.log('📋 测试用例 1: 完整地址绑定流程');
  console.log('-'.repeat(60));
  
  try {
    const mockPage = new MockPage('https://www.amazon.com/');
    
    const config = {
      page: mockPage,
      emailLine: 'test@example.com----password123----client_id----refresh_token',
      bindAddress: true,
      addressData: {
        randomPhone: '5551234567',
        addressLine1: '123 Main Street',
        city: 'New York',
        countryCode: 'NY',
        postalCode: '10001'
      }
    };
    
    const core = new AmazonRegisterCore(config);
    
    console.log('步骤 1: 初始化地址信息...');
    await core.getInitialAddressInfo();
    console.log('✅ 地址信息已初始化');
    console.log(`   邮编: ${core.addressInfo.postCode}`);
    console.log();
    
    console.log('步骤 2: 导航到个人中心...');
    await core.goToHomepage();
    console.log('✅ 已打开个人中心');
    console.log(`   当前 URL: ${mockPage.url()}`);
    console.log();
    
    console.log('步骤 3: 打开地址设置...');
    await core.goToAccountAddress();
    console.log('✅ 已打开地址设置');
    console.log(`   当前 URL: ${mockPage.url()}`);
    console.log();
    
    console.log('步骤 4: 点击添加地址...');
    await core.clickAddAddress();
    console.log('✅ 已进入地址添加页面');
    console.log(`   当前 URL: ${mockPage.url()}`);
    console.log();
    
    console.log('步骤 5: 填写地址表单...');
    await core.fillPhoneNumber('5551234567');
    await core.fillAddressLine1('123 Main Street');
    await core.fillCity('New York');
    await core.selectState('NY');
    await core.fillPostalCode('10001');
    console.log('✅ 地址表单已填写');
    console.log('   表单数据:');
    const formData = mockPage.getFormData();
    for (const [key, value] of Object.entries(formData)) {
      console.log(`   - ${key.substring(0, 30)}...: ${value}`);
    }
    console.log();
    
    console.log('步骤 6: 检查地址建议...');
    await core.handleAddressSuggestions();
    console.log('✅ 已处理地址建议');
    console.log(`   是否使用建议地址: ${core.suggestedAddress}`);
    console.log();
    
    console.log('步骤 7: 提交地址...');
    await core.submitAddress();
    console.log('✅ 地址已提交');
    console.log(`   当前 URL: ${mockPage.url()}`);
    console.log();
    
    console.log('步骤 8: 确认建议地址...');
    await core.confirmSuggestedAddress();
    console.log('✅ 地址确认完成');
    console.log();
    
    console.log('步骤 9: 返回首页...');
    await core.goToNavLogo();
    console.log('✅ 已返回首页');
    console.log(`   当前 URL: ${mockPage.url()}`);
    console.log();
    
    console.log('✅ 测试通过 - 完整流程执行成功');
    console.log();
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error(error.stack);
    console.log();
  }
  
  // 测试用例 2: bindAddress 主方法
  console.log('📋 测试用例 2: bindAddress 主方法测试');
  console.log('-'.repeat(60));
  
  try {
    const mockPage2 = new MockPage('https://www.amazon.com/');
    
    const config2 = {
      page: mockPage2,
      emailLine: 'test@example.com----password123----client_id----refresh_token',
      bindAddress: true,
      phone: '5559876543',
      addressLine1: '456 Oak Avenue',
      city: 'Los Angeles',
      countryCode: 'CA',
      postalCode: '90001'
    };
    
    const core2 = new AmazonRegisterCore(config2);
    
    console.log('执行 bindAddress() 主方法...');
    await core2.bindAddress();
    
    console.log('✅ bindAddress() 执行成功');
    console.log(`   最终 URL: ${mockPage2.url()}`);
    console.log();
    
    // 显示操作日志
    console.log('操作日志:');
    const logs = mockPage2.getLogs();
    logs.slice(-15).forEach((log, index) => {
      console.log(`   ${index + 1}. ${log}`);
    });
    console.log();
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error(error.stack);
    console.log();
  }
  
  // 测试用例 3: 验证配置项
  console.log('📋 测试用例 3: 验证地址绑定配置项');
  console.log('-'.repeat(60));
  console.log('支持的配置项：');
  console.log('  - bindAddress: boolean - 是否启用地址绑定');
  console.log('  - phone: string - 手机号码');
  console.log('  - addressLine1: string - 地址行1');
  console.log('  - city: string - 城市');
  console.log('  - countryCode: string - 州代码（如 NY, CA）');
  console.log('  - postalCode: string - 邮政编码');
  console.log('  - addressData: object - 完整地址数据对象');
  console.log();
  console.log('使用示例：');
  console.log(`
const config = {
  bindAddress: true,
  addressData: {
    randomPhone: '5551234567',
    addressLine1: '123 Main St',
    city: 'New York',
    countryCode: 'NY',
    postalCode: '10001'
  }
};
  `);
  console.log();
  
  console.log('='.repeat(60));
  console.log('✅ 所有测试完成！');
  console.log('='.repeat(60));
}

// 运行测试
testAddressBinding().catch(console.error);
