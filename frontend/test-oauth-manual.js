// 手动测试OAuth Device Code Flow
const msGraphDeviceCode = require('./src/utils/msGraphDeviceCode');

const clientId = '1d08522d-70bb-4128-8684-449f9a2efaf5';

async function testManualOAuth() {
  console.log('='.repeat(60));
  console.log('🔐 Microsoft OAuth Device Code 手动测试');
  console.log('='.repeat(60));
  console.log();
  
  try {
    // 步骤1: 获取Device Code
    console.log('📌 步骤1: 正在获取验证码...');
    const deviceCodeData = await msGraphDeviceCode.startDeviceCodeFlow({
      clientId: clientId,
      scope: 'https://outlook.office.com/.default offline_access'
    });
    
    console.log('✅ 验证码获取成功！');
    console.log();
    console.log('━'.repeat(60));
    console.log('📋 请按以下步骤操作:');
    console.log('━'.repeat(60));
    console.log();
    console.log(`1️⃣  打开浏览器访问: ${deviceCodeData.verification_uri}`);
    console.log();
    console.log(`2️⃣  输入验证码: ${deviceCodeData.user_code}`);
    console.log();
    console.log('3️⃣  登录账号: test012ss@outlook.com');
    console.log('    密码: (你的密码)');
    console.log();
    console.log('4️⃣  在"保持登录"页面选择: 否');
    console.log();
    console.log('5️⃣  确认授权');
    console.log();
    console.log('━'.repeat(60));
    console.log();
    console.log(`⏱️  验证码有效期: ${deviceCodeData.expires_in} 秒 (${Math.floor(deviceCodeData.expires_in / 60)} 分钟)`);
    console.log(`🔄 轮询间隔: ${deviceCodeData.interval} 秒`);
    console.log();
    console.log('━'.repeat(60));
    console.log('⚠️  请先完成上面的授权步骤，完成后按 Ctrl+C 结束');
    console.log('━'.repeat(60));
    console.log();
    console.log('⏳ 等待授权完成，正在轮询...');
    console.log();
    
    // 步骤2: 轮询获取Token
    const tokenResult = await msGraphDeviceCode.pollForRefreshToken({
      clientId: clientId,
      deviceCode: deviceCodeData.device_code,
      interval: deviceCodeData.interval,
      expiresIn: deviceCodeData.expires_in,
      email: 'test012ss@outlook.com'
    });
    
    console.log('━'.repeat(60));
    console.log('✅ 授权成功！');
    console.log('━'.repeat(60));
    console.log();
    console.log('📧 账号:', tokenResult.email);
    console.log();
    console.log('🔑 Refresh Token:');
    console.log(tokenResult.refreshToken);
    console.log();
    console.log('🎫 Access Token (前50字符):');
    console.log(tokenResult.accessToken.substring(0, 50) + '...');
    console.log();
    console.log('━'.repeat(60));
    
  } catch (error) {
    console.error();
    console.error('❌ 错误:', error.message);
    console.error();
    if (error.response) {
      console.error('详细信息:', error.response.data);
    }
  }
}

// 运行测试
testManualOAuth();
