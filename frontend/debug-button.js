const { chromium } = require('playwright');
const fs = require('fs');

async function debugButton() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const htmlPath = 'C:\\Users\\sxh\\Desktop\\test1111.html';
  const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
  await page.setContent(htmlContent);
  
  // 等待重定向
  await page.waitForTimeout(1000);
  
  // 查找所有含有"Got it"的元素
  console.log('=== 查找所有含有"Got it"的元素 ===\n');
  
  const elements = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('*').forEach(el => {
      if (el.textContent.includes('Got it')) {
        results.push({
          tag: el.tagName.toLowerCase(),
          class: el.className,
          id: el.id,
          text: el.textContent.substring(0, 100),
          html: el.outerHTML.substring(0, 300),
          href: el.href || 'N/A',
          onclick: el.onclick ? 'has onclick' : 'no onclick',
          visible: el.offsetParent !== null
        });
      }
    });
    return results;
  });
  
  elements.forEach((el, i) => {
    console.log(`[${i}] Tag: <${el.tag}>, Class: "${el.class}", ID: "${el.id}", Visible: ${el.visible}`);
    console.log(`    Href: ${el.href}`);
    console.log(`    Text: ${el.text.substring(0, 80)}...`);
    console.log(`    HTML: ${el.html}...`);
    console.log();
  });
  
  // 尝试找到最接近的链接/按钮
  console.log('=== 尝试通过Playwright定位器 ===\n');
  
  const selectors = [
    'a:has-text("Got it")',
    'button:has-text("Got it")',
    'text="Got it. Turn on"',
    'text/Got it/',
  ];
  
  for (const selector of selectors) {
    try {
      const count = await page.locator(selector).count();
      console.log(`[${selector}] 找到 ${count} 个元素`);
      
      if (count > 0) {
        const element = page.locator(selector).first();
        const isVisible = await element.isVisible().catch(() => false);
        console.log(`  → 第一个元素可见: ${isVisible}`);
        
        // 尝试获取元素信息
        const info = await element.evaluate(el => ({
          tag: el.tagName,
          href: el.href || 'N/A',
          onclick: el.onclick ? 'yes' : 'no'
        })).catch(() => null);
        
        if (info) {
          console.log(`  → 标签: ${info.tag}, Href: ${info.href}, OnClick: ${info.onclick}`);
        }
      }
    } catch (e) {
      console.log(`[${selector}] 错误: ${e.message.substring(0, 80)}`);
    }
  }
  
  await browser.close();
}

debugButton().catch(console.error);
