// 诊断邮件获取问题
const msGraphMail = require('./src/utils/msGraphMail');

// 请替换为实际的邮箱信息
const TEST_CONFIG = {
  email: 'test012ss@outlook.com',
  refreshToken: 'M.C531_BAY.0.U.-CkpWtT8XillsQ1wUH*F1okrIHOsE*gMZ6e1Fs9ec68MNJ8TbWn7VauvBrHyrAnrIHV3j9fiObHbiJBj2cqy*9ovynIqI9VMav9u9jMjAGjFm30jURT8IlRdPRc3zi68U*ZtMBeJhw6wybbPCxpouVQLmLKtA*tTAZa3xPOBmX4Ir9b2pvKREa!Neesl4Edkw6smymBvr*MlxupeINV0ODKxiUHW*Y2EAPtk!PodCMqD76BH0gAgB22S2AJSLr0ouzBccePQM1O5r!Raw1WakMK6NNAD5Df3vHjXCVOvu1yYpROdGCWJDSSoEJXSqM*Y6RJFiYdfHrR*8SaNngJLsTKNGuCEQ7UstasqJ2cp45Rj*qT2xGe5v674HPTRB2w56vg$$',
  clientId: '1d08522d-70bb-4128-8684-449f9a2efaf5'
};

async function diagnose() {
  console.log('='.repeat(70));
  console.log('🔍 邮件获取功能诊断');
  console.log('='.repeat(70));
  console.log(`\n📧 邮箱: ${TEST_CONFIG.email}\n`);
  
  try {
    // 步骤1: 测试Token是否有效
    console.log('━'.repeat(70));
    console.log('步骤1: 测试Access Token获取');
    console.log('━'.repeat(70));
    
    const accessToken = await msGraphMail.getAccessToken(
      TEST_CONFIG.clientId,
      TEST_CONFIG.refreshToken
    );
    console.log('✅ Access Token获取成功');
    console.log(`Token前50字符: ${accessToken.substring(0, 50)}...`);
    
    // 步骤2: 获取最近邮件（无过滤）
    console.log('\n' + '━'.repeat(70));
    console.log('步骤2: 获取最近10封邮件（无过滤）');
    console.log('━'.repeat(70));
    
    const allEmails = await msGraphMail.getEmails(accessToken, {
      maxResults: 10,
      searchKeyword: ''
    });
    
    console.log(`✅ 成功获取 ${allEmails.length} 封邮件\n`);
    
    if (allEmails.length > 0) {
      allEmails.forEach((email, index) => {
        const from = email.from?.emailAddress?.address || '未知';
        const subject = email.subject || '(无主题)';
        const date = new Date(email.receivedDateTime).toLocaleString('zh-CN');
        const bodyPreview = email.bodyPreview || '';
        
        console.log(`邮件 #${index + 1}:`);
        console.log(`  发件人: ${from}`);
        console.log(`  主题: ${subject}`);
        console.log(`  时间: ${date}`);
        console.log(`  预览: ${bodyPreview.substring(0, 80)}...`);
        
        // 尝试提取验证码
        const bodyText = email.body?.content || email.bodyPreview || '';
        const code = msGraphMail.extractVerificationCode(bodyText);
        if (code) {
          console.log(`  🔑 检测到验证码: ${code}`);
        }
        console.log('');
      });
    } else {
      console.log('⚠️  收件箱为空');
    }
    
    // 步骤3: 搜索验证码相关邮件
    console.log('━'.repeat(70));
    console.log('步骤3: 搜索关键词"verification"的邮件');
    console.log('━'.repeat(70));
    
    const verificationEmails = await msGraphMail.getEmails(accessToken, {
      maxResults: 5,
      searchKeyword: 'verification'
    });
    
    console.log(`✅ 找到 ${verificationEmails.length} 封相关邮件\n`);
    
    verificationEmails.forEach((email, index) => {
      const from = email.from?.emailAddress?.address || '未知';
      const subject = email.subject || '(无主题)';
      console.log(`相关邮件 #${index + 1}:`);
      console.log(`  发件人: ${from}`);
      console.log(`  主题: ${subject}`);
      console.log('');
    });
    
    // 步骤4: 搜索Amazon相关邮件
    console.log('━'.repeat(70));
    console.log('步骤4: 搜索关键词"amazon"的邮件');
    console.log('━'.repeat(70));
    
    const amazonEmails = await msGraphMail.getEmails(accessToken, {
      maxResults: 5,
      searchKeyword: 'amazon'
    });
    
    console.log(`✅ 找到 ${amazonEmails.length} 封Amazon相关邮件\n`);
    
    amazonEmails.forEach((email, index) => {
      const from = email.from?.emailAddress?.address || '未知';
      const subject = email.subject || '(无主题)';
      const bodyText = email.body?.content || email.bodyPreview || '';
      const code = msGraphMail.extractVerificationCode(bodyText);
      
      console.log(`Amazon邮件 #${index + 1}:`);
      console.log(`  发件人: ${from}`);
      console.log(`  主题: ${subject}`);
      if (code) {
        console.log(`  🔑 验证码: ${code}`);
      }
      console.log('');
    });
    
    // 步骤5: 测试验证码提取正则
    console.log('━'.repeat(70));
    console.log('步骤5: 测试验证码提取功能');
    console.log('━'.repeat(70));
    
    const testTexts = [
      'Your verification code is: 123456',
      'verification code: ABC123',
      '验证码：654321',
      'Your OTP is 987654',
      'code: XY7890',
      'Please enter 456789 to verify'
    ];
    
    testTexts.forEach(text => {
      const code = msGraphMail.extractVerificationCode(text);
      console.log(`文本: "${text}"`);
      console.log(`提取结果: ${code || '未找到'}\n`);
    });
    
    console.log('━'.repeat(70));
    console.log('✅ 诊断完成');
    console.log('━'.repeat(70));
    console.log('\n💡 诊断建议:');
    console.log('1. 如果能获取到邮件但提取不到验证码，可能是正则表达式不匹配');
    console.log('2. 如果搜索不到特定邮件，可能是搜索关键词不对');
    console.log('3. 如果根本获取不到邮件，检查Token权限和邮箱配置');
    console.log('4. Amazon验证码邮件的发件人通常是 no-reply@amazon.com');
    
  } catch (error) {
    console.error('\n' + '━'.repeat(70));
    console.error('❌ 诊断过程出错');
    console.error('━'.repeat(70));
    console.error('错误:', error.message);
    if (error.response?.data) {
      console.error('详细信息:', JSON.stringify(error.response.data, null, 2));
    }
    console.error('\n可能的原因:');
    console.error('1. Refresh Token已过期或无效');
    console.error('2. Client ID不正确');
    console.error('3. 网络连接问题');
    console.error('4. Microsoft Graph API权限不足');
  }
}

diagnose();
