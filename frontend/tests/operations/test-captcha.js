/**
 * 单元测试 - CaptchaOperations
 * 测试验证码处理功能
 */

const { chromium } = require('playwright');

async function testCaptchaOperations() {
  console.log('========== 测试 CaptchaOperations ==========\n');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const logs = [];
  const tasklog = (data) => {
    logs.push(data);
    console.log(`[LOG] ${data.message}`);
  };
  
  const CaptchaOperations = require('../src/utils/operations/CaptchaOperations');
  const captcha = new CaptchaOperations(page, {}, tasklog);
  
  try {
    console.log('[说明] 此测试需要手动触发Captcha页面');
    console.log('[说明] 请在Amazon注册流程中触发验证码，然后运行此测试\n');
    
    // 测试1: 检查Captcha
    console.log('[测试1] 检查是否存在Captcha...');
    await page.goto('https://www.amazon.com');
    const hasCaptcha = await captcha.checkCaptcha();
    console.log(`结果: ${hasCaptcha ? '✅ 检测到Captcha' : '❌ 未检测到Captcha'}\n`);
    
    // 如果有Captcha，测试获取数据
    if (hasCaptcha) {
      console.log('[测试2] 获取Captcha数据...');
      const captchaData = await captcha.getCaptchaData();
      console.log(`图片URL: ${captchaData.imageUrl.substring(0, 50)}...`);
      console.log(`提示文本: ${captchaData.prompt}`);
      console.log(`网格大小: ${captchaData.gridSize.rows}x${captchaData.gridSize.cols}`);
      console.log('✅ Captcha数据获取成功\n');
      
      // 测试3: 获取解决方案
      console.log('[测试3] 生成Captcha解决方案...');
      const solution = await captcha.getCaptchaSolution(captchaData);
      console.log(`需要点击位置数: ${solution.positions.length}`);
      console.log(`置信度: ${solution.confidence}`);
      console.log('位置列表:');
      solution.positions.forEach((pos, idx) => {
        console.log(`  ${idx + 1}. 行${pos.row} 列${pos.col}`);
      });
      console.log('✅ 解决方案生成成功\n');
      
      // 测试4: 模拟点击（不实际提交）
      console.log('[测试4] 模拟点击验证码位置...');
      for (const position of solution.positions.slice(0, 1)) {
        await captcha.clickCaptchaPosition(position);
        console.log(`✅ 点击位置 (行${position.row}, 列${position.col}) 成功`);
      }
      console.log('✅ 点击测试完成\n');
    }
    
    console.log('========== CaptchaOperations 测试完成 ==========\n');
    console.log(`总共产生日志: ${logs.length} 条`);
    
  } catch (error) {
    console.error(`❌ 测试失败: ${error.message}`);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

// 运行测试
if (require.main === module) {
  testCaptchaOperations();
}

module.exports = { testCaptchaOperations };
