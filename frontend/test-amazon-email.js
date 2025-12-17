// 测试获取Amazon验证码邮件
const msGraphMail = require('./src/utils/msGraphMail');

// 使用真实的测试邮箱配置
const TEST_EMAIL_LINE = 'ArredEahan0667@hotmail.com----injExhY374842----9e5f94bc-e8a4-4e73-b8be-63364c29d753----M.C559_BAY.0.U.-CtHavspvgoMM7j6WivgwB1aKLNksFuC8k24ELK8*oXn0uL5DeLUQgN2PtdCS8vD89sAKGfdTzlCXwKHEeF4VRcW11ExPtqC5Jlgg5!7BQ66VYUy0*oR3I!oBJXTgu*mGONQ5f0Uv5gp6AojYJfd31hd9ML0HzSXMoNa5JcTMGf1VT24d2gLfVrLCYyFhpZEvuWlZp!PeJg4dkeoVoUBhp6ZhTqt9*aKHET3RlfzxbqS2KwyTkC9FD6JqfXYVCuw1S34ua34ad*hQYYGhB!NpfMqEae*NusBXINkavRU1eWvmmiVdsuqmunaa0RGOEmbXX4LlI51FUpaQ2KPMhBW8EC8MTe!B8QsEv4BkMxVhHf9VForDBIDzv69HwgbDWqO4d95srs2apmkRPpxHE4*nEbwUjY*oXkByqLcDIJpVzWVrLBpo*pvii1NHBnBxoAaH6w$$';

// 解析 emailLine: email----password----client_id----refresh_token
const parts = TEST_EMAIL_LINE.split('----');
const TEST_CONFIG = {
  email: parts[0],
  password: parts[1],
  clientId: parts[2],
  refreshToken: parts[3]
};

async function testAmazonEmail() {
  console.log('='.repeat(70));
  console.log('📧 测试获取Amazon验证码邮件');
  console.log('='.repeat(70));
  console.log(`\n📧 邮箱: ${TEST_CONFIG.email}`);
  console.log('━'.repeat(70));
  
  try {
    // 获取Access Token
    console.log('🔄 获取Access Token...');
    const accessToken = await msGraphMail.getAccessToken(
      TEST_CONFIG.clientId,
      TEST_CONFIG.refreshToken
    );
    console.log('✅ Token获取成功\n');
    
    // 方法1: 获取最近邮件并查找Amazon
    console.log('━'.repeat(70));
    console.log('方法1: 获取最近20封邮件（无过滤）');
    console.log('━'.repeat(70));
    
    const recentEmails = await msGraphMail.getEmails(accessToken, {
      maxResults: 20,
      searchKeyword: '' // 不使用搜索，直接获取
    });
    
    console.log(`✅ 获取到 ${recentEmails.length} 封邮件\n`);
    
    // 先显示所有邮件
    console.log('📋 所有邮件列表:');
    recentEmails.forEach((email, index) => {
      const from = email.from?.emailAddress?.address || '未知';
      const subject = email.subject || '(无主题)';
      const date = new Date(email.receivedDateTime).toLocaleString('zh-CN');
      console.log(`${index + 1}. [${date}] ${from}`);
      console.log(`   ${subject}\n`);
    });
    
    const amazonEmails = recentEmails.filter(email => {
      const from = email.from?.emailAddress?.address || '';
      const subject = email.subject || '';
      return from.toLowerCase().includes('amazon') || 
             subject.toLowerCase().includes('amazon');
    });
    
    console.log(`🔍 筛选出 ${amazonEmails.length} 封Amazon相关邮件:\n`);
    
    amazonEmails.forEach((email, index) => {
      const from = email.from?.emailAddress?.address || '未知';
      const subject = email.subject || '(无主题)';
      const date = new Date(email.receivedDateTime).toLocaleString('zh-CN');
      const bodyText = email.body?.content || email.bodyPreview || '';
      
      console.log(`Amazon邮件 #${index + 1}:`);
      console.log(`  发件人: ${from}`);
      console.log(`  主题: ${subject}`);
      console.log(`  时间: ${date}`);
      
      // 提取验证码
      const code = msGraphMail.extractVerificationCode(bodyText);
      if (code) {
        console.log(`  🔑 验证码: ${code}`);
        
        // 显示邮件内容片段
        const preview = bodyText.replace(/<[^>]*>/g, '').substring(0, 200);
        console.log(`  内容预览: ${preview}...`);
      } else {
        console.log(`  ⚠️  未找到验证码`);
      }
      console.log('');
    });
    
    // 方法2: 测试waitForVerificationEmail函数
    console.log('━'.repeat(70));
    console.log('方法2: 测试waitForVerificationEmail（从最近邮件中查找）');
    console.log('━'.repeat(70));
    
    try {
      const code = await msGraphMail.waitForVerificationEmail(
        TEST_CONFIG.email,
        TEST_CONFIG.refreshToken,
        TEST_CONFIG.clientId,
        {
          maxRetries: 1,  // 只尝试1次，因为邮件已经存在
          retryInterval: 1000,
          searchKeyword: '',  // 不使用搜索
          fromFilter: 'amazon',  // 过滤Amazon发件人
          onProgress: (progress) => {
            const time = new Date().toLocaleTimeString();
            console.log(`[${time}] ${progress.message}`);
          }
        }
      );
      
      console.log('\n✅ 成功提取验证码:', code);
      
    } catch (error) {
      console.error('\n❌ waitForVerificationEmail失败:', error.message);
    }
    
    console.log('\n' + '━'.repeat(70));
    console.log('✅ 测试完成');
    console.log('━'.repeat(70));
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    if (error.response?.data) {
      console.error('详细错误:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testAmazonEmail();
