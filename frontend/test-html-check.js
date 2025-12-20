/**
 * 直接检查本地HTML文件是否包含2FA页面的关键元素
 */

const fs = require('fs');
const path = require('path');

console.log('\n====================================');
console.log('   HTML文件内容检查');
console.log('====================================\n');

const filePath = 'C:\\Users\\sxh\\Desktop\\test1111.html';

try {
  // 读取文件
  const content = fs.readFileSync(filePath, 'utf8');
  
  console.log(`📂 文件大小: ${(content.length / 1024).toFixed(2)} KB`);
  
  // 检查关键元素
  const checks = [
    { pattern: /id="enable-mfa-form-submit"/i, name: '确认按钮 (#enable-mfa-form-submit)' },
    { pattern: /name="trustThisDevice"/i, name: '复选框 (name="trustThisDevice")' },
    { pattern: /id="enable-mfa-form"/i, name: '表单 (id="enable-mfa-form")' },
    { pattern: /Don't require OTP|不要求OTP|不需要OTP/i, name: '2FA确认文本' },
    { pattern: /button.*Confirm|确认|确认按钮/i, name: '确认按钮文本' },
  ];
  
  console.log('\n🔍 检查关键元素:\n');
  
  let foundCount = 0;
  checks.forEach((check, index) => {
    const found = check.pattern.test(content);
    foundCount += found ? 1 : 0;
    console.log(`[${index + 1}] ${check.name}: ${found ? '✅ 找到' : '❌ 未找到'}`);
  });
  
  console.log(`\n📊 检测结果: 找到 ${foundCount}/${checks.length} 个关键元素`);
  
  if (foundCount >= 3) {
    console.log('\n✅ 这看起来是一个有效的2FA确认页面！');
  } else {
    console.log('\n⚠️ 这可能不是一个标准的2FA确认页面');
  }
  
  // 打印相关代码片段
  console.log('\n📋 相关代码片段:\n');
  
  // 查找form标签
  const formMatch = content.match(/<form[^>]*>[\s\S]{0,500}<\/form>/i);
  if (formMatch) {
    console.log('Form标签:');
    console.log(formMatch[0].substring(0, 300) + '...\n');
  }
  
  // 查找button
  const buttonMatch = content.match(/<button[^>]*id="enable-mfa-form-submit"[^>]*>[\s\S]{0,100}<\/button>/i);
  if (buttonMatch) {
    console.log('Button标签:');
    console.log(buttonMatch[0] + '\n');
  }
  
  // 查找input checkbox
  const checkboxMatch = content.match(/<input[^>]*name="trustThisDevice"[^>]*>/i);
  if (checkboxMatch) {
    console.log('Checkbox标签:');
    console.log(checkboxMatch[0] + '\n');
  }
  
  console.log('====================================\n');
  
} catch (err) {
  console.error('❌ 错误:', err.message);
}
