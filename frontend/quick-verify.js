#!/usr/bin/env node
/**
 * 快速验证脚本 - 确保主要模块能加载
 */

const path = require('path');

console.log('====== 项目清理和重构验证 ======\n');

const testCases = [
  {
    name: 'AddressServiceWrapper',
    test: () => require('./src/utils/addressServiceWrapper')
  },
  {
    name: 'AmazonRegisterCore',
    test: () => require('./src/utils/amazonRegisterCore')
  },
  {
    name: 'AddressService',
    test: () => require('./src/refactored-backend/services/address/AddressService')
  }
];

let passCount = 0;
let failCount = 0;

for (const testCase of testCases) {
  try {
    testCase.test();
    console.log(`✅ ${testCase.name} - 加载成功`);
    passCount++;
  } catch (error) {
    console.log(`❌ ${testCase.name} - 加载失败: ${error.message}`);
    failCount++;
  }
}

console.log(`\n总计: ${testCases.length} 项测试`);
console.log(`通过: ${passCount} 项`);
console.log(`失败: ${failCount} 项`);

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('\n✅ 所有验证通过！项目可以正常使用\n');
}
