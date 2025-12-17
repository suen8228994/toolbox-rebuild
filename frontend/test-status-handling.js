/**
 * 测试脚本：注册状态处理逻辑测试
 * 
 * 这个脚本模拟不同的注册状态（201, 301, 401）并验证对应的处理逻辑
 * 
 * 状态说明：
 * - 201: 直接打开 2FA 设置页面（打开而不验证）
 * - 301: 需要手动导航到 2FA 设置页面
 * - 401: 需要手机验证（重试）
 */

const AmazonRegisterCore = require('./src/utils/amazonRegisterCore');

// 模拟 Page 对象
class MockPage {
  constructor(initialUrl) {
    this._url = initialUrl;
    this._logs = [];
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
    return 'en-US'; // 模拟浏览器语言
  }
  
  locator(selector) {
    return new MockLocator(selector, this);
  }
  
  async waitForURL(predicate, options) {
    this._logs.push('waitForURL called');
  }
  
  getLogs() {
    return this._logs;
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
  }
  
  async fill(value) {
    this.page._logs.push(`fill: ${this.selector} = ${value}`);
  }
  
  async press(key, options) {
    this.page._logs.push(`press: ${key}`);
  }
  
  async innerText() {
    return 'Mock Text';
  }
  
  async getAttribute(attr) {
    return 'false';
  }
  
  async selectOption(value) {
    this.page._logs.push(`selectOption: ${this.selector} = ${value}`);
  }
  
  async waitFor(options) {
    throw new Error('Element not found');
  }
}

// 测试用例
async function testStatusHandling() {
  console.log('='.repeat(60));
  console.log('测试 Amazon 注册状态处理逻辑');
  console.log('='.repeat(60));
  console.log();
  
  // 测试用例 1: 状态 201（直接 2FA）
  console.log('📋 测试用例 1: 状态 201 - 直接打开 2FA 页面');
  console.log('-'.repeat(60));
  try {
    const mockPage201 = new MockPage('https://www.amazon.com/a/settings/approval/setup/register?ie=UTF8');
    const config201 = {
      page: mockPage201,
      emailLine: 'test@example.com----password123----client_id----refresh_token',
      enable2FA: false, // 禁用 2FA 以便快速测试
      bindAddress: false
    };
    
    const core201 = new AmazonRegisterCore(config201);
    const status201 = await core201.checkRegistrationStatus();
    
    console.log(`✅ 检测到状态: ${status201}`);
    console.log(`✅ 预期状态: 201`);
    console.log(`✅ 测试${status201 === 201 ? '通过' : '失败'}`);
    console.log();
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.log();
  }
  
  // 测试用例 2: 状态 301（手动导航）
  console.log('📋 测试用例 2: 状态 301 - 需要手动导航到 2FA');
  console.log('-'.repeat(60));
  try {
    const mockPage301 = new MockPage('https://www.amazon.com/a/settings/otpdevices/add?ie=UTF8');
    const config301 = {
      page: mockPage301,
      emailLine: 'test@example.com----password123----client_id----refresh_token',
      enable2FA: false,
      bindAddress: false
    };
    
    const core301 = new AmazonRegisterCore(config301);
    const status301 = await core301.checkRegistrationStatus();
    
    console.log(`✅ 检测到状态: ${status301}`);
    console.log(`✅ 预期状态: 301`);
    console.log(`✅ 测试${status301 === 301 ? '通过' : '失败'}`);
    console.log();
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.log();
  }
  
  // 测试用例 3: 状态 401（需要手机验证）
  console.log('📋 测试用例 3: 状态 401 - 需要手机验证');
  console.log('-'.repeat(60));
  try {
    const mockPage401 = new MockPage('https://www.amazon.com/ap/cvf/verify?ie=UTF8');
    const config401 = {
      page: mockPage401,
      emailLine: 'test@example.com----password123----client_id----refresh_token',
      enable2FA: false,
      bindAddress: false
    };
    
    const core401 = new AmazonRegisterCore(config401);
    const status401 = await core401.checkRegistrationStatus();
    
    console.log(`✅ 检测到状态: ${status401}`);
    console.log(`✅ 预期状态: 401`);
    console.log(`✅ 测试${status401 === 401 ? '通过' : '失败'}`);
    console.log();
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.log();
  }
  
  // 测试用例 4: 验证状态码含义
  console.log('📋 测试用例 4: 验证状态码含义');
  console.log('-'.repeat(60));
  console.log('状态码说明：');
  console.log('  201: 直接打开 2FA 设置页面（打开而不验证）');
  console.log('       - URL 包含: /a/settings/approval/setup/register?');
  console.log('       - 处理: 直接调用 handle2FASetup()');
  console.log();
  console.log('  301: 需要手动导航到 2FA 页面');
  console.log('       - URL 包含: /a/settings/otpdevices/add?');
  console.log('       - 处理: 调用 handle2FAManualSetup()');
  console.log();
  console.log('  401: 需要手机验证（注册可能失败）');
  console.log('       - URL 包含: ap/cvf/verify');
  console.log('       - 处理: 调用 retryRegistration() 然后重新检查状态');
  console.log();
  
  console.log('='.repeat(60));
  console.log('✅ 所有测试完成！');
  console.log('='.repeat(60));
}

// 运行测试
testStatusHandling().catch(console.error);
