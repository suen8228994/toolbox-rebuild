/**
 * Debug 调试脚本 - 在关键位置停下来查看状态
 */

const { chromium } = require('playwright');
const CaptchaCanvasCapture = require('./CaptchaCanvasCapture');
const fs = require('fs');
const path = require('path');

async function debugTest() {
  const captcha = new CaptchaCanvasCapture();
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // 打开测试页面
    await page.goto('file://C:\\Users\\sxh\\Desktop\\test1111.html', {
      waitUntil: 'domcontentloaded'
    }).catch(() => console.log('[测试] 页面加载超时，继续...'));

    console.log('\n========== 开始调试流程 ==========\n');

    // ========== 第1步: 余额检查 ==========
    console.log('【断点1】检查余额...');
    const balance = await captcha.getBalance();
    console.log(`✓ 余额: $${balance}\n`);

    // ========== 第2步: 截图 ==========
    console.log('【断点2】截取验证码图片...');
    const canvasCount = await page.locator('canvas').count();
    console.log(`检测到 ${canvasCount} 个 canvas 元素`);

    let base64Image = null;
    for (let i = 0; i < canvasCount; i++) {
      const canvasLocator = page.locator('canvas').nth(i);
      const info = await canvasLocator.evaluate(el => ({
        width: el.width,
        height: el.height,
        offsetWidth: el.offsetWidth,
        offsetHeight: el.offsetHeight,
        clientWidth: el.clientWidth,
        clientHeight: el.clientHeight,
        style: window.getComputedStyle(el).display
      }));

      console.log(`\nCanvas ${i} 信息:`);
      console.log(`  - width: ${info.width}, height: ${info.height}`);
      console.log(`  - offsetWidth: ${info.offsetWidth}, offsetHeight: ${info.offsetHeight}`);
      console.log(`  - clientWidth: ${info.clientWidth}, clientHeight: ${info.clientHeight}`);
      console.log(`  - display: ${info.style}`);

      if (info.width === 450 && info.height === 450 && info.offsetWidth > 0) {
        console.log(`✓ Canvas ${i} 符合条件，开始截图...`);

        try {
          const sharp = require('sharp');
          let buffer = await canvasLocator.screenshot();
          console.log(`  - 原始截图大小: ${buffer.length} 字节`);

          const metadata = await sharp(buffer).metadata();
          console.log(`  - 原始图片: ${metadata.width}x${metadata.height}, 格式: ${metadata.format}`);

          // 转换为JPEG
          buffer = await sharp(buffer)
            .resize(450, 450, { fit: 'cover' })
            .jpeg({ quality: 90 })
            .toBuffer();

          console.log(`  - 转换后: ${buffer.length} 字节`);

          base64Image = buffer.toString('base64');
          console.log(`  - Base64 长度: ${base64Image.length} 字符`);

          // 保存调试图片
          const debugPath = `C:\\Users\\sxh\\Desktop\\debug-canvas-${i}.png`;
          fs.writeFileSync(debugPath, buffer);
          console.log(`  - 图片已保存: ${debugPath}`);

          break;
        } catch (e) {
          console.error(`  ✗ 处理失败: ${e.message}`);
        }
      }
    }

    if (!base64Image) {
      throw new Error('未能获取 base64 图片');
    }

    // ========== 第3步: 提示语 ==========
    console.log('\n【断点3】提取提示语...');
    const promptText = await captcha.getPromptText(page);
    console.log(`✓ 原始提示语: "${promptText}"`);

    // ========== 第4步: 翻译 ==========
    console.log('\n【断点4】翻译提示语...');
    const englishQuestion = await captcha.translateToEnglish(promptText);
    console.log(`✓ 英文提示语: "${englishQuestion}"`);

    // ========== 关键断点: 检查所有参数 ==========
    console.log('\n========== 【断点5】准备发送到yescaptcha ==========');
    console.log('\n【参数检查】:');
    console.log(`1. clientKey: ${captcha.clientKey.substring(0, 20)}...`);
    console.log(`2. Base64 长度: ${base64Image.length} 字符`);
    console.log(`3. Base64 前缀: ${base64Image.substring(0, 30)}...`);
    console.log(`4. question: "${englishQuestion}"`);

    // 显示base64前几个字节
    const buffer = Buffer.from(base64Image, 'base64');
    console.log(`\n【图片数据检查】:`);
    console.log(`- 图片字节大小: ${buffer.length} 字节`);
    console.log(`- 文件头(前8字节): ${buffer.slice(0, 8).toString('hex')}`);
    console.log(`- JPEG标记 (FF D8): ${buffer[0].toString(16).padStart(2, '0')}${buffer[1].toString(16).padStart(2, '0')}`);

    // 保存发送的数据用于检查
    const postData = {
      clientKey: captcha.clientKey,
      task: {
        type: 'ReCaptchaV2Classification',
        image: `data:image/jpeg;base64,${base64Image}`,
        question: englishQuestion
      }
    };

    const jsonFile = 'C:\\Users\\sxh\\Desktop\\debug-request-data.json';
    fs.writeFileSync(jsonFile, JSON.stringify({
      clientKey: postData.clientKey,
      taskType: postData.task.type,
      question: postData.task.question,
      imageLength: postData.task.image.length,
      imagePrefix: postData.task.image.substring(0, 50)
    }, null, 2));
    console.log(`\n✓ 请求数据已保存: ${jsonFile}`);

    // ========== 第5步: 创建任务 ==========
    console.log('\n【断点6】调用 createTask...');
    console.log('\n按 Enter 继续发送请求...');
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });

    const result = await captcha.createTask(base64Image, englishQuestion);
    console.log('\n【结果】:');
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

// 运行
debugTest().catch(console.error);
