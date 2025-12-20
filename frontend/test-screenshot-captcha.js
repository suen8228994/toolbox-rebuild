/**
 * Canvas 验证码截图测试脚本
 * 功能：打开 HTML 文件，等待 canvas 出现，截图并转换为 base64 存储
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

/**
 * 截取 Canvas 验证码并返回 base64
 * @param {Page} page - Playwright 页面对象
 * @param {number} maxWaitTime - 最大等待时间（毫秒）
 * @returns {Promise<string>} base64 编码的图片数据
 */
async function captureCanvasCaptchaAsBase64(page, maxWaitTime = 30000) {
  try {
    // Step 1: 等待 canvas 元素出现（获取第一个）
    const canvasLocator = page.locator('canvas[width="324"][height="324"]').first();
    
    // 等待元素在 DOM 中出现（注意：可能在 iframe 中）
    console.log('[截图] 正在等待 canvas 元素...');
    
    // 先等待元素存在
    await page.locator('canvas[width="324"][height="324"]').first().waitFor({ state: 'attached', timeout: maxWaitTime });
    console.log('[截图] ✓ Canvas 元素已在 DOM 中');
    
    // 然后等待它变得可见
    let attempt = 0;
    while (attempt < 10) {
      try {
        await canvasLocator.waitFor({ state: 'visible', timeout: 3000 });
        console.log('[截图] ✓ Canvas 元素已可见');
        break;
      } catch (e) {
        attempt++;
        console.log(`[截图] 等待中... (尝试 ${attempt}/10)`);
        await page.waitForTimeout(1000);
      }
    }
    
    if (attempt >= 10) {
      throw new Error('Canvas 元素无法变为可见');
    }
    
    // Step 2: 等待一段时间确保元素完全加载和渲染
    await page.waitForTimeout(2000);
    console.log('[截图] ✓ 元素已稳定');
    
    // Step 3: 获取 canvas 元素的位置和尺寸
    let boundingBox = await canvasLocator.boundingBox();
    if (!boundingBox) {
      // 可能在 iframe 中，尝试直接在页面上截取
      console.log('[截图] ⚠ Canvas 不在主页面中，可能在 iframe 中，尝试直接截图...');
      try {
        const screenshotBuffer = await canvasLocator.screenshot();
        const base64 = screenshotBuffer.toString('base64');
        console.log(`[截图] ✓ 直接截图成功，已转换为 base64（长度: ${base64.length} 字符）`);
        return base64;
      } catch (iframeError) {
        throw new Error('无法获取 canvas 元素的位置信息: ' + iframeError.message);
      }
    }
    
    console.log(`[截图] Canvas 位置信息:`, {
      x: boundingBox.x,
      y: boundingBox.y,
      width: boundingBox.width,
      height: boundingBox.height
    });
    
    // Step 4: 截取 canvas 区域并转换为 base64
    try {
      const sharp = require('sharp');
      const fullScreenshot = await page.screenshot();
      
      // 从完整截图中裁剪 canvas 区域
      const croppedBuffer = await sharp(fullScreenshot)
        .extract({
          left: Math.round(boundingBox.x),
          top: Math.round(boundingBox.y),
          width: Math.round(boundingBox.width),
          height: Math.round(boundingBox.height)
        })
        .png()
        .toBuffer();
      
      // 转换为 base64
      const base64 = croppedBuffer.toString('base64');
      console.log(`[截图] ✓ Canvas 已转换为 base64（长度: ${base64.length} 字符）`);
      return base64;
    } catch (sharpError) {
      // 如果没有 sharp，使用 Playwright 的元素截图功能
      console.log('[截图] 未安装 sharp，使用 Playwright 元素截图...');
      
      const screenshotBuffer = await canvasLocator.screenshot();
      const base64 = screenshotBuffer.toString('base64');
      console.log(`[截图] ✓ Canvas 已转换为 base64（长度: ${base64.length} 字符）`);
      return base64;
    }
  } catch (error) {
    console.error(`[截图] ✗ 截图失败: ${error.message}`);
    throw error;
  }
}

