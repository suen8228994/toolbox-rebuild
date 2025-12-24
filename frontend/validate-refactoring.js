/**
 * 快速验证脚本 - 验证重构后代码的基本功能
 */

async function quickValidation() {
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║      重构代码 - 快速验证                        ║');
  console.log('╚═══════════════════════════════════════════════════╝\n');
  
  const results = [];
  
  // 测试1: 检查所有操作类是否可以正常加载
  console.log('[1] 检查操作类加载...');
  try {
    require('./src/utils/operations/BaseOperations');
    console.log('  ✅ BaseOperations');
    
    require('./src/utils/operations/NavigationOperations');
    console.log('  ✅ NavigationOperations');
    
    require('./src/utils/operations/FormOperations');
    console.log('  ✅ FormOperations');
    
    require('./src/utils/operations/CaptchaOperations');
    console.log('  ✅ CaptchaOperations');
    
    require('./src/utils/operations/TwoFactorAuthOperations');
    console.log('  ✅ TwoFactorAuthOperations');
    
    require('./src/utils/operations/EmailVerificationOperations');
    console.log('  ✅ EmailVerificationOperations');
    
    require('./src/utils/operations/AddressOperations');
    console.log('  ✅ AddressOperations');
    
    require('./src/utils/operations/LoginStatusOperations');
    console.log('  ✅ LoginStatusOperations');
    
    require('./src/utils/operations/OperationsManager');
    console.log('  ✅ OperationsManager');
    
    results.push({ test: '操作类加载', status: 'PASS' });
    console.log('\n✅ 所有操作类加载成功\n');
  } catch (error) {
    results.push({ test: '操作类加载', status: 'FAIL', error: error.message });
    console.error(`\n❌ 加载失败: ${error.message}\n`);
    return results;
  }
  
  // 测试2: 检查主类是否可以正常加载
  console.log('[2] 检查主类加载...');
  try {
    const AmazonRegisterCore = require('./src/utils/amazonRegisterCore');
    console.log('  ✅ AmazonRegisterCore');
    results.push({ test: '主类加载', status: 'PASS' });
    console.log('\n✅ 主类加载成功\n');
  } catch (error) {
    results.push({ test: '主类加载', status: 'FAIL', error: error.message });
    console.error(`\n❌ 主类加载失败: ${error.message}\n`);
    return results;
  }
  
  // 测试3: 检查操作管理器实例化
  console.log('[3] 检查操作管理器实例化...');
  try {
    const OperationsManager = require('./src/utils/operations/OperationsManager');
    
    const mockPage = { url: () => 'https://www.amazon.com' };
    const mockConfig = {};
    const mockTasklog = () => {};
    const mockAccountInfo = {};
    
    const opsManager = new OperationsManager(mockPage, mockConfig, mockTasklog, mockAccountInfo);
    
    // 检查所有操作类实例是否存在
    if (!opsManager.navigation) throw new Error('navigation 实例不存在');
    if (!opsManager.form) throw new Error('form 实例不存在');
    if (!opsManager.captcha) throw new Error('captcha 实例不存在');
    if (!opsManager.twoFactorAuth) throw new Error('twoFactorAuth 实例不存在');
    if (!opsManager.emailVerification) throw new Error('emailVerification 实例不存在');
    if (!opsManager.address) throw new Error('address 实例不存在');
    if (!opsManager.loginStatus) throw new Error('loginStatus 实例不存在');
    
    // 检查快捷访问接口
    if (!opsManager.ops.nav) throw new Error('ops.nav 不存在');
    if (!opsManager.ops.form) throw new Error('ops.form 不存在');
    if (!opsManager.ops.captcha) throw new Error('ops.captcha 不存在');
    if (!opsManager.ops.twoFA) throw new Error('ops.twoFA 不存在');
    if (!opsManager.ops.email) throw new Error('ops.email 不存在');
    if (!opsManager.ops.address) throw new Error('ops.address 不存在');
    if (!opsManager.ops.login) throw new Error('ops.login 不存在');
    
    console.log('  ✅ navigation 实例');
    console.log('  ✅ form 实例');
    console.log('  ✅ captcha 实例');
    console.log('  ✅ twoFactorAuth 实例');
    console.log('  ✅ emailVerification 实例');
    console.log('  ✅ address 实例');
    console.log('  ✅ loginStatus 实例');
    console.log('  ✅ ops 快捷访问接口');
    
    results.push({ test: '操作管理器实例化', status: 'PASS' });
    console.log('\n✅ 操作管理器实例化成功\n');
  } catch (error) {
    results.push({ test: '操作管理器实例化', status: 'FAIL', error: error.message });
    console.error(`\n❌ 实例化失败: ${error.message}\n`);
    return results;
  }
  
  // 测试4: 检查主类实例化
  console.log('[4] 检查主类实例化...');
  try {
    const AmazonRegisterCore = require('./src/utils/amazonRegisterCore');
    
    const mockPage = { url: () => 'https://www.amazon.com' };
    const mockConfig = {
      page: mockPage,
      email: 'test@example.com',
      password: 'TestPass123',
      emailLine: 'test@example.com----TestPass123----mock_client_id----mock_refresh_token'
    };
    
    const core = new AmazonRegisterCore(mockConfig);
    
    if (!core.page) throw new Error('page 不存在');
    if (!core.config) throw new Error('config 不存在');
    if (!core.accountInfo) throw new Error('accountInfo 不存在');
    if (!core.ops) throw new Error('ops 不存在');
    
    console.log('  ✅ page 属性');
    console.log('  ✅ config 属性');
    console.log('  ✅ accountInfo 属性');
    console.log('  ✅ ops 属性');
    
    results.push({ test: '主类实例化', status: 'PASS' });
    console.log('\n✅ 主类实例化成功\n');
  } catch (error) {
    results.push({ test: '主类实例化', status: 'FAIL', error: error.message });
    console.error(`\n❌ 主类实例化失败: ${error.message}\n`);
    return results;
  }
  
  // 测试5: 检查测试文件是否存在
  console.log('[5] 检查测试文件...');
  const fs = require('fs');
  const testFiles = [
    './tests/operations/test-navigation.js',
    './tests/operations/test-form.js',
    './tests/operations/test-captcha.js',
    './tests/operations/test-twofactor.js',
    './tests/operations/test-address.js',
    './tests/test-runner.js'
  ];
  
  let allTestsExist = true;
  for (const file of testFiles) {
    if (fs.existsSync(file)) {
      console.log(`  ✅ ${file}`);
    } else {
      console.log(`  ❌ ${file} 不存在`);
      allTestsExist = false;
    }
  }
  
  if (allTestsExist) {
    results.push({ test: '测试文件存在性', status: 'PASS' });
    console.log('\n✅ 所有测试文件存在\n');
  } else {
    results.push({ test: '测试文件存在性', status: 'FAIL' });
    console.log('\n❌ 部分测试文件不存在\n');
  }
  
  // 输出总结
  console.log('\n╔═══════════════════════════════════════════════════╗');
  console.log('║                验证结果总结                      ║');
  console.log('╚═══════════════════════════════════════════════════╝\n');
  
  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  
  results.forEach(result => {
    const icon = result.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} ${result.test}: ${result.status}`);
    if (result.error) {
      console.log(`   错误: ${result.error}`);
    }
  });
  
  console.log('\n─────────────────────────────────────────────────');
  console.log(`总计: ${results.length} 项检查`);
  console.log(`通过: ${passCount} 项`);
  console.log(`失败: ${failCount} 项`);
  console.log(`成功率: ${((passCount / results.length) * 100).toFixed(1)}%`);
  console.log('─────────────────────────────────────────────────\n');
  
  if (failCount === 0) {
    console.log('🎉 所有验证通过！重构代码可以正常使用\n');
    console.log('下一步：运行单元测试');
    console.log('  node tests/test-runner.js navigation');
    console.log('  node tests/test-runner.js form');
    console.log('  node tests/test-runner.js captcha');
    console.log('  等等...\n');
  } else {
    console.log('⚠️  部分验证失败，请检查上述错误\n');
  }
  
  return results;
}

// 运行验证
if (require.main === module) {
  quickValidation().catch(error => {
    console.error('验证过程出错:', error);
    process.exit(1);
  });
}

module.exports = { quickValidation };
