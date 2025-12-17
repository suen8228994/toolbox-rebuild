/**
 * 单元测试运行器
 * 统一运行所有单元测试
 */

const { testNavigationOperations } = require('./operations/test-navigation');
const { testFormOperations } = require('./operations/test-form');
const { testCaptchaOperations } = require('./operations/test-captcha');
const { testTwoFactorAuthOperations } = require('./operations/test-twofactor');
const { testAddressOperations } = require('./operations/test-address');

async function runAllTests() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     Amazon Registration - 单元测试套件               ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('\n');
  
  const tests = [
    { name: 'NavigationOperations', fn: testNavigationOperations },
    { name: 'FormOperations', fn: testFormOperations },
    { name: 'CaptchaOperations', fn: testCaptchaOperations },
    { name: 'TwoFactorAuthOperations', fn: testTwoFactorAuthOperations },
    { name: 'AddressOperations', fn: testAddressOperations }
  ];
  
  const results = [];
  
  for (const test of tests) {
    console.log(`\n[${new Date().toLocaleTimeString()}] 开始测试: ${test.name}`);
    console.log('─'.repeat(60));
    
    try {
      await test.fn();
      results.push({ name: test.name, status: 'PASS' });
      console.log(`✅ ${test.name} - 通过`);
    } catch (error) {
      results.push({ name: test.name, status: 'FAIL', error: error.message });
      console.error(`❌ ${test.name} - 失败: ${error.message}`);
    }
    
    console.log('─'.repeat(60));
  }
  
  // 输出测试摘要
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║                   测试摘要                            ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('\n');
  
  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  
  results.forEach(result => {
    const icon = result.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} ${result.name}: ${result.status}`);
    if (result.error) {
      console.log(`   错误: ${result.error}`);
    }
  });
  
  console.log('\n');
  console.log(`总计: ${results.length} 个测试`);
  console.log(`通过: ${passCount} 个`);
  console.log(`失败: ${failCount} 个`);
  console.log(`成功率: ${((passCount / results.length) * 100).toFixed(1)}%`);
  console.log('\n');
}

async function runSingleTest(testName) {
  const testMap = {
    'navigation': testNavigationOperations,
    'form': testFormOperations,
    'captcha': testCaptchaOperations,
    'twofactor': testTwoFactorAuthOperations,
    'address': testAddressOperations
  };
  
  const testFn = testMap[testName.toLowerCase()];
  
  if (!testFn) {
    console.error(`❌ 未找到测试: ${testName}`);
    console.log('可用的测试:');
    Object.keys(testMap).forEach(name => console.log(`  - ${name}`));
    return;
  }
  
  console.log(`\n运行单个测试: ${testName}\n`);
  await testFn();
}

// 命令行运行
if (require.main === module) {
  const testName = process.argv[2];
  
  if (testName) {
    runSingleTest(testName);
  } else {
    console.log('\n使用方法:');
    console.log('  node tests/test-runner.js              # 运行所有测试');
    console.log('  node tests/test-runner.js navigation   # 运行导航测试');
    console.log('  node tests/test-runner.js form         # 运行表单测试');
    console.log('  node tests/test-runner.js captcha      # 运行验证码测试');
    console.log('  node tests/test-runner.js twofactor    # 运行2FA测试');
    console.log('  node tests/test-runner.js address      # 运行地址测试');
    console.log('\n');
    
    // 询问用户
    console.log('按Enter键运行所有测试，或输入测试名称运行单个测试...');
  }
}

module.exports = { runAllTests, runSingleTest };
