/**
 * Amazon Captcha 处理模块
 * 
 * 此模块专门处理Amazon注册过程中的图片验证码
 * 恢复原有的详细处理逻辑 + 邮箱OTP检测
 */

const {
  generateRandomDelay: utilRandomAround,
  generateFluctuatingDelay: utilFluctuateAround,
  generateGridPositions: utilGenerateGridPositions,
  createPollingFactory
} = require('../refactored-backend/utils/toolUtils');

class CaptchaHandler {
  constructor(page, tasklog, registerTime) {
    this.page = page;
    this.tasklog = tasklog;
    this.registerTime = registerTime;
  }

  async checkCaptcha() {
    try {
      this.tasklog({ message: '检测验证码...', logID: 'RG-Info-Operate' });
      
      // 【重要】先排除邮箱验证码页面（OTP输入框）
      const currentUrl = this.page.url();
      if (currentUrl.includes('/ap/cvf/')) {
        const pageContent = await this.page.content();
        const isEmailOTPPage = 
          pageContent.includes('Verify email address') ||
          pageContent.includes('Enter security code') ||
          pageContent.includes('One Time Password') ||
          await this.page.locator('input[name="cvf_captcha_input"]').count() > 0;
        
        if (isEmailOTPPage) {
          this.tasklog({ message: '✓ 检测到邮箱验证页面（非图片验证码）', logID: 'RG-Info-Operate' });
          return false;
        }
      }
      
      // 检测多种可能的验证码标识
      // 1. 检测 canvas 验证码容器（注意：可能是 cvf-aamation-container 或 captcha-container）
      const canvasContainerExists = await Promise.race([
        this.page.locator('#cvf-aamation-container').count().then(c => c > 0),
        this.page.locator('#captcha-container').count().then(c => c > 0),
        Promise.resolve(false).then(() => new Promise(resolve => setTimeout(() => resolve(false), 1000)))
      ]);
      
      if (canvasContainerExists) {
        this.tasklog({ message: '✓ 检测到canvas验证码容器', logID: 'RG-Info-Operate' });
        return true;
      }
      
      // 2. 检测验证码标题文字
      const pageContent = await this.page.content();
      const hasCaptchaTitle = 
        pageContent.includes('Solve this puzzle') ||
        pageContent.includes('solve this puzzle') ||
        pageContent.includes('Choose all') ||
        pageContent.includes('Select all') ||
        pageContent.includes('Verify that you are human');
      
      if (hasCaptchaTitle) {
        this.tasklog({ message: '✓ 检测到验证码标题文字', logID: 'RG-Info-Operate' });
        return true;
      }
      
      // 3. 检测验证码图片网格
      const captchaImagesCount = await this.page.locator('img[src*="captcha"]').count();
      if (captchaImagesCount > 0) {
        this.tasklog({ message: `✓ 检测到 ${captchaImagesCount} 个验证码图片`, logID: 'RG-Info-Operate' });
        return true;
      }
      
      // 4. 检测 Confirm 按钮和 Solved/Required 文字
      const hasConfirmButton = await this.page.locator('button:has-text("Confirm")').count() > 0;
      const hasSolvedText = pageContent.includes('Solved:') && pageContent.includes('Required:');
      
      if (hasConfirmButton && hasSolvedText) {
        this.tasklog({ message: '✓ 检测到验证码确认按钮和进度文字', logID: 'RG-Info-Operate' });
        return true;
      }
      
      this.tasklog({ message: '✗ 未检测到验证码', logID: 'RG-Info-Operate' });
      return false;
    } catch (error) {
      this.tasklog({ message: `验证码检测异常: ${error.message}`, logID: 'Warn-Info' });
      return false;
    }
  }

  async solveCaptcha() {
    try {
      // 1. 获取验证码数据
      const captchaSource = await this.getCaptchaData();
      if (!captchaSource) {
        throw new Error('无法获取验证码数据');
      }
      
      this.tasklog({ message: `获取到验证码数据: ${captchaSource.question}`, logID: 'RG-Info-Operate' });
      
      // 2. 解析验证码（获取需要点击的位置）
      const result = await this.getCaptchaSolution(captchaSource);
      if (!result || !Array.isArray(result)) {
        throw new Error('验证码解析结果无效');
      }
      
      this.tasklog({ message: `需要点击 ${result.length} 个位置`, logID: 'RG-Info-Operate' });
      
      // 3. 生成点击位置坐标
      const positions = utilGenerateGridPositions({
        width: 324,
        height: 324,
        source: result,
        gap: 16,
        padding: 16
      });
      
      // 4. 依次点击
      for (let i = 0; i < result.length; i++) {
        await this.clickCaptchaPosition(positions[i]);
        await this.page.waitForTimeout(utilRandomAround(750, 1000));
      }
      
      // 5. 提交验证码
      await this.submitCaptcha();
    } catch (error) {
      // 检查是否是代理/爬虫检测导致的错误
      if (error.message && (error.message.includes('被检测为爬虫') || error.message.includes('验证码页面'))) {
        this.tasklog({ message: `⚠️ 检测到网络检测: ${error.message}`, logID: 'Warn-Info' });
        // 等待一段时间后重新刷新页面，尝试绕过
        await this.page.waitForTimeout(3000);
        await this.page.reload({ waitUntil: 'networkidle' });
        this.tasklog({ message: '已刷新页面，尝试绕过网络检测', logID: 'RG-Info-Operate' });
        // 不再throw，让流程继续
        return;
      }
      
      this.tasklog({ message: `验证码处理失败: ${error.message}`, logID: 'Error-Info' });
      throw error;
    }
  }

