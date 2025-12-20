/**
 * 简化版截图脚本 - 直接对 canvas 元素截图
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function main() {
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox']
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // 打开 HTML 文件
    const htmlPath = 'C:\\Users\\sxh\\Desktop\\test1111.html';
    const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');
    
    console.log(`[打开] 文件: ${htmlPath}`);
    await page.goto(fileUrl, { waitUntil: 'load', timeout: 10000 }).catch(() => {
      console.log('[打开] ⚠ 页面加载超时，继续...');
    });
    
    // 等待很长时间让 JavaScript 初始化
    console.log('[等待] 等待 canvas 加载...');
    await page.waitForTimeout(8000);
    
    // 尝试查看是否有 canvas
    const canvasCount = await page.locator('canvas').count();
    console.log(`[检测] 页面上有 ${canvasCount} 个 canvas 元素`);
    
    // 查找可见的 canvas
    for (let i = 0; i < canvasCount; i++) {
      try {
        const canvasLocator = page.locator('canvas').nth(i);
        const info = await canvasLocator.evaluate(el => {
          const rect = el.getBoundingClientRect();
          const computed = window.getComputedStyle(el);
          return {
            width: el.width,
            height: el.height,
            clientWidth: el.clientWidth,
            clientHeight: el.clientHeight,
            offsetWidth: el.offsetWidth,
            offsetHeight: el.offsetHeight,
            display: computed.display,
            visibility: computed.visibility,
            opacity: computed.opacity,
            isInViewport: rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth,
            rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
          };
        });
        
        console.log(`[Canvas ${i}] 信息: ${JSON.stringify(info)}`);
        
        // 如果这是可见的 canvas，进行截图
        if (info.isInViewport && info.offsetWidth > 0 && info.offsetHeight > 0) {
          console.log(`[Canvas ${i}] 发现可见的 canvas，进行截图...`);
          const screenshot = await canvasLocator.screenshot();
          const base64 = screenshot.toString('base64');
          
          // 保存 base64
          const filename = `C:\\Users\\sxh\\Desktop\\canvas-${i}-base64.txt`;
          fs.writeFileSync(filename, base64, 'utf8');
          console.log(`[Canvas ${i}] ✓ Base64 已保存到: ${filename}`);
          console.log(`[Canvas ${i}] Base64 长度: ${(base64.length / 1024).toFixed(2)} KB`);
          
          // 保存 PNG
          const imgFilename = `C:\\Users\\sxh\\Desktop\\canvas-${i}.png`;
          fs.writeFileSync(imgFilename, screenshot);
          console.log(`[Canvas ${i}] ✓ PNG 已保存到: ${imgFilename}`);
          
          // 生成预览 HTML
          const htmlPreview = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Canvas 验证码截图</title>
    <style>
        body { font-family: Arial; margin: 20px; background: #f0f0f0; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #333; }
        img { max-width: 100%; border: 2px solid #ddd; border-radius: 4px; margin: 10px 0; }
        .info { color: #666; font-size: 14px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>✓ Canvas 验证码截图</h1>
        <img src="data:image/png;base64,${base64}" alt="验证码">
        <div class="info">
            <p><strong>分辨率:</strong> ${info.width} x ${info.height}</p>
            <p><strong>位置:</strong> Top: ${info.rect.top.toFixed(0)}px, Left: ${info.rect.left.toFixed(0)}px</p>
            <p><strong>Base64 大小:</strong> ${(base64.length / 1024).toFixed(2)} KB</p>
            <p><strong>PNG 文件:</strong> canvas-${i}.png</p>
            <p><strong>Base64 文件:</strong> canvas-${i}-base64.txt</p>
        </div>
    </div>
</body>
</html>`;
          
          const previewFile = `C:\\Users\\sxh\\Desktop\\canvas-${i}-preview.html`;
          fs.writeFileSync(previewFile, htmlPreview, 'utf8');
          console.log(`[Canvas ${i}] ✓ 预览HTML已保存: ${previewFile}`);
          
          break; // 只截取第一个可见的 canvas
        }
      } catch (err) {
        console.log(`[Canvas ${i}] 失败: ${err.message}`);
      }
    }
    
    // 如果没有检测到 canvas，尝试用全页面截图
    if (canvasCount === 0) {
      console.log('[全页] 未检测到 canvas，进行全页面截图...');
      const fullScreenshot = await page.screenshot({ fullPage: true });
      const base64 = fullScreenshot.toString('base64');
      
      const filename = 'C:\\Users\\sxh\\Desktop\\full-page-base64.txt';
      fs.writeFileSync(filename, base64, 'utf8');
      console.log(`[全页] ✓ 全页截图已保存`);
    }
    
    console.log('\n✅ 脚本完成！');
    
  } catch (error) {
    console.error('❌ 发生错误:', error.message);
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch(console.error);
