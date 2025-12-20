/**
 * Canvas 验证码截图工具
 * 功能：等待 canvas 元素异步出现，然后截取指定区域
 * 
 * 使用场景：Amazon 人机验证的 canvas 验证码需要截图用于分析或调试
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

/**
 * 等待并截取 Canvas 验证码区域
 * @param {Page} page - Playwright 页面对象
 * @param {string} outputPath - 输出截图路径
 * @param {number} maxWaitTime - 最大等待时间（毫秒）
 * @returns {Promise<boolean>} 截图是否成功
 */
async function captureCanvasCaptcha(page, outputPath = 'captcha-canvas.png', maxWaitTime = 30000) {
  try {
    console.log('[截图] 开始等待 canvas 验证码元素...');
    
    // Step 1: 等待 canvas 元素出现
    const canvasLocator = page.locator('canvas[width="324"][height="324"]').first();
    
    // 等待元素在 DOM 中可见且稳定
    await canvasLocator.waitFor({ state: 'visible', timeout: maxWaitTime });
    console.log('[截图] ✓ Canvas 元素已出现');
    
    // Step 2: 等待一段时间确保元素完全加载和渲染
    await page.waitForTimeout(1000);
    console.log('[截图] ✓ 元素已稳定');
    
    // Step 3: 获取 canvas 元素的位置和尺寸
    const boundingBox = await canvasLocator.boundingBox();
    if (!boundingBox) {
      throw new Error('无法获取 canvas 元素的位置信息');
    }
    
    console.log(`[截图] Canvas 位置信息:`, {
      x: boundingBox.x,
      y: boundingBox.y,
      width: boundingBox.width,
      height: boundingBox.height
    });
    
    // Step 4: 截取整个页面，然后裁剪 canvas 区域
    const fullScreenshot = await page.screenshot();
    
    // 使用 sharp 库来进行图像裁剪（如果可用）
    // 如果没有 sharp，则截取包含该元素的区域
    try {
      const sharp = require('sharp');
      
      // 从完整截图中裁剪 canvas 区域
      await sharp(fullScreenshot)
        .extract({
          left: Math.round(boundingBox.x),
          top: Math.round(boundingBox.y),
          width: Math.round(boundingBox.width),
          height: Math.round(boundingBox.height)
        })
        .toFile(outputPath);
      
      console.log(`[截图] ✓ 已将 canvas 区域截图保存到: ${outputPath}`);
      return true;
    } catch (sharpError) {
      // 如果没有 sharp，使用 Playwright 的元素截图功能
      console.log('[截图] 未安装 sharp，使用 Playwright 元素截图...');
      
      await canvasLocator.screenshot({ path: outputPath });
      console.log(`[截图] ✓ 已将 canvas 区域截图保存到: ${outputPath}`);
      return true;
    }
  } catch (error) {
    console.error(`[截图] ✗ 截图失败: ${error.message}`);
    return false;
  }
}

/**
 * 等待并截取 Canvas 及其周围区域（包括题目和按钮）
 * @param {Page} page - Playwright 页面对象
 * @param {string} outputPath - 输出截图路径
 * @param {number} padding - 周围填充距离（像素）
 * @returns {Promise<boolean>} 截图是否成功
 */
async function captureCanvasCaptchaWithContext(page, outputPath = 'captcha-full.png', padding = 50, maxWaitTime = 30000) {
  try {
    console.log('[截图] 开始等待整个验证码区域...');
    
    // 等待 canvas 元素
    const canvasLocator = page.locator('canvas[width="324"][height="324"]').first();
    await canvasLocator.waitFor({ state: 'visible', timeout: maxWaitTime });
    console.log('[截图] ✓ Canvas 元素已出现');
    
    // 等待确认按钮出现（表示整个区域已加载）
    const confirmButton = page.locator('button:has-text("Confirm")');
    try {
      await confirmButton.waitFor({ state: 'visible', timeout: 5000 });
      console.log('[截图] ✓ 确认按钮已出现');
    } catch {
      console.log('[截图] ⚠ 确认按钮未出现，但继续截图');
    }
    
    // 等待元素稳定
    await page.waitForTimeout(1500);
    
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
    
    // 截图
    try {
      const sharp = require('sharp');
      const fullScreenshot = await page.screenshot();
      
      await sharp(fullScreenshot)
        .extract({
          left: Math.round(extendedBox.x),
          top: Math.round(extendedBox.y),
          width: Math.round(extendedBox.width),
          height: Math.round(extendedBox.height)
        })
        .toFile(outputPath);
      
      console.log(`[截图] ✓ 已将验证码区域（含上下文）截图保存到: ${outputPath}`);
      return true;
    } catch (sharpError) {
      console.log('[截图] 未安装 sharp，使用 Playwright 元素截图...');
      await canvasLocator.screenshot({ path: outputPath });
      console.log(`[截图] ✓ 已将 canvas 截图保存到: ${outputPath}`);
      return true;
    }
  } catch (error) {
    console.error(`[截图] ✗ 截图失败: ${error.message}`);
    return false;
  }
}

