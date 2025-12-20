/**
 * Canvas 验证码工具类
 * 功能：截取 canvas 验证码、获取提示语、分析验证码数据
 */

const fs = require('fs');
const path = require('path');

class CaptchaCanvasTool {
  constructor(page) {
    this.page = page;
  }

  /**
   * 等待 canvas 元素加载和渲染
   * @param {number} waitTime - 等待时间（毫秒）
   * @returns {Promise<number>} 检测到的 canvas 数量
   */
  async waitForCanvasLoad(waitTime = 8000) {
    console.log('[工具] 等待 canvas 加载...');
    await this.page.waitForTimeout(waitTime);
    
    const canvasCount = await this.page.locator('canvas').count();
    console.log(`[工具] ✓ 检测到 ${canvasCount} 个 canvas 元素`);
    return canvasCount;
  }

  /**
   * 获取所有 canvas 的信息
   * @returns {Promise<Array>} canvas 信息数组
   */
  async getCanvasInfo() {
    const info = await this.page.evaluate(() => {
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
          }
        });
      });
      
      return result;
    });
    
    return info;
  }

  /**
   * 获取验证码提示语
   * @returns {Promise<string>} 提示语文本
   */
  async getCaptchaPrompt() {
    try {
      console.log('[工具] 获取验证码提示语...');
      
      // 方法1: 查找标题元素
      const headerLocator = this.page.locator('#aacb-captcha-header');
      if (await headerLocator.count() > 0) {
        const header = await headerLocator.textContent();
        if (header) {
          console.log(`[工具] ✓ 从标题获取: ${header.trim()}`);
          return header.trim();
        }
      }
      
      // 方法2: 查找 captcha-container 内部的文本
      const containerLocator = this.page.locator('#captcha-container');
      if (await containerLocator.count() > 0) {
        const containerText = await containerLocator.textContent();
        if (containerText) {
          // 提取第一行（通常是提示语）
          const lines = containerText.trim().split('\n');
          const prompt = lines[0]?.trim();
          if (prompt && prompt.length > 0 && prompt.length < 200) {
            console.log(`[工具] ✓ 从容器获取: ${prompt}`);
            return prompt;
          }
        }
      }
      
      // 方法3: 查找所有可能的提示文本
      const prompts = await this.page.evaluate(() => {
        const allText = [];
        
        // 查找包含"Choose"、"Select"等关键词的元素
        const elements = document.querySelectorAll('h1, h2, h3, .prompt, [class*="prompt"], [id*="prompt"], span, p, div');
        elements.forEach(el => {
          const text = el.textContent?.trim();
          if (text && 
              (text.includes('Choose') || text.includes('Select') || text.includes('Solve') || text.includes('Find')) &&
              text.length < 200 &&
              text.length > 5) {
            allText.push(text);
          }
        });
        
        return allText;
      });
      
      if (prompts.length > 0) {
        const prompt = prompts[0];
        console.log(`[工具] ✓ 从页面文本获取: ${prompt}`);
        return prompt;
      }
      
      console.log('[工具] ⚠ 未找到提示语');
      return null;
    } catch (error) {
      console.error(`[工具] ✗ 获取提示语失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取可见的 canvas 并返回其信息和截图（base64）
   * 这是方法1：仅截取 canvas 区域
   * @returns {Promise<Object>} canvas 信息和 base64 数据
   */
  async getCaptchaCanvasScreenshot() {
    try {
      console.log('[工具] [方法1] 开始获取 canvas 截图...');
      
      const info = await this.getCanvasInfo();
      const visibleCanvas = info.find(c => c.isInViewport && c.isVisible);
      
      if (!visibleCanvas) {
        throw new Error('未找到可见的 canvas 元素');
      }
      
      console.log(`[工具] [方法1] ✓ 找到可见的 canvas（索引: ${visibleCanvas.index}）`);
      
      // 获取对应的 canvas 元素
      const canvasLocator = this.page.locator('canvas').nth(visibleCanvas.index);
      const screenshot = await canvasLocator.screenshot();
      const base64 = screenshot.toString('base64');
      
      console.log(`[工具] [方法1] ✓ 截图成功（大小: ${(base64.length / 1024).toFixed(2)} KB）`);
      
      return {
        index: visibleCanvas.index,
        width: visibleCanvas.width,
        height: visibleCanvas.height,
        position: {
          top: visibleCanvas.rect.top,
          left: visibleCanvas.rect.left,
          width: visibleCanvas.rect.width,
          height: visibleCanvas.rect.height
        },
        base64: base64,
        buffer: screenshot
      };
    } catch (error) {
      console.error(`[工具] [方法1] ✗ 获取 canvas 截图失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取完整的验证码数据（包含截图、提示语等）
   * @returns {Promise<Object>} 完整的验证码数据
   */
  async getCaptchaData() {
    try {
      console.log('[工具] ========== 开始收集验证码数据 ==========');
      
      // 获取提示语
      const prompt = await this.getCaptchaPrompt();
      
      // 获取 canvas 截图
      const screenshot = await this.getCaptchaCanvasScreenshot();
      
      const data = {
        prompt: prompt,
        canvas: {
          index: screenshot.index,
          width: screenshot.width,
          height: screenshot.height,
          position: screenshot.position
        },
        image: {
          base64: screenshot.base64,
          sizeKB: (screenshot.base64.length / 1024).toFixed(2)
        },
        timestamp: new Date().toISOString()
      };
      
      console.log('[工具] ✓ 验证码数据收集完成');
      console.log(JSON.stringify({
        prompt: data.prompt,
        canvas: data.canvas,
        imageSizeKB: data.image.sizeKB,
        timestamp: data.timestamp
      }, null, 2));
      
      return data;
    } catch (error) {
      console.error(`[工具] ✗ 收集验证码数据失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 保存验证码数据到文件
   * @param {Object} data - 验证码数据
   * @param {string} outputDir - 输出目录（默认桌面）
   * @returns {Promise<Object>} 保存的文件信息
   */
  async saveCaptchaData(data, outputDir = 'C:\\Users\\sxh\\Desktop') {
    try {
      console.log('[工具] 保存验证码数据...');
      
      const timestamp = new Date().getTime();
      const baseFilename = path.join(outputDir, `captcha-${timestamp}`);
      
      const files = {};
      
      // 1. 保存 base64 文本
      const base64File = `${baseFilename}-base64.txt`;
      fs.writeFileSync(base64File, data.image.base64, 'utf8');
      files.base64 = base64File;
      console.log(`[工具] ✓ Base64 已保存: ${base64File}`);
      
      // 2. 保存 PNG 图片
      const pngFile = `${baseFilename}.png`;
      fs.writeFileSync(pngFile, data.image.buffer || Buffer.from(data.image.base64, 'base64'));
      files.png = pngFile;
      console.log(`[工具] ✓ PNG 已保存: ${pngFile}`);
      
      // 3. 保存元数据（JSON）
      const metadata = {
        prompt: data.prompt,
        canvas: data.canvas,
        imageSizeKB: data.image.sizeKB,
        timestamp: data.timestamp
      };
      const jsonFile = `${baseFilename}-metadata.json`;
      fs.writeFileSync(jsonFile, JSON.stringify(metadata, null, 2), 'utf8');
      files.metadata = jsonFile;
      console.log(`[工具] ✓ 元数据已保存: ${jsonFile}`);
      
      // 4. 生成预览 HTML
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>验证码预览</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; }
        .section { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
        h2 { color: #666; font-size: 16px; }
        .prompt { background: #f9f9f9; padding: 15px; border-left: 4px solid #007bff; margin: 10px 0; font-size: 18px; font-weight: bold; }
        img { max-width: 100%; height: auto; border: 2px solid #ddd; border-radius: 4px; margin: 10px 0; }
        .metadata { background: #f9f9f9; padding: 10px; border-radius: 4px; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🖼️ 验证码预览</h1>
        
        <div class="section">
            <h2>提示语</h2>
            <div class="prompt">${data.prompt || '（未获取到提示语）'}</div>
        </div>
        
        <div class="section">
            <h2>验证码图片</h2>
            <img src="data:image/png;base64,${data.image.base64}" alt="Captcha Canvas">
        </div>
        
        <div class="section">
            <h2>信息</h2>
            <div class="metadata">
                <p><strong>Canvas 尺寸:</strong> ${data.canvas.width} × ${data.canvas.height}</p>
                <p><strong>图片大小:</strong> ${data.image.sizeKB} KB</p>
                <p><strong>时间:</strong> ${data.timestamp}</p>
            </div>
        </div>
    </div>
</body>
</html>`;
      
      const htmlFile = `${baseFilename}-preview.html`;
      fs.writeFileSync(htmlFile, htmlContent, 'utf8');
      files.preview = htmlFile;
      console.log(`[工具] ✓ 预览页面已保存: ${htmlFile}`);
      
      console.log('[工具] ✓ 所有文件保存完成');
      return files;
    } catch (error) {
      console.error(`[工具] ✗ 保存文件失败: ${error.message}`);
      throw error;
    }
  }
}

module.exports = CaptchaCanvasTool;
