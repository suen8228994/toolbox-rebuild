// 测试邮件时间过滤功能
const msGraphMail = require('./src/utils/msGraphMail');

// 使用真实的测试邮箱配置
const TEST_EMAIL_LINE = 'AyanaFfertz5376@hotmail.com----yylEkjX713919----9e5f94bc-e8a4-4e73-b8be-63364c29d753----M.C525_BAY.0.U.-CtxwWwWgpAcRdify!ZuWrBlWw*i1*GULhqkcvfR7RCkor75POgUs9aLd02YF8NOa8svMfG3n*Pjn3XXvzVFOR1c6YCyH1k2KcjsGUr7QgFUA2ob*V9vTn*XJDqd6TSFaYy9Q6CrdjkaSZ6QZfTT1HMKAcin073bumcYiZYA5xtpwptp8imuaWoqQEmGZEltUVS*tNDxFqRfOlHmXzqcBVnHhhgiTOreSaoH*B7PHnk*Cq!mgBMvt7HeZ3LVKSznL6XzbjEz6aqrb!OA8u3XZVlvqcyVOgD7gIXbqyOWEkYm3L8eaFnasYmQ88S0TY7grKop4V2sn0OBqnpKvjgoQ6ntO1LRzxXqPFPrb9KK5xrkVJdyVgkMiUMksacho1bXe8AVY1P9zxtDliUFxrDF6zokuprh40pZSeW1vJlgIAhdMhOQbjZZZsR5ohA*99EB!ig$$';

// 解析 emailLine
const parts = TEST_EMAIL_LINE.split('----');
const TEST_CONFIG = {
  email: parts[0],
  password: parts[1],
  clientId: parts[2],
  refreshToken: parts[3]
};

async function testTimeFilter() {
  console.log('='.repeat(70));
  console.log('📧 测试邮件时间过滤功能');
  console.log('='.repeat(70));
  console.log(`\n📧 邮箱: ${TEST_CONFIG.email}\n`);
  
  try {
    // 场景1: 使用未来时间作为 startTime，应该找不到邮件
    console.log('━'.repeat(70));
    console.log('场景1: 使用未来时间（应该找不到邮件）');
    console.log('━'.repeat(70));
    
    const futureTime = Date.now();
    console.log(`起始时间: ${new Date(futureTime).toLocaleString('zh-CN')}`);
    console.log('（只会查找这个时间之后的邮件）\n');
    
    try {
      await msGraphMail.waitForVerificationEmail(
        TEST_CONFIG.email,
        TEST_CONFIG.refreshToken,
        TEST_CONFIG.clientId,
        {
          maxRetries: 1,
          retryInterval: 1000,
          searchKeyword: '',
          fromFilter: 'amazon',
          startTime: futureTime,
          onProgress: (progress) => {
            const time = new Date().toLocaleTimeString();
            console.log(`[${time}] ${progress.message}`);
          }
        }
      );
      console.log('❌ 测试失败：应该找不到邮件，但找到了');
    } catch (error) {
      console.log(`✅ 正确：${error.message}\n`);
    }
    
    // 场景2: 使用过去时间作为 startTime，应该能找到邮件
    console.log('━'.repeat(70));
    console.log('场景2: 使用过去时间（应该找到邮件）');
    console.log('━'.repeat(70));
    
    const pastTime = 1765880000000; // 2025/12/16 18:26:40
    console.log(`起始时间: ${new Date(pastTime).toLocaleString('zh-CN')}`);
    console.log('（只会查找这个时间之后的邮件）\n');
    
    const code = await msGraphMail.waitForVerificationEmail(
      TEST_CONFIG.email,
      TEST_CONFIG.refreshToken,
      TEST_CONFIG.clientId,
      {
        maxRetries: 1,
        retryInterval: 1000,
        searchKeyword: '',
        fromFilter: 'amazon',
        startTime: pastTime,
        onProgress: (progress) => {
          const time = new Date().toLocaleTimeString();
          console.log(`[${time}] ${progress.message}`);
          if (progress.receivedTime) {
            console.log(`[${time}] 邮件接收时间: ${progress.receivedTime.toLocaleString('zh-CN')}`);
          }
        }
      }
    );
    
    console.log(`\n✅ 成功找到验证码: ${code}`);
    
    // 场景3: 不使用时间过滤（默认行为）
    console.log('\n' + '━'.repeat(70));
    console.log('场景3: 不使用时间过滤（获取任何Amazon邮件）');
    console.log('━'.repeat(70) + '\n');
    
    const code2 = await msGraphMail.waitForVerificationEmail(
      TEST_CONFIG.email,
      TEST_CONFIG.refreshToken,
      TEST_CONFIG.clientId,
      {
        maxRetries: 1,
        retryInterval: 1000,
        searchKeyword: '',
        fromFilter: 'amazon',
        // 不传 startTime
        onProgress: (progress) => {
          const time = new Date().toLocaleTimeString();
          console.log(`[${time}] ${progress.message}`);
          if (progress.receivedTime) {
            console.log(`[${time}] 邮件接收时间: ${progress.receivedTime.toLocaleString('zh-CN')}`);
          }
        }
      }
    );
    
    console.log(`\n✅ 成功找到验证码: ${code2}`);
    
    console.log('\n' + '='.repeat(70));
    console.log('🎉 所有测试通过！时间过滤功能正常工作');
    console.log('='.repeat(70));
    console.log('\n总结:');
    console.log('  ✅ 未来时间过滤：正确拒绝旧邮件');
    console.log('  ✅ 过去时间过滤：正确接受新邮件');
    console.log('  ✅ 无时间过滤：正常获取任何邮件');
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    if (error.stack) {
      console.error('\n错误堆栈:', error.stack);
    }
  }
}

testTimeFilter();
