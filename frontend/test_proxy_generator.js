/**
 * 代理生成器测试脚本
 * 
 * 运行方式: node test_proxy_generator.js
 */

const proxyGenerator = require('./src/utils/proxyGenerator.js');

console.log('🧪 开始测试代理生成器...\n');

// 测试1: 生成单个代理
console.log('📌 测试1: 生成单个美国代理');
const singleProxy = proxyGenerator.generateSingleProxy('US', 'anIpTP3cZa', '81388147');
console.log('结果:', singleProxy);
console.log('');

// 测试2: 批量生成代理
console.log('📌 测试2: 批量生成5个代理');
const multipleProxies = proxyGenerator.generateProxies({
    country: 'US',
    quantity: 5,
    prefix: 'anIpTP3cZa',
    password: '81388147'
});
console.log('结果:');
multipleProxies.forEach((proxy, index) => {
    console.log(`  ${index + 1}. ${proxy}`);
});
console.log('');

// 测试3: 解析代理字符串
console.log('📌 测试3: 解析代理字符串');
const parsed = proxyGenerator.parseProxy(singleProxy);
console.log('解析结果:', parsed);
console.log('');

// 测试4: 验证代理格式
console.log('📌 测试4: 验证代理格式');
console.log('有效代理:', proxyGenerator.validateProxy('192.168.1.1:8080:user:pass'));
console.log('无效代理:', proxyGenerator.validateProxy('invalid'));
console.log('');

// 测试5: 获取支持的国家列表
console.log('📌 测试5: 支持的国家列表');
const countries = proxyGenerator.getSupportedCountries();
console.log('国家数量:', countries.length);
countries.forEach(country => {
    console.log(`  ${country.flag} ${country.name} (${country.code})`);
});
console.log('');

// 测试6: 测试不同国家
console.log('📌 测试6: 生成不同国家的代理');
const countryCodes = ['US', 'UK', 'CA', 'JP', 'CN'];
countryCodes.forEach(code => {
    const proxy = proxyGenerator.generateSingleProxy(code, 'anIpTP3cZa', '81388147');
    console.log(`  ${code}: ${proxy}`);
});
console.log('');

// 测试7: 格式化输出
console.log('📌 测试7: 格式化输出');
const formatted = proxyGenerator.formatProxies(multipleProxies);
console.log('格式化结果:');
console.log(formatted);

console.log('\n✅ 所有测试完成！');
