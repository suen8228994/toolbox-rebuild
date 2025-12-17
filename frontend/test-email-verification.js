/**
 * 测试 Amazon 注册邮件验证码获取功能
 */

// 导入工具函数
const {
  extractEmailVerificationCode: utilExtractEmailCode
} = require('./src/refactored-backend/utils/toolUtils');

// 测试配置 - 完整的 emailLine 格式: email----password----client_id----refresh_token
const TEST_EMAIL_LINE = 'AyanaFfertz5376@hotmail.com----yylEkjX713919----9e5f94bc-e8a4-4e73-b8be-63364c29d753----M.C525_BAY.0.U.-CtxwWwWgpAcRdify!ZuWrBlWw*i1*GULhqkcvfR7RCkor75POgUs9aLd02YF8NOa8svMfG3n*Pjn3XXvzVFOR1c6YCyH1k2KcjsGUr7QgFUA2ob*V9vTn*XJDqd6TSFaYy9Q6CrdjkaSZ6QZfTT1HMKAcin073bumcYiZYA5xtpwptp8imuaWoqQEmGZEltUVS*tNDxFqRfOlHmXzqcBVnHhhgiTOreSaoH*B7PHnk*Cq!mgBMvt7HeZ3LVKSznL6XzbjEz6aqrb!OA8u3XZVlvqcyVOgD7gIXbqyOWEkYm3L8eaFnasYmQ88S0TY7grKop4V2sn0OBqnpKvjgoQ6ntO1LRzxXqPFPrb9KK5xrkVJdyVgkMiUMksacho1bXe8AVY1P9zxtDliUFxrDF6zokuprh40pZSeW1vJlgIAhdMhOQbjZZZsR5ohA*99EB!ig$$';

// 解析 emailLine
const parts = TEST_EMAIL_LINE.split('----');
const TEST_CONFIG = {
  email: parts[0],
  password: parts[1],
  client_id: parts[2],
  refresh_token: parts[3]
};

/**
 * 获取邮件验证码 - 模拟 amazonRegisterCore 中的逻辑
 */
