/**
 * 单元测试 - AddressOperations
 * 测试地址绑定功能
 */

const { chromium } = require('playwright');

async function testAddressOperations() {
  console.log('========== 测试 AddressOperations ==========\n');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const logs = [];
  const tasklog = (data) => {
    logs.push(data);
    console.log(`[LOG] ${data.message}`);
  };
  
  const AddressOperations = require('../src/utils/operations/AddressOperations');
  const address = new AddressOperations(page, {}, tasklog);
  
  try {
    // 测试1: 生成随机地址
    console.log('[测试1] 生成随机地址数据...');
    const addressData = await address.generateAddressData('10001');
    console.log('生成的地址信息:');
    console.log(`  电话: ${addressData.phoneNumber}`);
    console.log(`  地址: ${addressData.addressLine1}`);
    console.log(`  城市: ${addressData.city}`);
    console.log(`  州代码: ${addressData.stateCode}`);
    console.log(`  邮编: ${addressData.postalCode}`);
    console.log('✅ 地址生成成功\n');
    
    // 测试2: 导航到地址管理页面
    console.log('[测试2] 需要手动登录Amazon并导航到地址管理页面...');
    console.log('等待30秒，请完成登录并进入地址管理...');
    await page.goto('https://www.amazon.com');
    await page.waitForTimeout(30000);
    
    // 测试3: 检查地址表单元素
    console.log('[测试3] 检查地址表单元素...');
    const elements = {
      phone: await page.locator('#address-ui-widgets-enterAddressPhoneNumber').count() > 0,
      address1: await page.locator('#address-ui-widgets-enterAddressLine1').count() > 0,
      city: await page.locator('#address-ui-widgets-enterAddressCity').count() > 0,
      state: await page.locator('#address-ui-widgets-enterAddressStateOrRegion').count() > 0,
      zip: await page.locator('#address-ui-widgets-enterAddressPostalCode').count() > 0,
      submit: await page.locator('#address-ui-widgets-form-submit-button').count() > 0
    };
    
    console.log('地址表单元素:');
    console.log(`  电话输入框: ${elements.phone ? '✅' : '❌'}`);
    console.log(`  地址输入框: ${elements.address1 ? '✅' : '❌'}`);
    console.log(`  城市输入框: ${elements.city ? '✅' : '❌'}`);
    console.log(`  州下拉框: ${elements.state ? '✅' : '❌'}`);
    console.log(`  邮编输入框: ${elements.zip ? '✅' : '❌'}`);
    console.log(`  提交按钮: ${elements.submit ? '✅' : '❌'}`);
    console.log();
    
    // 测试4: 填写地址（如果在正确页面）
    if (elements.phone && elements.address1) {
      console.log('[测试4] 填写地址信息（不提交）...');
      
      await address.fillPhoneNumber(addressData.phoneNumber);
      console.log('✅ 电话填写成功');
      
      await address.fillAddressLine1(addressData.addressLine1);
      console.log('✅ 地址填写成功');
      
      await address.fillCity(addressData.city);
      console.log('✅ 城市填写成功');
      
      await address.selectState(addressData.stateCode);
      console.log('✅ 州选择成功');
      
      await address.fillPostalCode(addressData.postalCode);
      console.log('✅ 邮编填写成功\n');
      
      console.log('[提示] 地址已填写完成，可以手动检查');
      console.log('[提示] 按Ctrl+C退出测试\n');
      
      await page.waitForTimeout(15000);
    } else {
      console.log('❌ 未在地址表单页面，跳过填写测试\n');
    }
    
    console.log('========== AddressOperations 测试完成 ==========\n');
    console.log(`总共产生日志: ${logs.length} 条`);
    
  } catch (error) {
    console.error(`❌ 测试失败: ${error.message}`);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

// 运行测试
if (require.main === module) {
  testAddressOperations();
}

module.exports = { testAddressOperations };
