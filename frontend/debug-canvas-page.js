/**
 * 调试脚本 - 查看页面结构和元素信息
 */

const { chromium } = require('playwright');
const fs = require('fs');

async function main() {
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox']
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    const htmlPath = 'C:\\Users\\sxh\\Desktop\\test1111.html';
    const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');
    
    console.log(`[打开] ${htmlPath}`);
    await page.goto(fileUrl, { waitUntil: 'load', timeout: 10000 }).catch(() => {});
    
    await page.waitForTimeout(5000);
    
    // 获取页面信息
    const info = await page.evaluate(() => {
      const canvases = document.querySelectorAll('canvas');
      const result = [];
      
      canvases.forEach((canvas, i) => {
        const rect = canvas.getBoundingClientRect();
        const computed = window.getComputedStyle(canvas);
        const isVisible = computed.display !== 'none' && computed.visibility !== 'hidden' && computed.opacity !== '0';
        const isInViewport = rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
        
        result.push({
          index: i,
          width: canvas.width,
          height: canvas.height,
          offsetWidth: canvas.offsetWidth,
          offsetHeight: canvas.offsetHeight,
          clientWidth: canvas.clientWidth,
          clientHeight: canvas.clientHeight,
          display: computed.display,
          visibility: computed.visibility,
          opacity: computed.opacity,
          isVisible,
          isInViewport,
          rect: {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height
          },
          parent: canvas.parentElement ? canvas.parentElement.tagName : 'none',
          parentId: canvas.parentElement ? canvas.parentElement.id : 'none',
          parentClass: canvas.parentElement ? canvas.parentElement.className : 'none'
        });
      });
      
      return result;
    });
    
    console.log('\n========== Canvas 元素信息 ==========');
    console.log(JSON.stringify(info, null, 2));
    
    // 尝试找到所有可能的container
    const containers = await page.evaluate(() => {
      const elements = document.querySelectorAll('[id*="captcha"], [class*="captcha"], [id*="challenge"], iframe');
      return Array.from(elements).map(el => ({
        tag: el.tagName,
        id: el.id,
        className: el.className,
        display: window.getComputedStyle(el).display,
        visibility: window.getComputedStyle(el).visibility,
        rect: el.getBoundingClientRect(),
        src: el.src || 'N/A'
      }));
    });
    
    console.log('\n========== Captcha/Challenge 容器 ==========');
    console.log(JSON.stringify(containers, null, 2));
    
    // 检查iframe
    const iframes = await page.locator('iframe').count();
    console.log(`\n========== 检测到 ${iframes} 个 iframe ==========`);
    
    for (let i = 0; i < iframes; i++) {
      try {
        const iframe = page.locator('iframe').nth(i);
        const box = await iframe.boundingBox();
        const attrs = await iframe.evaluate(el => ({
          id: el.id,
          src: el.src,
          name: el.name,
          title: el.title
        }));
        console.log(`[iframe ${i}] 位置: ${JSON.stringify(box)}`);
        console.log(`[iframe ${i}] 属性: ${JSON.stringify(attrs)}`);
      } catch (e) {
        console.log(`[iframe ${i}] 获取信息失败: ${e.message}`);
      }
    }
    
    // 检查是否有隐藏的 div
    const hidden = await page.evaluate(() => {
      const elements = document.querySelectorAll('[style*="display:none"], [style*="visibility:hidden"], .hidden, [class*="hide"]');
      return Array.from(elements).slice(0, 10).map(el => ({
        tag: el.tagName,
        id: el.id,
        className: el.className,
        text: el.textContent?.substring(0, 50)
      }));
    });
    
    console.log('\n========== 隐藏元素（前10个） ==========');
    console.log(JSON.stringify(hidden, null, 2));
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    // 保持浏览器打开几秒供查看
    await page.waitForTimeout(2000);
    await context.close();
    await browser.close();
  }
}

main().catch(console.error);