/**
 * 主函数 - 演示使用
 */
async function main() {
  const browser = await chromium.launch({ 
    headless: false, // 显示浏览器窗口以便调试
    args: ['--no-sandbox']
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // 导航到测试页面（使用你上传的 HTML 文件）
    const htmlPath = 'file://' + path.resolve(__dirname, '../../../Desktop/test1111.html');
    console.log(`[测试] 打开页面: ${htmlPath}`);
    await page.goto(htmlPath, { waitUntil: 'networkidle' });
    
    // 等待一段时间让页面完全加载
    await page.waitForTimeout(3000);
    
    // 方法1: 仅截取 canvas 区域
    console.log('\n========== 方法1: 仅截取 Canvas 区域 ==========');
    const success1 = await captureCanvasCaptcha(
      page,
      './captcha-canvas-only.png',
      30000
    );
    
    // 方法2: 截取 canvas 及周围上下文
    console.log('\n========== 方法2: 截取 Canvas + 上下文 ==========');
    const success2 = await captureCanvasCaptchaWithContext(
      page,
      './captcha-with-context.png',
      50,
      30000
    );
    
    if (success1 || success2) {
      console.log('\n✓ 截图完成！');
    } else {
      console.log('\n✗ 截图失败！');
    }
    
  } catch (error) {
    console.error('发生错误:', error);
  } finally {
    await context.close();
    await browser.close();
  }
}

/**
 * 截取 Canvas 验证码并返回 base64
 * @param {Page} page - Playwright 页面对象
 * @param {number} maxWaitTime - 最大等待时间（毫秒）
 * @returns {Promise<string>} base64 编码的图片数据
 */
async function captureCanvasCaptchaAsBase64(page, maxWaitTime = 30000) {
  try {
    console.log('[截图] 开始等待 canvas 验证码元素...');
    
    const canvasLocator = page.locator('canvas[width="324"][height="324"]');
    await canvasLocator.waitFor({ state: 'visible', timeout: maxWaitTime });
    console.log('[截图] ✓ Canvas 元素已出现');
    
    await page.waitForTimeout(1000);
    console.log('[截图] ✓ 元素已稳定');
    
    const boundingBox = await canvasLocator.boundingBox();
    if (!boundingBox) {
      throw new Error('无法获取 canvas 元素的位置信息');
    }
    
    console.log(`[截图] Canvas 位置信息:`, {
      x: boundingBox.x,
      y: boundingBox.y,
      width: boundingBox.width,
      height: boundingBox.height
    });
    
    try {
      const sharp = require('sharp');
      const fullScreenshot = await page.screenshot();
      
      const croppedBuffer = await sharp(fullScreenshot)
        .extract({
          left: Math.round(boundingBox.x),
          top: Math.round(boundingBox.y),
          width: Math.round(boundingBox.width),
          height: Math.round(boundingBox.height)
        })
        .png()
        .toBuffer();
      
      const base64 = croppedBuffer.toString('base64');
      console.log(`[截图] ✓ Canvas 已转换为 base64（长度: ${base64.length} 字符）`);
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
 * 截取 Canvas 验证码及周围上下文并返回 base64
 * @param {Page} page - Playwright 页面对象
 * @param {number} padding - 周围填充距离（像素）
 * @param {number} maxWaitTime - 最大等待时间（毫秒）
 * @returns {Promise<string>} base64 编码的图片数据
 */
async function captureCanvasCaptchaWithContextAsBase64(page, padding = 50, maxWaitTime = 30000) {
  try {
    console.log('[截图] 开始等待整个验证码区域...');
    
    const canvasLocator = page.locator('canvas[width="324"][height="324"]');
    await canvasLocator.waitFor({ state: 'visible', timeout: maxWaitTime });
    console.log('[截图] ✓ Canvas 元素已出现');
    
    const confirmButton = page.locator('button:has-text("Confirm")');
    try {
      await confirmButton.waitFor({ state: 'visible', timeout: 5000 });
      console.log('[截图] ✓ 确认按钮已出现');
    } catch {
      console.log('[截图] ⚠ 确认按钮未出现，但继续截图');
    }
    
    await page.waitForTimeout(1500);
    
    const canvasBox = await canvasLocator.boundingBox();
    if (!canvasBox) {
      throw new Error('无法获取 canvas 元素的位置信息');
    }
    
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
    
    const extendedBox = {
      x: Math.max(0, containerBox.x - padding),
      y: Math.max(0, containerBox.y - padding),
      width: containerBox.width + padding * 2,
      height: containerBox.height + padding * 2
    };
    
    console.log(`[截图] 截图区域:`, extendedBox);
    
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

// 仅在直接运行此文件时执行
if (require.main === module) {
  main().catch(console.error);
}

// 导出函数供其他模块使用
module.exports = {
  captureCanvasCaptcha,
  captureCanvasCaptchaWithContext,
  captureCanvasCaptchaAsBase64,
  captureCanvasCaptchaWithContextAsBase64
};
