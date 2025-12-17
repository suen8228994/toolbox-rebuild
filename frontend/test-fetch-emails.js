// 测试使用refresh token获取Microsoft邮箱邮件
const axios = require('axios');

const TEST_EMAIL = 'test012ss@outlook.com';
const REFRESH_TOKEN = 'M.C531_BAY.0.U.-CkpWtT8XillsQ1wUH*F1okrIHOsE*gMZ6e1Fs9ec68MNJ8TbWn7VauvBrHyrAnrIHV3j9fiObHbiJBj2cqy*9ovynIqI9VMav9u9jMjAGjFm30jURT8IlRdPRc3zi68U*ZtMBeJhw6wybbPCxpouVQLmLKtA*tTAZa3xPOBmX4Ir9b2pvKREa!Neesl4Edkw6smymBvr*MlxupeINV0ODKxiUHW*Y2EAPtk!PodCMqD76BH0gAgB22S2AJSLr0ouzBccePQM1O5r!Raw1WakMK6NNAD5Df3vHjXCVOvu1yYpROdGCWJDSSoEJXSqM*Y6RJFiYdfHrR*8SaNngJLsTKNGuCEQ7UstasqJ2cp45Rj*qT2xGe5v674HPTRB2w56vg$$';
const CLIENT_ID = '1d08522d-70bb-4128-8684-449f9a2efaf5';

/**
 * 使用refresh token获取access token
 */
async function getAccessToken(clientId, refreshToken) {
  console.log('🔄 正在刷新Access Token...');
  
  const url = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: 'https://graph.microsoft.com/Mail.Read offline_access'
  }).toString();
  
  try {
    const response = await axios.post(url, body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000
    });
    
    console.log('✅ Access Token获取成功');
    return response.data.access_token;
  } catch (error) {
    console.error('❌ 获取Access Token失败:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * 获取收件箱邮件列表
 */
async function getEmails(accessToken, options = {}) {
  const {
    maxResults = 10,
    searchKeyword = '',
    folder = 'inbox'
  } = options;
  
  console.log(`\n📬 正在获取邮件列表...`);
  console.log(`   文件夹: ${folder}`);
  console.log(`   最大数量: ${maxResults}`);
  if (searchKeyword) {
    console.log(`   搜索关键词: ${searchKeyword}`);
  }
  
  let url = `https://graph.microsoft.com/v1.0/me/mailFolders/${folder}/messages`;
  url += `?$top=${maxResults}`;
  url += `&$select=subject,from,receivedDateTime,bodyPreview,body,isRead`;
  url += `&$orderby=receivedDateTime DESC`;
  
  // 如果有搜索关键词，添加过滤
  if (searchKeyword) {
    url += `&$search="${searchKeyword}"`;
  }
  
  try {
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    console.log(`✅ 成功获取 ${response.data.value.length} 封邮件\n`);
    return response.data.value;
  } catch (error) {
    console.error('❌ 获取邮件失败:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * 从邮件中提取验证码
 */
function extractVerificationCode(emailBody) {
  // 常见验证码格式
  const patterns = [
    /\b(\d{6})\b/,                    // 6位数字
    /\b([A-Z0-9]{6})\b/,              // 6位大写字母数字
    /验证码[：:]\s*([A-Z0-9]{4,8})/i,  // 中文：验证码
    /code[：:]\s*([A-Z0-9]{4,8})/i,   // Code:
    /OTP[：:]\s*([A-Z0-9]{4,8})/i,    // OTP:
  ];
  
  for (const pattern of patterns) {
    const match = emailBody.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * 主测试函数
 */
async function testFetchEmails() {
  console.log('='.repeat(60));
  console.log('📧 Microsoft邮箱取件测试');
  console.log('='.repeat(60));
  console.log(`\n📧 测试账号: ${TEST_EMAIL}`);
  console.log('━'.repeat(60));
  
  try {
    // 步骤1: 获取Access Token
    const accessToken = await getAccessToken(CLIENT_ID, REFRESH_TOKEN);
    
    // 步骤2: 获取最近的邮件
    const emails = await getEmails(accessToken, {
      maxResults: 10,
      searchKeyword: '' // 可以设置为 'verification' 或 '验证码' 等
    });
    
    if (emails.length === 0) {
      console.log('📭 收件箱为空，没有邮件');
      return;
    }
    
    // 步骤3: 显示邮件列表
    console.log('━'.repeat(60));
    console.log('📬 邮件列表:');
    console.log('━'.repeat(60));
    
    emails.forEach((email, index) => {
      const from = email.from?.emailAddress?.address || '未知';
      const subject = email.subject || '(无主题)';
      const date = new Date(email.receivedDateTime).toLocaleString('zh-CN');
      const preview = email.bodyPreview || '';
      const isRead = email.isRead ? '✅' : '📩';
      
      console.log(`\n${isRead} 邮件 #${index + 1}`);
      console.log(`   主题: ${subject}`);
      console.log(`   发件人: ${from}`);
      console.log(`   时间: ${date}`);
      console.log(`   预览: ${preview.substring(0, 100)}...`);
      
      // 尝试提取验证码
      const bodyText = email.body?.content || email.bodyPreview || '';
      const code = extractVerificationCode(bodyText);
      if (code) {
        console.log(`   🔑 检测到验证码: ${code}`);
      }
    });
    
    console.log('\n' + '━'.repeat(60));
    console.log('✅ 测试完成');
    console.log('━'.repeat(60));
    
    // 返回第一封邮件的详细信息用于调试
    if (emails.length > 0) {
      console.log('\n📄 第一封邮件完整内容:');
      console.log(JSON.stringify(emails[0], null, 2));
    }
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    if (error.response?.data) {
      console.error('详细错误:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// 运行测试
testFetchEmails();