async function getEmailVerificationCode(startTime) {
  const { refresh_token, client_id } = TEST_CONFIG;
  
  console.log('🔄 步骤1: 获取 Access Token...');
  
  // 1. 获取 access token
  const tokenResponse = await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: client_id,
      grant_type: 'refresh_token',
      refresh_token: refresh_token,
      scope: 'https://graph.microsoft.com/Mail.Read offline_access'
    }).toString()
  });
  
  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`获取access_token失败: ${tokenResponse.statusText}\n${errorText}`);
  }
  
  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token;
  console.log('✅ Access Token 获取成功\n');
  
  console.log('📬 步骤2: 获取最近20封邮件...');
  
  // 2. 获取最近的邮件
  const emailsUrl = 'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=20&$select=subject,from,receivedDateTime,bodyPreview,body&$orderby=receivedDateTime DESC';
  
  const emailsResponse = await fetch(emailsUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!emailsResponse.ok) {
    throw new Error(`获取邮件失败: ${emailsResponse.statusText}`);
  }
  
  const emailsData = await emailsResponse.json();
  const emails = emailsData.value || [];
  
  console.log(`✅ 成功获取 ${emails.length} 封邮件\n`);
  
  if (emails.length === 0) {
    throw new Error('收件箱为空，没有新邮件');
  }
  
  console.log('━'.repeat(70));
  console.log('📋 邮件列表:');
  console.log('━'.repeat(70));
  
  // 显示所有邮件
  emails.forEach((email, index) => {
    const from = email.from?.emailAddress?.address || '未知';
    const subject = email.subject || '(无主题)';
    const timestamp = new Date(email.receivedDateTime).getTime();
    const date = new Date(email.receivedDateTime).toLocaleString('zh-CN');
    const isAfterStart = timestamp > startTime;
    
    console.log(`\n${index + 1}. ${isAfterStart ? '✅ [新]' : '⏸️  [旧]'} ${from}`);
    console.log(`   主题: ${subject}`);
    console.log(`   时间: ${date} (${timestamp})`);
    console.log(`   预览: ${(email.bodyPreview || '').substring(0, 60)}...`);
  });
  
  console.log('\n' + '━'.repeat(70));
  console.log('🔍 步骤3: 查找 Amazon 验证邮件（时间 > startTime）...');
  console.log(`   起始时间: ${new Date(startTime).toLocaleString('zh-CN')} (${startTime})`);
  console.log('━'.repeat(70));
  
  // 3. 查找 Amazon 验证码邮件（时间戳必须大于 startTime）
  const mail = emails.find(email => {
    const from = email.from?.emailAddress?.address || '';
    const timestamp = new Date(email.receivedDateTime).getTime();
    
    // 关键：只处理时间大于 startTime 的邮件
    if (timestamp <= startTime) {
      return false;
    }
    
    // 检查是否是 Amazon 发来的
    return from === 'account-update@amazon.com' || 
           from.includes('amazon.com') ||
           email.subject?.includes('Amazon') ||
           email.subject?.includes('verification');
  });
  
  if (!mail) {
    console.log('\n❌ 没有找到符合条件的 Amazon 验证邮件');
    console.log('   - 发件人必须包含 amazon.com');
    console.log(`   - 时间必须晚于 ${new Date(startTime).toLocaleString('zh-CN')}`);
    throw new Error('没有找到 Amazon 验证邮件');
  }
  
  console.log('\n✅ 找到 Amazon 邮件:');
  console.log(`   发件人: ${mail.from?.emailAddress?.address}`);
  console.log(`   主题: ${mail.subject}`);
  console.log(`   时间: ${new Date(mail.receivedDateTime).toLocaleString('zh-CN')}`);
  
  console.log('\n━'.repeat(70));
  console.log('🔑 步骤4: 提取验证码...');
  console.log('━'.repeat(70));
  
  // 4. 提取验证码
  const bodyText = mail.body?.content || mail.bodyPreview || '';
  console.log(`\n邮件内容预览:\n${bodyText.substring(0, 300)}...\n`);
  
  const code = utilExtractEmailCode(bodyText);
  
  if (!code || code.length === 0) {
    throw new Error('未能从邮件中提取验证码');
  }
  
  console.log(`✅ 成功提取验证码: ${code[0]}`);
  return code[0];
}

/**
 * 主测试函数
 */
async function testEmailVerification() {
  console.log('='.repeat(70));
  console.log('📧 测试 Amazon 邮件验证码获取');
  console.log('='.repeat(70));
  console.log(`\n测试账号: ${TEST_CONFIG.email}`);
  console.log('━'.repeat(70));
  
  try {
    // 测试模式：使用更早的时间点(比最早的邮件更早)，这样可以找到验证邮件
    // 实际注册时使用 Date.now() 作为起始时间
    const startTime = 1765880000000; // 2025/12/16 18:26:40 - 比最早的邮件更早
    console.log(`\n起始时间点: ${new Date(startTime).toLocaleString('zh-CN')}`);
    console.log('（只会获取这个时间之后收到的邮件）');
    console.log('（测试模式：使用较早时间来测试验证码提取）\n');
    
    const verificationCode = await getEmailVerificationCode(startTime);
    
    console.log('\n' + '='.repeat(70));
    console.log('🎉 测试成功！');
    console.log('='.repeat(70));
    console.log(`\n✅ 验证码: ${verificationCode}`);
    
  } catch (error) {
    console.log('\n' + '='.repeat(70));
    console.log('❌ 测试失败');
    console.log('='.repeat(70));
    console.error('\n错误信息:', error.message);
    console.error('\n完整错误:', error);
    process.exit(1);
  }
}

// 运行测试
testEmailVerification();
