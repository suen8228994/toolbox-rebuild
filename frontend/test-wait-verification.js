// 测试等待验证码邮件功能
const msGraphMail = require('./src/utils/msGraphMail');

const TEST_EMAIL = 'test012ss@outlook.com';
const REFRESH_TOKEN = 'M.C531_BAY.0.U.-CkpWtT8XillsQ1wUH*F1okrIHOsE*gMZ6e1Fs9ec68MNJ8TbWn7VauvBrHyrAnrIHV3j9fiObHbiJBj2cqy*9ovynIqI9VMav9u9jMjAGjFm30jURT8IlRdPRc3zi68U*ZtMBeJhw6wybbPCxpouVQLmLKtA*tTAZa3xPOBmX4Ir9b2pvKREa!Neesl4Edkw6smymBvr*MlxupeINV0ODKxiUHW*Y2EAPtk!PodCMqD76BH0gAgB22S2AJSLr0ouzBccePQM1O5r!Raw1WakMK6NNAD5Df3vHjXCVOvu1yYpROdGCWJDSSoEJXSqM*Y6RJFiYdfHrR*8SaNngJLsTKNGuCEQ7UstasqJ2cp45Rj*qT2xGe5v674HPTRB2w56vg$$';
const CLIENT_ID = '1d08522d-70bb-4128-8684-449f9a2efaf5';

async function testWaitForCode() {
  console.log('='.repeat(60));
  console.log('⏳ 测试等待验证码邮件功能');
  console.log('='.repeat(60));
  console.log(`\n📧 邮箱: ${TEST_EMAIL}`);
  console.log('━'.repeat(60));
  console.log('\n请在30秒内向该邮箱发送一封包含验证码的邮件');
  console.log('（可以手动发送，或者触发其他注册流程）\n');
  console.log('━'.repeat(60));
  
  try {
    const code = await msGraphMail.waitForVerificationEmail(
      TEST_EMAIL,
      REFRESH_TOKEN,
      CLIENT_ID,
      {
        maxRetries: 6,        // 尝试6次
        retryInterval: 5000,  // 每5秒一次
        searchKeyword: '',    // 搜索所有邮件
        onProgress: (progress) => {
          const time = new Date().toLocaleTimeString();
          const typeSymbol = {
            'info': 'ℹ️ ',
            'success': '✅',
            'warning': '⚠️ ',
            'error': '❌'
          };
          console.log(`[${time}] ${typeSymbol[progress.type] || ''} ${progress.message}`);
        }
      }
    );
    
    console.log('\n' + '━'.repeat(60));
    console.log(`✅ 成功获取验证码: ${code}`);
    console.log('━'.repeat(60));
    
  } catch (error) {
    console.error('\n' + '━'.repeat(60));
    console.error('❌ 获取验证码失败:', error.message);
    console.error('━'.repeat(60));
  }
}

testWaitForCode();
