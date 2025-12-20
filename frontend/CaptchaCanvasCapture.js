/**
 * Captcha Canvas 工具类
 * 集成截图、提示语提取、yescaptcha验证等功能
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 翻译库
let translate;
try {
  translate = require('@iamtraction/google-translate');
} catch (e) {
  console.warn('[工具类] 未安装翻译库，部分功能可能受限');
  translate = null;
}

class CaptchaCanvasCapture {
  constructor(config = {}) {
    this.clientKey = config.clientKey || process.env.YESCAPTCHA_CLIENT_KEY || '0336ef0e8b28817fc0a209170829f1c43cefee7481336';
    this.yescaptchaBaseUrl = 'https://api.yescaptcha.com';
    this.solveCount = 0;
    this.maxRetry = 10;
  }

  /**
   * 从页面获取验证码提示语文本
   * @param {Page} page - Playwright 页面对象
   * @returns {Promise<string>} 提示语文本
   */
  async getPromptText(page) {
    try {
      console.log('[提示语] 正在提取验证码提示语...');

      let promptText = '';

      // 优先级1: 在 captcha 容器内查找包含 <em> 标签的完整提示文案
      try {
        // 查找特定的提示文案容器（通常在 captcha 区域内）
        const fullPromptText = await page.locator('body div:has(em)').evaluate(els => {
          // 遍历所有包含 em 的 div，找到最合适的（通常是字数最短的包含 "Choose"/"Pick" 等的）
          for (const el of els) {
            const text = el.textContent?.trim() || '';
            // 过滤掉 JSON 和其他非提示语内容
            if (text && text.length < 200 && !text.includes('{') && (text.includes('Choose') || text.includes('Pick') || text.includes('Select'))) {
              return text;
            }
          }
          // 如果没找到特殊关键字，返回最短的包含 em 的 div 内容
          if (els.length > 0) {
            return els[0].textContent?.trim() || '';
          }
          return '';
        });

        if (fullPromptText && fullPromptText.length > 0 && !fullPromptText.includes('{')) {
          promptText = fullPromptText;
          console.log(`[提示语] ✓ 从 div:has(em) 找到完整提示语: "${promptText}"`);
        }
      } catch (e) {
        console.log(`[提示语] div:has(em) 查询失败: ${e.message}`);
      }

      // 如果上面没找到，降级方案：只提取 <em> 标签的内容，然后尝试从其父元素获取完整文本
      if (!promptText) {
        try {
          const emElement = page.locator('em').first();
          const parentText = await emElement.evaluate(el => {
            // 获取 em 元素的父 div 内容（如果有的话）
            if (el.parentElement && el.parentElement.textContent) {
              return el.parentElement.textContent.trim();
            }
            return el.textContent?.trim() || '';
          });

          if (parentText && parentText.length > 0) {
            // 验证是否是有效的提示语（不是 JSON 或其他垃圾内容）
            if (!parentText.includes('{')) {
              promptText = parentText;
              console.log(`[提示语] ✓ 从 em 的父元素找到: "${promptText}"`);
            } else {
              // 如果父元素是垃圾，就直接用 em 的内容
              const emText = await emElement.evaluate(el => el.textContent?.trim() || '');
              if (emText && emText.length > 0) {
                promptText = emText;
                console.log(`[提示语] ✓ 从 <em> 标签找到: "${promptText}"`);
              }
            }
          }
        } catch (e2) {
          console.log(`[提示语] <em> 标签查询也失败: ${e2.message}`);
        }
      }

      // 如果还没找到，尝试其他选择器
      if (!promptText) {
        const selectors = [
          'h1#aacb-captcha-header',          // Amazon 验证码标题
          'h1',                               // 通用h1
          '[role="heading"]',                 // 可访问性标题
          '.captcha-title',
          '.captcha-header',
          '.challenge-title',
          'p:has-text("Choose")',
          'p:has-text("Select")',
          'p:has-text("Solve")',
          'div:has-text("Choose")',
          'div:has-text("Select")'
        ];

        for (const selector of selectors) {
          try {
            const element = page.locator(selector).first();
            const count = await element.count();
            
            if (count > 0) {
              const text = await element.textContent();
              if (text && text.trim().length > 0) {
                promptText = text.trim();
                console.log(`[提示语] ✓ 通过 "${selector}" 找到提示语`);
                break;
              }
            }
          } catch (e) {
            // 继续尝试下一个选择器
          }
        }
      }

      // 如果还是没找到，尝试从页面内容中查找
      if (!promptText) {
        const pageContent = await page.content();
        // 查找包含 "Choose" 或 "Select" 的文本
        const match = pageContent.match(/(?:Choose|Select|Solve|Pick)[^<]*(?:all|the|images?)[^<]*/i);
        if (match) {
          promptText = match[0].trim();
          console.log('[提示语] ✓ 从页面内容中提取提示语');
        }
      }

      if (!promptText) {
        console.warn('[提示语] ⚠ 未找到提示语，使用默认值');
        promptText = 'curtains';
      }

      console.log(`[提示语] 最终提示语: "${promptText}"`);
      return promptText;
    } catch (error) {
      console.error(`[提示语] ✗ 获取提示语失败: ${error.message}`);
      return 'curtains';
    }
  }

  /**
   * 将文本翻译为英文
   * @param {string} text 原始文本（可能是外语或英文）
   * @returns {Promise<string>} 英文翻译，格式为 "Pick the XXX"
   */
  async translateToEnglish(text) {
    if (!text || typeof text !== 'string') return 'Pick the object';

    try {
      console.log(`[翻译] 正在翻译: "${text}"`);
      
      let englishText = text.trim();
      
      // 如果有翻译库，使用翻译
      if (translate) {
        try {
          const res = await translate(englishText, { to: 'en' });
          englishText = res.text?.trim() || text;
          console.log(`[翻译] ✓ 翻译成功: "${englishText}"`);
        } catch (err) {
          console.warn(`[翻译] 翻译失败，使用原文本: ${err.message}`);
        }
      } else {
        console.warn('[翻译] 翻译库未安装，使用原文本');
      }

      // 如果文本包含 "the"，提取 "the" 后面的名词
      // 例如 "Choose all the bags" -> 提取 "bags"
      let targetObject = englishText;
      
      const theMatch = englishText.match(/the\s+(\w+(?:\s+\w+)*)/i);
      if (theMatch && theMatch[1]) {
        targetObject = theMatch[1].toLowerCase();
        console.log(`[翻译] ✓ 从句子中提取目标对象: "${targetObject}"`);
      } else {
        // 如果找不到 "the"，就提取最后的几个单词
        const words = englishText.split(/\s+/).filter(w => w.length > 0);
        // 保留最后的名词（通常是最后1-2个单词）
        if (words.length > 2) {
          targetObject = words.slice(-2).join(' ').toLowerCase();
        } else if (words.length > 0) {
          targetObject = words[words.length - 1].toLowerCase();
        }
        console.log(`[翻译] ✓ 提取目标词汇: "${targetObject}"`);
      }

      // 最终格式：返回完整的提示语（保持原文案结构）
      const formatted = englishText;
      console.log(`[翻译] ✓ 最终格式: "${formatted}"`);
      return formatted;
    } catch (err) {
      console.error('[翻译] ✗ 翻译失败:', err.message);
      return 'Pick the object';
    }
  }

  /**
   * 获取 yescaptcha 余额
   * @returns {Promise<number>} 账户余额
   */
  async getBalance() {
    try {
      console.log('[余额] 正在获取账户余额...');
      const response = await axios.post(`${this.yescaptchaBaseUrl}/getBalance`, {
        clientKey: this.clientKey
      });

      if (response.data.errorId === 0 || response.data.errorId === undefined) {
        const balance = response.data.balance || 0;
        console.log(`[余额] ✓ 账户余额: $${balance}`);
        return balance;
      } else {
        throw new Error(response.data.errorDescription || '获取余额失败');
      }
    } catch (error) {
      console.error(`[余额] ✗ 获取余额失败: ${error.message}`);
      return 0;
    }
  }

  /**
   * 使用 yescaptcha 创建验证码任务
   * @param {string} base64Image - 验证码图片的 base64 编码（可以带或不带 data:image 前缀）
   * @param {string} question - 验证码问题（提示语）
   * @returns {Promise<Object>} 包含 taskId 和 solution 的对象
   */
  async createTask(base64Image, question) {
    try {
      console.log('[任务] 正在创建 yescaptcha 任务...');
      console.log(`[任务] 问题: "${question}"`);
      console.log(`[任务] Base64 长度: ${base64Image.length} 字符`);

      // 确保 base64 格式正确（加上 data:image/jpeg;base64, 前缀）
      let imageData = base64Image;
      if (!imageData.startsWith('data:image')) {
        imageData = `data:image/jpeg;base64,${base64Image}`;
        console.log('[任务] ✓ 已添加 data:image 前缀');
      } else {
        console.log('[任务] ✓ Base64 已包含前缀');
      }

      // 尝试多种任务类型
      const taskTypes = [
        // { type: 'ImageClassification', question: question },           // 图片分类（最可能）
        { type: 'AwsClassification', question: question },      // ReCaptcha V2
        // { type: 'FunCaptchaClassification', question: question },       // FunCaptcha
        // { type: 'ImageToText', question: question }                     // 图片文字
      ];
      
      let response = null;
      let lastError = null;

      // 🔍 保存图片到桌面用于调试
      try {
        const imageBuffer = Buffer.from(base64Image, 'base64');
        const desktopPath = `C:\\Users\\sxh\\Desktop\\yescaptcha-image-${Date.now()}.jpg`;
        fs.writeFileSync(desktopPath, imageBuffer);
        console.log(`[调试] ✓ 图片已保存到桌面: ${desktopPath}`);
      } catch (e) {
        console.log(`[调试] 保存图片失败: ${e.message}`);
      }
      
      for (const taskConfig of taskTypes) {
        try {
          const postData = {
            clientKey: this.clientKey,
            task: {
              type: taskConfig.type,
              image: imageData,
              question: taskConfig.question
            }
          };

          console.log(`[任务] 尝试类型: ${taskConfig.type}`);
          console.log('[任务] 发送请求到 yescaptcha...');
          response = await axios.post(`${this.yescaptchaBaseUrl}/createTask`, postData, {
            timeout: 30000
          });

          console.log('[任务] 服务器响应:', {
            errorId: response.data.errorId,
            taskId: response.data.taskId,
            solutionLength: response.data.solution?.objects?.length || 0
          });

          // 如果成功，跳出循环
          if (response.data.errorId === 0 || response.data.errorId === undefined) {
            console.log(`[任务] ✓ 类型 ${taskConfig.type} 成功！`);
            break;
          } else {
            lastError = response.data.errorDescription || `任务创建失败: ${response.data.errorId}`;
            console.log(`[任务] ✗ 类型 ${taskConfig.type} 失败: ${lastError}`);
          }
        } catch (error) {
          lastError = error.message;
          console.log(`[任务] ✗ 类型 ${taskConfig.type} 异常: ${error.message}`);
        }
      }

      if (!response) {
        throw new Error('所有任务类型都失败了：' + lastError);
      }

      console.log('[任务] 服务器响应:', {
        errorId: response.data.errorId,
        errorCode: response.data.errorCode,
        errorDescription: response.data.errorDescription,
        taskId: response.data.taskId,
        solutionLength: response.data.solution?.objects?.length || 0
      });

      if (response.data.errorId === 0 || response.data.errorId === undefined) {
        // 返回完整的yescaptcha格式
        const result = {
          errorId: response.data.errorId || 0,
          errorCode: response.data.errorCode || '',
          status: response.data.status || 'ready',
          solution: response.data.solution || { 
            label: '',
            objects: [],
            top_k: [],
            confidences: []
          },
          taskId: response.data.taskId,
          isSuccess: true
        };
        console.log(`[任务] ✓ 任务创建成功，ID: ${result.taskId}`);
        console.log(`[任务] 解决方案: objects=${JSON.stringify(result.solution.objects)}, top_k=${JSON.stringify(result.solution.top_k)}`);
        return result;
      } else {
        throw new Error(response.data.errorDescription || lastError || `任务创建失败: ${response.data.errorId}`);
      }
    } catch (error) {
      console.error(`[任务] ✗ 创建任务失败: ${error.message}`);
      return {
        taskId: null,
        errorId: -1,
        errorCode: 'ERROR',
        status: 'failed',
        solution: {
          label: '',
          objects: [],
          top_k: [],
          confidences: []
        },
        isSuccess: false,
        error: error.message
      };
    }
  }

  /**
   * 解决验证码（集成截图、翻译、创建任务）
   * @param {Page} page - Playwright 页面对象
   * @returns {Promise<Object>} 包含 base64, question, solution 的完整结果
   */
  async solveWithYescaptcha(page) {
    try {
      console.log('\n========== 开始验证码解决流程 ==========');

      // 1️⃣ 检查余额
      const balance = await this.getBalance();
      if (balance <= 0) {
        throw new Error('余额不足，无法继续识别');
      }

      // 2️⃣ 截取验证码
      console.log('[流程] 第一步: 截取验证码图片...');
      let base64Image;
      try {
        // 等待canvas加载完毕
        await page.waitForSelector('canvas', { timeout: 5000 }).catch(() => {
          console.log('[截图] canvas 选择器超时，继续...');
        });
        
        // 给canvas加载时间
        await page.waitForTimeout(1000);
        
        // 先尝试找到所有 canvas 并选择可见的
        let canvasCount = await page.locator('canvas').count();
        console.log(`[截图] 检测到 ${canvasCount} 个 canvas 元素`);
        
        if (canvasCount === 0) {
          console.log('[截图] ⚠️ 没有找到任何canvas，尝试刷新页面...');
          await page.reload({ waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(2000);
          canvasCount = await page.locator('canvas').count();
          console.log(`[截图] 重新加载后检测到 ${canvasCount} 个 canvas 元素`);
        }
        
        let capturedBuffer = null;
        
        // 遍历所有 canvas，找到可见的 canvas 并截图
        for (let i = 0; i < canvasCount; i++) {
          try {
            const canvasLocator = page.locator('canvas').nth(i);
            const info = await canvasLocator.evaluate(el => ({
              width: el.width,
              height: el.height,
              offsetWidth: el.offsetWidth,
              offsetHeight: el.offsetHeight,
              isVisible: el.offsetParent !== null && window.getComputedStyle(el).display !== 'none',
              visibility: window.getComputedStyle(el).visibility,
              display: window.getComputedStyle(el).display
            }));
            
            console.log(`[截图] Canvas ${i}: ${info.width}x${info.height}, offset: ${info.offsetWidth}x${info.offsetHeight}, visible: ${info.isVisible}, visibility: ${info.visibility}, display: ${info.display}`);
            
            // 条件: Canvas 必须可见（offsetWidth > 0 或 isVisible = true）
            if (info.offsetWidth > 0 || info.isVisible) {
              console.log(`[截图] Canvas ${i} 符合条件，尝试截图...`);
              
              try {
                // 尝试截图，使用较长超时以等待字体加载
                capturedBuffer = await canvasLocator.screenshot({ 
                  timeout: 10000
                });
                console.log(`[截图] ✓ 成功从 Canvas ${i} 截取图片`);
              } catch (screenshotErr) {
                console.log(`[截图] Canvas ${i} 截图超时，尝试使用 toDataURL 方式...`);
                
                // 如果字体加载超时，使用 canvas.toDataURL() 获取图片数据
                try {
                  const canvasIndex = i;
                  const dataUrl = await page.evaluate((index) => {
                    const canvas = document.querySelectorAll('canvas')[index];
                    if (!canvas) throw new Error('Canvas not found');
                    return canvas.toDataURL('image/png');
                  }, canvasIndex);
                  
                  // 从 data URL 提取 base64 部分并转换为 buffer
                  const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
                  capturedBuffer = Buffer.from(base64Data, 'base64');
                  console.log(`[截图] ✓ 通过 toDataURL 成功获取 Canvas ${i} 图片`);
                } catch (evalErr) {
                  console.log(`[截图] toDataURL 方式也失败了: ${evalErr.message}`);
                  capturedBuffer = null;
                }
              }
              
              if (capturedBuffer) {
                
                // 使用 sharp 进行图片处理：调整尺寸 + 转换为 JPEG
                if (capturedBuffer.length > 0) {
                  try {
                    const sharp = require('sharp');
                    const metadata = await sharp(capturedBuffer).metadata();
                    console.log(`[截图] 原始尺寸: ${metadata.width}x${metadata.height}, 格式: ${metadata.format}`);
                    
                    if (metadata.width !== 450 || metadata.height !== 450) {
                      console.log(`[截图] 调整尺寸到 450x450（yescaptcha要求）...`);
                      capturedBuffer = await sharp(capturedBuffer)
                        .resize(450, 450, { fit: 'cover' })
                        .toBuffer();
                      console.log(`[截图] ✓ 已调整尺寸到 450x450`);
                    }
                    
                    // 转换为 JPEG 格式，确保兼容性
                    console.log(`[截图] 转换为 JPEG 格式...`);
                    capturedBuffer = await sharp(capturedBuffer)
                      .jpeg({ quality: 90 })
                      .toBuffer();
                    console.log(`[截图] ✓ 已转换为 JPEG`);
                  } catch (e) {
                    console.log(`[截图] sharp 处理失败，但继续使用原始图片: ${e.message}`);
                  }
                }
                break;
              }
            }
          } catch (e) {
            console.log(`[截图] Canvas ${i} 处理异常: ${e.message}`);
            // 继续尝试下一个
          }
        }
        
        // 如果原有逻辑检测不到，新增补充检测方法
        if (!capturedBuffer) {
          console.log('[截图] 原有逻辑未获取到图片，尝试补充检测方法...');
          
          // 补充检测 1: 等待容器加载并重新检测 canvas
          try {
            console.log('[截图-补充1] 尝试等待验证码容器加载...');
            await page.waitForSelector('#captcha-container, #cvf-aamation-container', { timeout: 5000 }).catch(() => {});
            await page.waitForTimeout(2000);
            
            const containerCanvasCount = await page.locator('#captcha-container canvas, #cvf-aamation-container canvas').count();
            console.log(`[截图-补充1] 在容器中检测到 ${containerCanvasCount} 个 canvas 元素`);
            
            if (containerCanvasCount > 0) {
              const containerCanvasLocator = page.locator('#captcha-container canvas, #cvf-aamation-container canvas').first();
              try {
                capturedBuffer = await containerCanvasLocator.screenshot({ timeout: 10000 });
                console.log(`[截图-补充1] ✓ 成功从容器内的 canvas 截取图片`);
              } catch (e) {
                console.log(`[截图-补充1] 容器内 canvas 截图失败，尝试 toDataURL...`);
                try {
                  const dataUrl = await page.evaluate(() => {
                    const canvas = document.querySelector('#captcha-container canvas') || 
                                   document.querySelector('#cvf-aamation-container canvas');
                    if (!canvas) throw new Error('Canvas not found in container');
                    return canvas.toDataURL('image/png');
                  });
                  const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
                  capturedBuffer = Buffer.from(base64Data, 'base64');
                  console.log(`[截图-补充1] ✓ 通过 toDataURL 成功获取图片`);
                } catch (evalErr) {
                  console.log(`[截图-补充1] toDataURL 失败: ${evalErr.message}`);
                }
              }
            }
          } catch (err) {
            console.log(`[截图-补充1] 补充检测 1 失败: ${err.message}`);
          }
          
          // 补充检测 2: 等待网络加载后再次尝试
          if (!capturedBuffer) {
            try {
              console.log('[截图-补充2] 尝试等待网络加载并重新检测...');
              await page.waitForLoadState('networkidle').catch(() => {});
              await page.waitForTimeout(3000);
              
              const retryCanvasCount = await page.locator('canvas').count();
              console.log(`[截图-补充2] 网络加载后检测到 ${retryCanvasCount} 个 canvas 元素`);
              
              if (retryCanvasCount > 0) {
                const retryCanvasLocator = page.locator('canvas').first();
                const info = await retryCanvasLocator.evaluate(el => ({
                  offsetWidth: el.offsetWidth,
                  offsetHeight: el.offsetHeight
                }));
                
                if (info.offsetWidth > 0 || info.offsetHeight > 0) {
                  try {
                    capturedBuffer = await retryCanvasLocator.screenshot({ timeout: 10000 });
                    console.log(`[截图-补充2] ✓ 成功从 canvas 截取图片`);
                  } catch (e) {
                    console.log(`[截图-补充2] 截图失败，尝试 toDataURL...`);
                    const dataUrl = await page.evaluate(() => {
                      const canvas = document.querySelector('canvas');
                      if (!canvas) throw new Error('Canvas not found');
                      return canvas.toDataURL('image/png');
                    });
                    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
                    capturedBuffer = Buffer.from(base64Data, 'base64');
                    console.log(`[截图-补充2] ✓ 通过 toDataURL 成功获取图片`);
                  }
                }
              }
            } catch (err) {
              console.log(`[截图-补充2] 补充检测 2 失败: ${err.message}`);
            }
          }
          
          // 补充检测 3: 查看是否有其他可能的 canvas（iframe 内等）
          if (!capturedBuffer) {
            try {
              console.log('[截图-补充3] 尝试查找所有可能的 canvas 元素...');
              const allCanvasLocators = await page.locator('canvas').all();
              console.log(`[截图-补充3] 找到 ${allCanvasLocators.length} 个 canvas 元素`);
              
              for (let i = 0; i < allCanvasLocators.length; i++) {
                try {
                  const locator = allCanvasLocators[i];
                  const dataUrl = await locator.evaluate(el => {
                    if (el.offsetWidth > 0 && el.offsetHeight > 0) {
                      return el.toDataURL('image/png');
                    }
                    return null;
                  });
                  
                  if (dataUrl) {
                    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
                    capturedBuffer = Buffer.from(base64Data, 'base64');
                    console.log(`[截图-补充3] ✓ 从第 ${i} 个 canvas 成功获取图片`);
                    break;
                  }
                } catch (e) {
                  console.log(`[截图-补充3] 第 ${i} 个 canvas 尝试失败`);
                }
              }
            } catch (err) {
              console.log(`[截图-补充3] 补充检测 3 失败: ${err.message}`);
            }
          }
          
          if (!capturedBuffer) {
            throw new Error('未找到有效的验证码 canvas');
          }
        }
        
        base64Image = capturedBuffer.toString('base64');
        console.log(`[流程] ✓ 验证码图片已截取，大小: ${(base64Image.length / 1024).toFixed(2)} KB`);
      } catch (e) {
        throw new Error(`截取验证码失败: ${e.message}`);
      }

      // 3️⃣ 获取提示语
      console.log('[流程] 第二步: 提取验证码提示语...');
      const promptText = await this.getPromptText(page);

      // 4️⃣ 翻译提示语
      console.log('[流程] 第三步: 翻译提示语...');
      const englishQuestion = await this.translateToEnglish(promptText);

      // 5️⃣ 创建 yescaptcha 任务
      console.log('[流程] 第四步: 使用 yescaptcha 识别...');
      const result = await this.createTask(base64Image, englishQuestion);

      if (!result.isSuccess) {
        throw new Error(result.error);
      }

      // 返回完整结果（符合yescaptcha API格式）
      const completeResult = {
        errorId: result.errorId || 0,
        errorCode: result.errorCode || '',
        status: result.status || 'ready',
        solution: {
          label: result.solution.label || '',
          objects: result.solution.objects || [],
          top_k: result.solution.top_k || [],
          confidences: result.solution.confidences || []
        },
        taskId: result.taskId,
        originalQuestion: promptText,
        translatedQuestion: englishQuestion,
        base64Image,
        success: true
      };

      console.log(`[流程] ✓ 验证码解决成功，解决方案: ${JSON.stringify({
        objects: completeResult.solution.objects,
        top_k: completeResult.solution.top_k
      })}`);
      return completeResult;
    } catch (error) {
      console.error(`[流程] ✗ 验证码解决失败: ${error.message}`);
      return {
        success: false,
        error: error.message,
        targets: []
      };
    }
  }

  /**
   * 根据yescaptcha的解决方案进行点击
   * @param {Page} page - Playwright 页面对象
   * @param {Object} solution - yescaptcha返回的solution对象，包含objects或top_k数组
   * @returns {Promise<Object>} 点击结果
   */
  async clickTargets(page, solution) {
    try {
      console.log('\n========== 开始点击目标 ==========');
      
      // 获取目标位置数组
      // 可以使用 objects 数组（true/false）或 top_k 数组（索引）
      let targetIndices = [];
      
      if (solution.top_k && solution.top_k.length > 0) {
        // 使用 top_k 数组（推荐，因为更直接）
        targetIndices = solution.top_k;
        console.log(`[点击] 使用 top_k 数组: ${JSON.stringify(targetIndices)}`);
      } else if (solution.objects && solution.objects.length === 9) {
        // 从 objects 数组中提取 true 的位置（备选方案）
        targetIndices = solution.objects
          .map((isTarget, index) => isTarget ? index : -1)
          .filter(index => index !== -1);
        console.log(`[点击] 从 objects 数组中提取目标: ${JSON.stringify(targetIndices)}`);
      } else {
        throw new Error('无有效的目标数据（既无 top_k 也无 objects）');
      }
      
      if (targetIndices.length === 0) {
        throw new Error('未找到任何目标位置');
      }

      // 查找验证码canvas并获取其位置信息
      // 先尝试找到所有canvas并选择可见的那个
      const canvasCount = await page.locator('canvas').count();
      console.log(`[点击] 检测到 ${canvasCount} 个 canvas 元素`);
      
      let canvasLocator = null;
      let canvasBox = null;
      
      // 遍历所有canvas，找到可见的那个
      for (let i = 0; i < canvasCount; i++) {
        const locator = page.locator('canvas').nth(i);
        const info = await locator.evaluate(el => ({
          offsetParent: el.offsetParent !== null,
          display: window.getComputedStyle(el).display,
          visibility: window.getComputedStyle(el).visibility,
          offsetWidth: el.offsetWidth,
          offsetHeight: el.offsetHeight
        })).catch(() => null);
        
        if (info && (info.offsetParent || (info.display !== 'none' && info.offsetWidth > 0))) {
          console.log(`[点击] Canvas ${i} 是可见的，选中它`);
          canvasLocator = locator;
          canvasBox = await locator.boundingBox().catch(() => null);
          if (canvasBox) {
            console.log(`[点击] Canvas ${i} 位置: x=${canvasBox.x}, y=${canvasBox.y}, width=${canvasBox.width}, height=${canvasBox.height}`);
            break;
          }
        }
      }
      
      if (!canvasBox || !canvasLocator) {
        throw new Error('无法获取 canvas 的位置信息，所有canvas都不可见');
      }

      // 计算网格信息（假设是 3x3 网格）
      const gridSize = 3;
      const cellWidth = canvasBox.width / gridSize;
      const cellHeight = canvasBox.height / gridSize;
      
      console.log(`[点击] 网格信息: 3x3, 每个单元格 ${cellWidth.toFixed(2)}x${cellHeight.toFixed(2)} px`);

      // 依次点击每个目标位置
      for (const index of targetIndices) {
        if (index < 0 || index >= 9) {
          console.log(`[点击] ⚠️ 跳过无效的位置索引: ${index}`);
          continue;
        }

        // 计算该位置在网格中的行列
        const row = Math.floor(index / gridSize);
        const col = index % gridSize;
        
        // 计算点击坐标（每个单元格的中心）
        const clickX = canvasBox.x + (col + 0.5) * cellWidth;
        const clickY = canvasBox.y + (row + 0.5) * cellHeight;
        
        console.log(`[点击] 目标位置 ${index} (行${row}, 列${col}): 点击坐标 (${clickX.toFixed(0)}, ${clickY.toFixed(0)})`);
        
        try {
          // 执行点击
          await page.mouse.click(clickX, clickY);
          console.log(`[点击] ✓ 成功点击位置 ${index}`);
          
          // 点击之间稍作延迟，避免太快
          await page.waitForTimeout(300);
        } catch (err) {
          console.log(`[点击] ✗ 点击位置 ${index} 失败: ${err.message}`);
        }
      }

      console.log(`[点击] ✓ 已完成所有目标点击（共 ${targetIndices.length} 个）`);
      
      return {
        success: true,
        clickedCount: targetIndices.length,
        targetIndices,
        message: `已点击 ${targetIndices.length} 个目标位置`
      };

    } catch (error) {
      console.error(`[点击] ✗ 点击操作失败: ${error.message}`);
      return {
        success: false,
        error: error.message,
        clickedCount: 0,
        targetIndices: []
      };
    }
  }

  /**
   * 等待1-2秒后点击提交按钮
   * @param {Page} page - Playwright 页面对象
   * @returns {Promise<Object>} 提交结果
   */
  async submitVerification(page) {
    try {
      console.log('\n========== 点击提交按钮 ==========');
      
      // 等待1秒
      console.log('[提交] 等待 1 秒...');
      await page.waitForTimeout(1000);
      
      // 查找并点击提交按钮
      const submitButton = page.locator('button#amzn-btn-verify-internal');
      const buttonCount = await submitButton.count();
      
      if (buttonCount === 0) {
        throw new Error('未找到提交按钮 (id="amzn-btn-verify-internal")');
      }
      
      console.log('[提交] ✓ 找到提交按钮');
      
      // 点击提交按钮
      await submitButton.click();
      console.log('[提交] ✓ 已点击提交按钮');
      
      // 再等1秒让页面处理提交
      console.log('[提交] 等待提交处理中...');
      await page.waitForTimeout(1000);
      
      return {
        success: true,
        message: '提交成功'
      };
      
    } catch (error) {
      console.error(`[提交] ✗ 提交失败: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取 API 文档链接
   * @returns {Object} API 文档信息
   */
  getApiDocumentation() {
    return {
      getBalance: 'https://yescaptcha.atlassian.net/wiki/spaces/YESCAPTCHA/pages/229767/getBalance',
      createTask: 'https://yescaptcha.atlassian.net/wiki/spaces/YESCAPTCHA/pages/33351/createTask',
      baseUrl: 'https://api.yescaptcha.com',
      supportedTypes: ['ReCaptchaV2Classification', 'FunCaptchaClassification', 'HCaptchaClassification']
    };
  }
}

module.exports = CaptchaCanvasCapture;
