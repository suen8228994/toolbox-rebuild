const { chromium } = require('playwright');
const CaptchaCanvasCapture = require('./CaptchaCanvasCapture');

async function testCaptchaClick() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    // 打开测试页面
    const testPage = 'file:///C:/Users/sxh/Desktop/test1111.html';
    console.log(`[测试] 打开页面: ${testPage}\n`);
    await page.goto(testPage, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const captcha = new CaptchaCanvasCapture();

    // 1. 识别验证码
    console.log('[测试] ========== 第一步: 识别验证码 ==========\n');
    const result = await captcha.solveWithYescaptcha(page);
    
    console.log('\n[测试] ========== 识别结果 ==========');
    console.log(JSON.stringify({
      errorId: result.errorId,
      status: result.status,
      taskId: result.taskId,
      originalQuestion: result.originalQuestion,
      translatedQuestion: result.translatedQuestion,
      solution: {
        label: result.solution.label,
        objects: result.solution.objects,
        top_k: result.solution.top_k,
        confidences: result.solution.confidences
      }
    }, null, 2));

    if (!result.success) {
      throw new Error(result.error);
    }

    // 2. 点击目标
    console.log('\n[测试] ========== 第二步: 点击目标 ==========\n');
    const clickResult = await captcha.clickTargets(page, result.solution);
    
    console.log('\n[测试] ========== 点击结果 ==========');
    console.log(JSON.stringify(clickResult, null, 2));

    // 等待一会儿看结果
    await page.waitForTimeout(3000);

    console.log('\n[测试] ✓ 完整流程测试成功！');

  } catch (error) {
    console.error('\n[测试] ✗ 测试失败:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

testCaptchaClick().catch(console.error);
