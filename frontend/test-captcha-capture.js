/**
 * Captcha Canvas 工具类测试脚本
 * 演示如何使用工具类完成完整的验证码识别流程
 */

const { chromium } = require('playwright');
const CaptchaCanvasCapture = require('./CaptchaCanvasCapture');
const fs = require('fs');

async function testCaptchaCapture() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox']
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 创建工具类实例
    const captcha = new CaptchaCanvasCapture({
      clientKey: process.env.YESCAPTCHA_CLIENT_KEY || '0336ef0e8b28817fc0a209170829f1c43cefee7481336'
    });

    // 打开测试 HTML
    const htmlPath = 'C:\\Users\\sxh\\Desktop\\test1111.html';
    const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');
    
    console.log(`[测试] 打开页面: ${htmlPath}`);
    await page.goto(fileUrl, { waitUntil: 'load', timeout: 10000 }).catch(() => {});
    
    // 等待页面加载
    await page.waitForTimeout(8000);

    console.log('\n========== 工具类功能测试 ==========\n');

    // 测试1: 获取 API 文档
    console.log('【测试1】获取 API 文档链接');
    const docs = captcha.getApiDocumentation();
    console.log('API 文档:');
    console.log('  - getBalance:', docs.getBalance);
    console.log('  - createTask:', docs.createTask);
    console.log('  - 基础 URL:', docs.baseUrl);
    console.log('  - 支持的类型:', docs.supportedTypes.join(', '));

    // 测试2: 获取余额
    console.log('\n【测试2】获取账户余额');
    const balance = await captcha.getBalance();
    console.log(`余额: $${balance}`);

    // 测试3: 获取提示语
    console.log('\n【测试3】获取验证码提示语');
    const promptText = await captcha.getPromptText(page);
    console.log(`提示语: "${promptText}"`);

    // 测试4: 翻译提示语
    console.log('\n【测试4】翻译提示语到英文');
    const englishQuestion = await captcha.translateToEnglish(promptText);
    console.log(`翻译结果: "${englishQuestion}"`);

    // 测试5: 完整流程
    console.log('\n【测试5】完整的验证码解决流程');
    const result = await captcha.solveWithYescaptcha(page);

    if (result.success) {
      console.log('\n========== 识别结果 ==========');
      console.log(`✓ 识别成功！`);
      console.log(`全部数据：${JSON.stringify(result, null, 2)}`);
      console.log(`  - 原始提示语: "${result.originalQuestion}"`);
      console.log(`  - 英文提示语: "${result.translatedQuestion}"`);
      console.log(`  - 任务 ID: ${result.taskId}`);
      console.log(`  - 错误码: ${result.errorId}`);
      console.log(`  - 状态: ${result.status}`);
      console.log(`  - 解决方案 (objects): [${result.solution.objects.join(', ')}]`);
      console.log(`  - 解决方案 (top_k): [${result.solution.top_k.join(', ')}]`);
      console.log(`  - 图片 Base64 大小: ${(result.base64Image.length / 1024).toFixed(2)} KB`);

      // 保存结果
      const outputFile = 'C:\\Users\\sxh\\Desktop\\captcha-result.json';
      fs.writeFileSync(outputFile, JSON.stringify({
        timestamp: new Date().toISOString(),
        originalQuestion: result.originalQuestion,
        translatedQuestion: result.translatedQuestion,
        taskId: result.taskId,
        errorId: result.errorId,
        status: result.status,
        solution: result.solution,
        base64Size: result.base64Image.length
      }, null, 2), 'utf8');
      
      console.log(`\n✓ 识别结果已保存到: ${outputFile}`);

      // 保存图片
      const imageFile = 'C:\\Users\\sxh\\Desktop\\captcha-result.png';
      const imgBuffer = Buffer.from(result.base64Image, 'base64');
      fs.writeFileSync(imageFile, imgBuffer);
      console.log(`✓ 验证码图片已保存到: ${imageFile}`);

      // 【新增】执行点击操作
      console.log('\n========== 执行点击操作 ==========');
      console.log('等待 2 秒后开始点击...');
      await page.waitForTimeout(2000);
      
      const clickResult = await captcha.clickTargets(page, result.solution);
      
      console.log('\n========== 点击结果 ==========');
      if (clickResult.success) {
        console.log(`✓ 点击成功！`);
        console.log(`  - 点击数量: ${clickResult.clickedCount}`);
        console.log(`  - 目标位置: [${clickResult.targetIndices.join(', ')}]`);
        console.log(`  - 消息: ${clickResult.message}`);
        
        // 【新增】点击完所有目标图片后，点击提交按钮
        const submitResult = await captcha.submitVerification(page);
        
        console.log('\n========== 提交结果 ==========');
        if (submitResult.success) {
          console.log(`✓ 提交成功！`);
          console.log(`  - 消息: ${submitResult.message}`);
        } else {
          console.log(`✗ 提交失败: ${submitResult.error}`);
        }
      } else {
        console.log(`✗ 点击失败: ${clickResult.error}`);
      }

      // 等待验证完成
      console.log('\n等待 3 秒以查看验证结果...');
      await page.waitForTimeout(3000);
    } else {
      console.log(`\n✗ 识别失败: ${result.error}`);
      
      // 即使失败也尝试保存截图用于调试
      console.log('\n【尝试保存截图用于调试】');
      try {
        const canvasCount = await page.locator('canvas').count();
        console.log(`检测到 ${canvasCount} 个 canvas`);
        
        for (let i = 0; i < canvasCount; i++) {
          try {
            const canvasLocator = page.locator('canvas').nth(i);
            const info = await canvasLocator.evaluate(el => ({
              width: el.width,
              height: el.height,
              offsetWidth: el.offsetWidth,
              offsetHeight: el.offsetHeight
            }));
            
            console.log(`Canvas ${i}: ${info.width}x${info.height}, offset: ${info.offsetWidth}x${info.offsetHeight}`);
            
            if (info.offsetWidth > 0 && info.offsetHeight > 0) {
              const screenshot = await canvasLocator.screenshot().catch(() => null);
              if (screenshot) {
                const debugFile = `C:\\Users\\sxh\\Desktop\\debug-canvas-${i}.png`;
                fs.writeFileSync(debugFile, screenshot);
                console.log(`✓ Canvas ${i} 已保存到: ${debugFile}`);
                
                // 同时保存 base64
                const base64 = screenshot.toString('base64');
                const base64File = `C:\\Users\\sxh\\Desktop\\debug-canvas-${i}-base64.txt`;
                fs.writeFileSync(base64File, base64);
                console.log(`✓ Base64 已保存到: ${base64File}`);
              }
            }
          } catch (e) {
            console.log(`Canvas ${i} 保存失败: ${e.message}`);
          }
        }
      } catch (e) {
        console.log(`保存调试截图失败: ${e.message}`);
      }
    }

    console.log('\n========== 测试完成 ==========\n');
    console.log('✓ 浏览器保持打开状态');
    console.log('ℹ️  等待 30 秒后脚本退出（浏览器会继续保持打开）...\n');
    
    // 等待30秒，让用户有时间观看验证结果
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('测试过程中发生错误:', error);
  } finally {
    // 脚本正常退出，浏览器保持打开状态
    console.log('[完成] 脚本已退出，浏览器保持打开，请手动关闭。\n');
  }
}

// 运行测试
testCaptchaCapture().catch(console.error);
