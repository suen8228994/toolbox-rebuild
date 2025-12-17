/**
 * IP 验证功能测试
 * 测试 IP2Location 验证和代理生成器更新
 */

const ipValidator = require('./src/utils/ipValidator');
const proxyGenerator = require('./src/utils/proxyGenerator');

console.log('='.repeat(60));
console.log('测试 1: IP 验证功能');
console.log('='.repeat(60));

// 测试 1: 验证公共 IP
async function testIPValidation() {
  console.log('\n📋 测试 IP 地址验证:');
  
  // 测试 Google DNS
  const result1 = await ipValidator.validateIP('8.8.8.8');
  console.log('Google DNS (8.8.8.8):', result1);
  
  // 测试 Cloudflare DNS
  const result2 = await ipValidator.validateIP('1.1.1.1');
  console.log('Cloudflare DNS (1.1.1.1):', result2);
  
  // 测试无效 IP
  const result3 = await ipValidator.validateIP('999.999.999.999');
  console.log('无效 IP (999.999.999.999):', result3);
}

// 测试 2: 从代理字符串提取 IP
console.log('\n📋 测试从代理字符串提取 IP:');

const proxyFormats = [
  'na.1c23e0905fcf5ae5.ipmars.vip:4900:rZwC7qlCe8-zone-mars:52572596',
  'socks5://user:pass@192.168.1.1:1080',
  'http://proxy.example.com:8080',
  '8.8.8.8:8080:username:password'
];

proxyFormats.forEach(proxy => {
  const ip = ipValidator.extractIPFromProxy(proxy);
  console.log(`代理: ${proxy}`);
  console.log(`  提取的 IP/域名: ${ip}`);
});

console.log('\n' + '='.repeat(60));
console.log('测试 2: 代理生成器（更新后的配置）');
console.log('='.repeat(60));

// 测试 3: 生成单个代理（使用新的前缀和密码）
console.log('\n📋 测试生成单个代理（新配置）:');
const singleProxy = proxyGenerator.generateSingleProxy('US');
console.log('生成的代理:', singleProxy);

// 验证是否使用了新的前缀和密码
if (singleProxy.includes('rZwC7qlCe8') && singleProxy.includes('52572596')) {
  console.log('✅ 验证通过: 使用了新的前缀和密码');
} else {
  console.log('❌ 验证失败: 未使用新的前缀和密码');
}

// 测试 4: 批量生成代理
console.log('\n📋 测试批量生成代理（3个）:');
const multipleProxies = proxyGenerator.generateProxies({
  country: 'US',
  quantity: 3,
  prefix: 'rZwC7qlCe8',
  password: '52572596'
});

multipleProxies.forEach((proxy, index) => {
  console.log(`  ${index + 1}. ${proxy}`);
});

// 测试 5: 验证代理格式
console.log('\n📋 测试代理格式验证:');
console.log('有效代理:', proxyGenerator.validateProxy(singleProxy));
console.log('无效代理:', proxyGenerator.validateProxy('invalid-proxy'));

console.log('\n' + '='.repeat(60));
console.log('测试 3: IP 验证集成测试');
console.log('='.repeat(60));

// 测试 6: 完整流程（生成代理 → 提取 IP → 验证）
async function testFullWorkflow() {
  console.log('\n📋 完整流程测试:');
  console.log('1. 生成代理...');
  const proxy = proxyGenerator.generateSingleProxy('US');
  console.log(`   生成的代理: ${proxy}`);
  
  console.log('\n2. 提取 IP 地址...');
  const ip = ipValidator.extractIPFromProxy(proxy);
  console.log(`   提取的 IP/域名: ${ip}`);
  
  if (ip) {
    console.log('\n3. 验证 IP 有效性...');
    const validation = await ipValidator.validateIP(ip);
    
    if (validation.valid) {
      console.log('   ✅ IP 验证通过');
      console.log(`   位置: ${validation.city}, ${validation.region}, ${validation.country}`);
      console.log(`   ISP: ${validation.isp}`);
    } else {
      console.log('   ❌ IP 验证失败:', validation.error);
    }
  } else {
    console.log('   ⚠️ 无法提取 IP，可能是域名代理');
  }
}

// 运行所有测试
(async () => {
  await testIPValidation();
  await testFullWorkflow();
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ 所有测试完成！');
  console.log('='.repeat(60));
})();
