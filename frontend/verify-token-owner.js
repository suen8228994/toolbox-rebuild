// 验证Token对应的邮箱账号
const axios = require('axios');

const TEST_CONFIG = {
  refreshToken: 'M.C531_BAY.0.U.-CkpWtT8XillsQ1wUH*F1okrIHOsE*gMZ6e1Fs9ec68MNJ8TbWn7VauvBrHyrAnrIHV3j9fiObHbiJBj2cqy*9ovynIqI9VMav9u9jMjAGjFm30jURT8IlRdPRc3zi68U*ZtMBeJhw6wybbPCxpouVQLmLKtA*tTAZa3xPOBmX4Ir9b2pvKREa!Neesl4Edkw6smymBvr*MlxupeINV0ODKxiUHW*Y2EAPtk!PodCMqD76BH0gAgB22S2AJSLr0ouzBccePQM1O5r!Raw1WakMK6NNAD5Df3vHjXCVOvu1yYpROdGCWJDSSoEJXSqM*Y6RJFiYdfHrR*8SaNngJLsTKNGuCEQ7UstasqJ2cp45Rj*qT2xGe5v674HPTRB2w56vg$$',
  clientId: '1d08522d-70bb-4128-8684-449f9a2efaf5'
};

async function verifyTokenOwner() {
  console.log('='.repeat(70));
  console.log('🔍 验证Token对应的邮箱账号');
  console.log('='.repeat(70));
  
  try {
    // 步骤1: 获取Access Token
    console.log('\n步骤1: 使用Refresh Token获取Access Token...');
    const tokenResponse = await axios.post(
      'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
      new URLSearchParams({
        client_id: TEST_CONFIG.clientId,
        grant_type: 'refresh_token',
        refresh_token: TEST_CONFIG.refreshToken,
        scope: 'https://graph.microsoft.com/Mail.Read offline_access User.Read'
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );
    
    const accessToken = tokenResponse.data.access_token;
    console.log('✅ Access Token获取成功');
    
    // 步骤2: 获取当前用户信息
    console.log('\n步骤2: 获取当前用户信息...');
    const userResponse = await axios.get(
      'https://graph.microsoft.com/v1.0/me',
      {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    );
    
    const user = userResponse.data;
    
    console.log('\n' + '━'.repeat(70));
    console.log('✅ Token对应的账号信息:');
    console.log('━'.repeat(70));
    console.log(`📧 邮箱地址: ${user.mail || user.userPrincipalName}`);
    console.log(`👤 显示名称: ${user.displayName}`);
    console.log(`🆔 用户ID: ${user.id}`);
    console.log('━'.repeat(70));
    
    // 步骤3: 获取邮箱统计
    console.log('\n步骤3: 获取邮箱统计信息...');
    const mailboxResponse = await axios.get(
      'https://graph.microsoft.com/v1.0/me/mailFolders/inbox',
      {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    );
    
    const inbox = mailboxResponse.data;
    console.log(`\n📬 收件箱统计:`);
    console.log(`   总邮件数: ${inbox.totalItemCount}`);
    console.log(`   未读邮件: ${inbox.unreadItemCount}`);
    
    console.log('\n' + '='.repeat(70));
    console.log('结论:');
    console.log('='.repeat(70));
    console.log(`此Refresh Token对应的邮箱是: ${user.mail || user.userPrincipalName}`);
    console.log(`API调用时访问的邮箱也是: ${user.mail || user.userPrincipalName}`);
    console.log('='.repeat(70));
    
  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    if (error.response?.data) {
      console.error('详细信息:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

verifyTokenOwner();
