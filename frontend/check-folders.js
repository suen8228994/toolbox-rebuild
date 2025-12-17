// 检查所有邮件文件夹
const msGraphMail = require('./src/utils/msGraphMail');
const axios = require('axios');

const TEST_CONFIG = {
  email: 'test012ss@outlook.com',
  refreshToken: 'M.C531_BAY.0.U.-CkpWtT8XillsQ1wUH*F1okrIHOsE*gMZ6e1Fs9ec68MNJ8TbWn7VauvBrHyrAnrIHV3j9fiObHbiJBj2cqy*9ovynIqI9VMav9u9jMjAGjFm30jURT8IlRdPRc3zi68U*ZtMBeJhw6wybbPCxpouVQLmLKtA*tTAZa3xPOBmX4Ir9b2pvKREa!Neesl4Edkw6smymBvr*MlxupeINV0ODKxiUHW*Y2EAPtk!PodCMqD76BH0gAgB22S2AJSLr0ouzBccePQM1O5r!Raw1WakMK6NNAD5Df3vHjXCVOvu1yYpROdGCWJDSSoEJXSqM*Y6RJFiYdfHrR*8SaNngJLsTKNGuCEQ7UstasqJ2cp45Rj*qT2xGe5v674HPTRB2w56vg$$',
  clientId: '1d08522d-70bb-4128-8684-449f9a2efaf5'
};

async function checkAllFolders() {
  console.log('='.repeat(70));
  console.log('📁 检查所有邮件文件夹');
  console.log('='.repeat(70));
  
  try {
    const accessToken = await msGraphMail.getAccessToken(
      TEST_CONFIG.clientId,
      TEST_CONFIG.refreshToken
    );
    console.log('✅ Token获取成功\n');
    
    // 获取所有文件夹
    console.log('获取邮件文件夹列表...\n');
    const foldersResponse = await axios.get(
      'https://graph.microsoft.com/v1.0/me/mailFolders',
      {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    );
    
    const folders = foldersResponse.data.value;
    console.log(`找到 ${folders.length} 个文件夹:\n`);
    
    for (const folder of folders) {
      console.log(`📂 ${folder.displayName} (${folder.totalItemCount} 封邮件)`);
      console.log(`   ID: ${folder.id}`);
      
      // 获取每个文件夹的最新5封邮件
      try {
        const messagesResponse = await axios.get(
          `https://graph.microsoft.com/v1.0/me/mailFolders/${folder.id}/messages?$top=5&$select=subject,from,receivedDateTime&$orderby=receivedDateTime DESC`,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          }
        );
        
        const messages = messagesResponse.data.value;
        if (messages.length > 0) {
          console.log(`   最新邮件:`);
          messages.forEach((msg, index) => {
            const from = msg.from?.emailAddress?.address || '未知';
            const subject = msg.subject || '(无主题)';
            const date = new Date(msg.receivedDateTime).toLocaleString('zh-CN');
            console.log(`   ${index + 1}. [${date}] ${from}`);
            console.log(`      ${subject}`);
            
            // 检查是否是Amazon邮件
            if (from.toLowerCase().includes('amazon') || subject.toLowerCase().includes('amazon')) {
              console.log(`      🎯 **这是Amazon邮件！**`);
            }
          });
        }
        console.log('');
      } catch (error) {
        console.log(`   ⚠️  无法读取此文件夹\n`);
      }
    }
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
    if (error.response?.data) {
      console.error(JSON.stringify(error.response.data, null, 2));
    }
  }
}

checkAllFolders();