/**
 * 截取 Canvas 验证码及周围上下文并返回 base64
 * @param {Page} page - Playwright 页面对象
 * @param {number} padding - 周围填充距离（像素）
 * @param {number} maxWaitTime - 最大等待时间（毫秒）
 * @returns {Promise<string>} base64 编码的图片数据
 */
async function captureCanvasCaptchaWithContextAsBase64(page, padding = 50, maxWaitTime = 30000) {
  try {
    console.log('[截图] 开始等待整个验证码区域...');
    
    // 等待 canvas 元素（获取第一个）
    const canvasLocator = page.locator('canvas[width="324"][height="324"]').first();
    
    // 先等待元素存在
    console.log('[截图] 正在等待 canvas 元素...');
    await page.locator('canvas[width="324"][height="324"]').first().waitFor({ state: 'attached', timeout: maxWaitTime });
    console.log('[截图] ✓ Canvas 元素已在 DOM 中');
    
    // 然后等待它变得可见
    let attempt = 0;
    while (attempt < 10) {
      try {
        await canvasLocator.waitFor({ state: 'visible', timeout: 3000 });
        console.log('[截图] ✓ Canvas 元素已可见');
        break;
      } catch (e) {
        attempt++;
        console.log(`[截图] 等待中... (尝试 ${attempt}/10)`);
        await page.waitForTimeout(1000);
      }
    }
    
    if (attempt >= 10) {
      throw new Error('Canvas 元素无法变为可见');
    }
    
    // 等待确认按钮出现（表示整个区域已加载）
    const confirmButton = page.locator('button:has-text("Confirm")');
    try {
      await confirmButton.waitFor({ state: 'visible', timeout: 5000 });
      console.log('[截图] ✓ 确认按钮已出现');
    } catch {
      console.log('[截图] ⚠ 确认按钮未出现，但继续截图');
    }
    
    // 等待元素稳定
    await page.waitForTimeout(2000);
    
    // 获取 canvas 及其容器的位置
    const canvasBox = await canvasLocator.boundingBox();
    if (!canvasBox) {
      throw new Error('无法获取 canvas 元素的位置信息');
    }
    
    // 获取整个验证码容器的位置（通常在 #captcha-container 或类似元素中）
    let containerBox = canvasBox;
    try {
      const container = page.locator('#captcha-container, [role="dialog"]').first();
      const containerBoundingBox = await container.boundingBox();
      if (containerBoundingBox) {
        containerBox = containerBoundingBox;
        console.log('[截图] 检测到验证码容器元素');
      }
    } catch (e) {
      console.log('[截图] 未检测到特定容器，仅使用 canvas 位置');
    }
    
    // 计算扩展区域（包含 padding）
    const extendedBox = {
      x: Math.max(0, containerBox.x - padding),
      y: Math.max(0, containerBox.y - padding),
      width: containerBox.width + padding * 2,
      height: containerBox.height + padding * 2
    };
    
    console.log(`[截图] 截图区域:`, extendedBox);
    
    // 截图并转换为 base64
    try {
      const sharp = require('sharp');
      const fullScreenshot = await page.screenshot();
      
      const croppedBuffer = await sharp(fullScreenshot)
        .extract({
          left: Math.round(extendedBox.x),
          top: Math.round(extendedBox.y),
          width: Math.round(extendedBox.width),
          height: Math.round(extendedBox.height)
        })
        .png()
        .toBuffer();
      
      const base64 = croppedBuffer.toString('base64');
      console.log(`[截图] ✓ 验证码区域已转换为 base64（长度: ${base64.length} 字符）`);
      return base64;
    } catch (sharpError) {
      console.log('[截图] 未安装 sharp，使用 Playwright 元素截图...');
      const screenshotBuffer = await canvasLocator.screenshot();
      const base64 = screenshotBuffer.toString('base64');
      console.log(`[截图] ✓ Canvas 已转换为 base64（长度: ${base64.length} 字符）`);
      return base64;
    }
  } catch (error) {
    console.error(`[截图] ✗ 截图失败: ${error.message}`);
    throw error;
  }
}

/**
 * 主测试函数
 */