  async getCaptchaData() {
    try {
      this.tasklog({ message: '等待验证码数据响应...', logID: 'RG-Info-Operate' });
      
      // 【关键】使用精确的正则表达式匹配原始toolbox的验证码API路径
      // 原始路径格式: /ait/ait/ait/problem?...
      // 这个正则确保只匹配验证码API的JSON响应，而不是其他静态资源(JS/CSS/HTML)
      const response = await this.page.waitForResponse(/ait\/ait\/ait\/problem\?.+$/, { timeout: 60000 });
      
      if (response.request().timing().startTime > this.registerTime) {
        // 直接解析JSON（原始实现的方式）
        const data = await response.json();
        const token = '58e9d0ae-8322-4c89-b6c5-cd035a684b02';
        const { assets, localized_assets } = data;
        
        this.tasklog({ message: '✓ 验证码数据获取成功', logID: 'RG-Info-Operate' });
        
        return {
          token,
          queries: JSON.parse(assets.images),
          question: localized_assets.target0
        };
      } else {
        this.tasklog({ message: '验证码响应时间早于注册时间，忽略', logID: 'Warn-Info' });
        throw new Error('验证码响应时间无效');
      }
    } catch (error) {
      this.tasklog({ message: `获取Captcha数据失败: ${error.message}`, logID: 'Error-Info' });
      throw error;
    }
  }

  async getCaptchaSolution(props) {
    if (!props || !props.token || !props.queries || !props.question) {
      throw new Error('验证码数据不完整');
    }
    
    const workflow = createPollingFactory({
      interval: 5000,
      maxWait: 60000, // 最多等待60秒
      error: (err) => {
        this.tasklog({ message: `解析captcha失败，重试中... (${err.message})`, logID: 'Warn-Info' });
      },
      complete: () => {
        const error = new Error('解析captcha失败，已达最大重试次数');
        this.tasklog({ message: error.message, logID: 'Error-Info' });
        throw error; // 抛出错误而不是只记录日志
      },
      // 当页面关闭或被销毁时停止轮询
      stop: () => this.page && this.page.isClosed()
    });
    
    return workflow(async (props) => {
      const response = await fetch('https://api.captcha.run/v2/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${props.token}`
        },
        body: JSON.stringify({
          captchaType: 'UniformITM',
          question: props.question,
          queries: props.queries
        })
      });
      
      if (!response.ok) {
        throw new Error(`API响应错误: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data || !data.result) {
        throw new Error('API返回数据格式错误');
      }
      
      if (data.result.type === 'multi' && data.result.objects && data.result.objects.length === 5) {
        this.tasklog({ message: '解析captcha成功', logID: 'RG-Info-Operate' });
        return data.result.objects;
      } else {
        throw new Error(`验证码结果不符合预期: type=${data.result.type}, objects=${data.result.objects?.length || 0}`);
      }
    }, props);
  }

  async clickCaptchaPosition(position) {
    await this.page.waitForTimeout(utilRandomAround(300, 500));

    const canvasLocator = this.page.locator('#captcha-container').locator('canvas').first();
    // 等待 canvas 出现并可见
    await canvasLocator.waitFor({ timeout: 10000 }).catch(() => {});
    const isVisible = await canvasLocator.isVisible().catch(() => false);
    if (!isVisible) {
      this.tasklog({ message: 'Canvas 未可见或不存在', logID: 'Error-Info' });
      throw new Error('Canvas not visible');
    }

    await canvasLocator.click({
      delay: utilFluctuateAround(150),
      position
    });

    this.tasklog({ message: `已点击验证码位置: (${position.x}, ${position.y})`, logID: 'RG-Info-Operate' });
    return true;
  }

  async submitCaptcha() {
    this.tasklog({ message: '提交验证码', logID: 'RG-Info-Operate' });
    const verifyButton = this.page.locator('#amzn-btn-verify-internal').first();
    // 等待按钮出现并可见
    await verifyButton.waitFor({ timeout: 10000 }).catch(() => {});
    const isVisible = await verifyButton.isVisible().catch(() => false);
    if (!isVisible) {
      this.tasklog({ message: '提交按钮不可见，无法提交验证码', logID: 'Warn-Info' });
      throw new Error('Verify button not visible');
    }

    await verifyButton.click({ delay: utilFluctuateAround(150) });
    await this.page.waitForLoadState('networkidle').catch(() => {});
    this.tasklog({ message: '已提交验证码', logID: 'RG-Info-Operate' });
  }
}

module.exports = CaptchaHandler; 