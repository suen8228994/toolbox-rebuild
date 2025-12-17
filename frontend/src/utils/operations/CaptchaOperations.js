/**
 * Captcha处理类 - 负责验证码识别和提交
 */

const BaseOperations = require('./BaseOperations');
const {
  generateGridPositions: utilGenerateGridPositions
} = require('../../refactored-backend/utils/toolUtils');

class CaptchaOperations extends BaseOperations {
  /**
   * 检查是否有Captcha
   */
  async checkCaptcha() {
    this.tasklog({ message: '检查是否存在验证码', logID: 'RG-Info-Operate' });
    
    try {
      const captcha = await this.page.locator('#cvf-page-content').isVisible({ timeout: 5000 });
      if (captcha) {
        this.tasklog({ message: '检测到验证码，开始处理', logID: 'RG-Info-Operate' });
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * 解决Captcha
   */
  async solveCaptcha() {
    this.tasklog({ message: '开始解决验证码', logID: 'RG-Info-Operate' });
    
    await this.waitRandom(2000, 3000);
    
    const captchaData = await this.getCaptchaData();
    const solution = await this.getCaptchaSolution(captchaData);
    
    if (!solution || !solution.positions || solution.positions.length === 0) {
      throw new Error('Captcha解析失败：未获取到有效答案');
    }
    
    this.tasklog({ 
      message: `Captcha答案：需要点击 ${solution.positions.length} 个位置`, 
      logID: 'RG-Info-Operate' 
    });
    
    for (const position of solution.positions) {
      await this.clickCaptchaPosition(position);
      await this.waitRandom(800, 1200);
    }
    
    await this.submitCaptcha();
    await this.waitRandom(2000, 3000);
  }

  /**
   * 获取Captcha数据
   */
  async getCaptchaData() {
    const imgElement = await this.page.locator('#cvf-page-content img').first();
    const imgSrc = await imgElement.getAttribute('src');
    
    const promptElement = await this.page.locator('#cvf-page-content h4').first();
    const prompt = await promptElement.innerText();
    
    return {
      imageUrl: imgSrc,
      prompt: prompt,
      gridSize: { rows: 3, cols: 3 }
    };
  }

  /**
   * 获取Captcha解决方案（需要实现AI识别）
   */
  async getCaptchaSolution(captchaData) {
    // TODO: 这里应该调用AI识别服务
    // 目前返回模拟数据
    this.tasklog({ 
      message: '正在识别验证码...', 
      logID: 'RG-Info-Operate' 
    });
    
    // 模拟返回：随机选择1-3个位置
    const randomCount = Math.floor(Math.random() * 3) + 1;
    const allPositions = utilGenerateGridPositions({ rows: 3, cols: 3 });
    const shuffled = allPositions.sort(() => Math.random() - 0.5);
    const selectedPositions = shuffled.slice(0, randomCount);
    
    return {
      positions: selectedPositions,
      confidence: 0.85
    };
  }

  /**
   * 点击Captcha指定位置
   */
  async clickCaptchaPosition(position) {
    this.tasklog({ 
      message: `点击验证码位置 (行${position.row}, 列${position.col})`, 
      logID: 'RG-Info-Operate' 
    });
    
    const selector = `#cvf-page-content [data-row="${position.row}"][data-col="${position.col}"]`;
    const cell = this.page.locator(selector);
    
    await this.clickElement(cell, { title: '点击验证码格子' });
  }

  /**
   * 提交Captcha
   */
  async submitCaptcha() {
    this.tasklog({ message: '提交验证码', logID: 'RG-Info-Operate' });
    
    const submitButton = this.page.locator('#cvf-submit-button');
    await this.clickElement(submitButton, {
      title: '提交验证码',
      waitForURL: true
    });
  }
}

module.exports = CaptchaOperations;