async function main() {
  const browser = await chromium.launch({ 
    headless: false, // 显示浏览器窗口以便调试
    args: ['--no-sandbox']
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // 打开 HTML 文件
    const htmlPath = 'C:\\Users\\sxh\\Desktop\\test1111.html';
    const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');
    
    console.log(`[测试] 打开页面: ${htmlPath}`);
    console.log(`[测试] 文件 URL: ${fileUrl}`);
    await page.goto(fileUrl, { waitUntil: 'load', timeout: 10000 }).catch(() => {
      console.log('[测试] ⚠ 页面加载超时，继续...');
    });
    
    // 等待一段时间让页面完全加载
    await page.waitForTimeout(3000);
    
    // 方法1: 仅截取 canvas 区域 -> base64
    console.log('\n========== 方法1: 仅截取 Canvas 区域 -> Base64 ==========');
    let base64Canvas;
    try {
      base64Canvas = await captureCanvasCaptchaAsBase64(page, 30000);
      
      // 保存到桌面文件
      const outputFile1 = 'C:\\Users\\sxh\\Desktop\\captcha-canvas-base64.txt';
      fs.writeFileSync(outputFile1, base64Canvas, 'utf8');
      console.log(`[保存] ✓ Base64 已保存到: ${outputFile1}`);
      console.log(`[保存] 文件大小: ${(base64Canvas.length / 1024).toFixed(2)} KB`);
    } catch (error) {
      console.error(`[方法1] 失败: ${error.message}`);
    }
    
    // 方法2: 截取 canvas + 上下文 -> base64
    console.log('\n========== 方法2: 截取 Canvas + 上下文 -> Base64 ==========');
    let base64WithContext;
    try {
      base64WithContext = await captureCanvasCaptchaWithContextAsBase64(page, 50, 30000);
      
      // 保存到桌面文件
      const outputFile2 = 'C:\\Users\\sxh\\Desktop\\captcha-with-context-base64.txt';
      fs.writeFileSync(outputFile2, base64WithContext, 'utf8');
      console.log(`[保存] ✓ Base64 已保存到: ${outputFile2}`);
      console.log(`[保存] 文件大小: ${(base64WithContext.length / 1024).toFixed(2)} KB`);
    } catch (error) {
      console.error(`[方法2] 失败: ${error.message}`);
    }
    
    // 生成一个测试 HTML 页面来查看图片
    console.log('\n========== 生成预览 HTML ==========');
    if (base64Canvas || base64WithContext) {
      const htmlPreview = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Captcha 截图预览</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .section { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h2 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
        img { max-width: 100%; height: auto; border: 2px solid #ddd; border-radius: 4px; margin: 10px 0; }
        .info { color: #666; font-size: 12px; margin-top: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🖼️ Captcha 截图预览</h1>
        
        ${base64Canvas ? `
        <div class="section">
            <h2>方法1: 仅 Canvas 区域</h2>
            <img src="data:image/png;base64,${base64Canvas}" alt="Canvas Only">
            <div class="info">Canvas 仅截图区域 (324x324)</div>
        </div>
        ` : ''}
        
        ${base64WithContext ? `
        <div class="section">
            <h2>方法2: Canvas + 上下文</h2>
            <img src="data:image/png;base64,${base64WithContext}" alt="Canvas with Context">
            <div class="info">包含题目和确认按钮的完整区域</div>
        </div>
        ` : ''}
    </div>
</body>
</html>`;
      
      const previewFile = 'C:\\Users\\sxh\\Desktop\\captcha-preview.html';
      fs.writeFileSync(previewFile, htmlPreview, 'utf8');
      console.log(`[预览] ✓ 预览 HTML 已生成: ${previewFile}`);
    }
    
    console.log('\n✅ 测试完成！');
    
  } catch (error) {
    console.error('❌ 发生错误:', error);
  } finally {
    await context.close();
    await browser.close();
  }
}

// 运行测试
main().catch(console.error);

// 导出函数供其他模块使用
module.exports = {
  captureCanvasCaptchaAsBase64,
  captureCanvasCaptchaWithContextAsBase64
};
