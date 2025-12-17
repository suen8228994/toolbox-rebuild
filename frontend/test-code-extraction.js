// 测试验证码提取逻辑
const msGraphMail = require('./src/utils/msGraphMail');

// 模拟真实的Amazon验证邮件HTML内容
const testEmails = [
  {
    name: '测试1: 标准Amazon OTP邮件',
    body: `
      Verify your new Amazon account
      
      To verify your email address, please use the following One Time Password (OTP):
      
      245276
      
      Don't share this OTP with anyone.
    `
  },
  {
    name: '测试2: HTML格式的邮件',
    body: `
      <html>
        <body>
          <p>Verify your new Amazon account</p>
          <p>To verify your email address, please use the following One Time Password (OTP):</p>
          <h2>245276</h2>
          <p>&nbsp;</p>
          <p>Don't share this OTP with anyone. Amazon takes your account security very seriously.</p>
        </body>
      </html>
    `
  },
  {
    name: '测试3: 混合HTML和文本',
    body: `
      Verify your new Amazon account

To verify your email address, please use the following One Time Password (OTP):

245276&nbsp;Don't share this OTP with anyone. Amazon takes your account security very seriously. Amazon Customer Service will never ask 
    `
  },
  {
    name: '测试4: 复杂HTML结构',
    body: `
      <div style="font-family: Arial;">
        <h1>Verify your new Amazon account</h1>
        <p>To verify your email address, please use the following One Time Password (OTP):</p>
        <div style="font-size: 24px; font-weight: bold; padding: 10px; background: #f0f0f0;">
          245276
        </div>
        <p>Don't share this OTP with anyone.</p>
        <small style="color: #666;">007185</small>
      </div>
    `
  }
];

console.log('='.repeat(70));
console.log('📧 测试验证码提取逻辑');
console.log('='.repeat(70));

testEmails.forEach((test, index) => {
  console.log(`\n${index + 1}. ${test.name}`);
  console.log('-'.repeat(70));
  
  const code = msGraphMail.extractVerificationCode(test.body);
  
  if (code === '245276') {
    console.log(`✅ 正确提取: ${code}`);
  } else {
    console.log(`❌ 提取错误: ${code} (期望: 245276)`);
  }
});

console.log('\n' + '='.repeat(70));
console.log('测试完成');
console.log('='.repeat(70));
