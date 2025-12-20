/**
 * Canvas 验证码工具类 - 使用演示
 */

const { chromium } = require('playwright');
const CaptchaCanvasTool = require('./src/utils/CaptchaCanvasTool');

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
    
    console.log(`[演示] 打开页面: ${htmlPath}\n`);
    await page.goto(fileUrl, { waitUntil: 'load', timeout: 10000 }).catch(() => {
      console.log('[演示] ⚠ 页面加载超时，继续...\n');
    });
    
    // 创建工具类实例
    const tool = new CaptchaCanvasTool(page);
    
    // 1. 等待 canvas 加载
    console.log('========== 步骤1: 等待 Canvas 加载 ==========\n');
    await tool.waitForCanvasLoad(8000);
    
    // 2. 获取验证码提示语
    console.log('\n========== 步骤2: 获取验证码提示语 ==========\n');
    const prompt = await tool.getCaptchaPrompt();
    console.log(`提示语: ${prompt}\n`);
    
    // 3. 获取完整的验证码数据
    console.log('========== 步骤3: 获取完整验证码数据 ==========\n');
    const captchaData = await tool.getCaptchaData();
    
    // 4. 保存到文件
    console.log('\n========== 步骤4: 保存验证码数据到文件 ==========\n');
    const savedFiles = await tool.saveCaptchaData(captchaData);
    
    console.log('\n========== 保存成功 ==========');
    console.log('文件位置:');
    console.log(`  预览页面: ${savedFiles.preview}`);
    console.log(`  PNG图片: ${savedFiles.png}`);
    console.log(`  Base64: ${savedFiles.base64}`);
    console.log(`  元数据: ${savedFiles.metadata}`);
    
    console.log('\n✅ 演示完成！');
    
  } catch (error) {
    console.error('❌ 发生错误:', error.message);
  } finally {
    // 保持浏览器打开3秒，方便查看
    await page.waitForTimeout(3000);
    await context.close();
    await browser.close();
  }
}

main().catch(console.error);
