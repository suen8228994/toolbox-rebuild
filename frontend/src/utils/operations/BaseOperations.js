/**
 * 基础操作类 - 提供通用的页面交互方法
 */

const {
  generateRandomDelay: utilRandomAround,
  generateFluctuatingDelay: utilFluctuateAround,
  CustomError
} = require('../../refactored-backend/utils/toolUtils');

const {
  scrollDownAndUp,
  humanClickLocator,
  humanTypeLocator
} = require('../pageUtils');

class BaseOperations {
  constructor(page, config, tasklog) {
    this.page = page;
    this.config = config;
    this.tasklog = tasklog;
  }

    /**
   * 错误创建
   */
  createError(error) {
    // Normalize to object with message and logID (CustomError expects an object)
    const msg = (error && (error.message || error.toString())) || 'Unknown error';
    const logID = (error && error.logID) || null;
    throw new CustomError({ message: msg, logID });
  }

  /**
   * 点击元素（通用方法）
   */
async clickElement(element, options) {
    const oldUrl = this.page.url();
    
    try {
      // 使用人类点击模拟（带鼠标轨迹）
      try {
        await humanClickLocator(this.page, element);
      } catch (humanClickError) {
        // 如果人类点击失败，回退到普通点击
        console.log('Human click failed, falling back to normal click:', humanClickError.message);
        await element.click({ delay: utilFluctuateAround(150) });
      }
      
      await this.page.waitForTimeout(utilRandomAround(2000, 5000));
      
      if (options.waitForURL) {
        await this.page.waitForURL(
          u => u.href !== oldUrl,
          { timeout: 120000 }
        );
        await this.page
          .waitForLoadState(options.waitUntil || 'load')
          .catch(() => {});
      }
    } catch (err) {
      // include the underlying error message to aid debugging
      const reason = err && err.message ? `: ${err.message}` : '';
      this.createError({
        message: `${options.title} 操作失败${reason}`,
        logID: 'Error-Info'
      });
    }
  }
  /**
   * 填写输入框（通用方法）
   */
  async fillInput(element, str, options = {}) {
    try {
      // 参数验证：确保str不是undefined或null
      if (str === undefined || str === null) {
        const errorMsg = `fillInput参数错误: str为${str} (${options.title || '未知操作'})`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
      
      // 转换为字符串（防止数字等其他类型）
      const inputStr = String(str);
      
      // 确保元素可见（如果没有设置 skipVisibilityCheck）
      if (!options.skipVisibilityCheck) {
        try {
          await element.waitFor({ state: 'visible', timeout: 5000 });
        } catch (e) {
          throw new Error(`元素不可见: ${e.message}`);
        }
        
        // 滚动到元素
        await element.evaluate(el => {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }
      
      // 使用逼真的人类打字模拟
      await this.page.waitForTimeout(
        options.preDelay || utilRandomAround(250, 500)
      );
      
      // 如果需要清空内容，先清空
      if (options.clearContent) {
        await element.click({ delay: utilRandomAround(150) });
        await this.page.keyboard.press('Control+A');
        await this.page.keyboard.press('Backspace');
        await this.page.waitForTimeout(utilRandomAround(200, 400));
      }
      
      // 点击输入框
      await element.click({ delay: utilRandomAround(150) });
      await this.page.waitForTimeout(200 + Math.random() * 300);
      
      // 偶尔会有鼠标移动（更逼真的人类行为）
      if (Math.random() < 0.15) {
        const box = await element.boundingBox();
        if (box) {
          await this.page.mouse.move(
            box.x + Math.random() * box.width * 0.5,
            box.y + Math.random() * box.height * 0.5,
            { steps: 3 }
          );
          await this.page.waitForTimeout(utilRandomAround(100, 300));
        }
      }
      
      // 逐字符输入，带随机延迟
      // 支持慢速按键模式（模拟真实按键事件）或快速 keyboard.type 模式
      const useSlowType = !!options.slowType || (options.minDelayMs !== undefined || options.maxDelayMs !== undefined);
      const minDelayMs = (options.minDelayMs !== undefined) ? options.minDelayMs : (useSlowType ? 500 : 50);
      const maxDelayMs = (options.maxDelayMs !== undefined) ? options.maxDelayMs : (useSlowType ? 2000 : 150);

      if (useSlowType) {
        // 慢速逐字，优先使用 element.press 以触发真实按键事件，失败退回到 element.type
        try {
          try { await element.click({ timeout: 3000 }); } catch (e) { /* ignore */ }
        } catch (e) { }

        for (const ch of inputStr.split('')) {
          const waitMs = utilRandomAround(minDelayMs, maxDelayMs);
          await this.page.waitForTimeout(waitMs);
          try {
            await element.press(ch);
          } catch (e) {
            try { await element.type(ch); } catch (e2) { /* ignore */ }
          }

          if (Math.random() < 0.05) {
            await this.page.waitForTimeout(Math.random() * 300);
          }
        }
      } else {
        for (const ch of inputStr.split('')) {
          await this.page.keyboard.type(ch, { delay: 50 + Math.random() * 120 });
          if (Math.random() < 0.05) {
            // 偶尔暂停，更自然
            await this.page.waitForTimeout(Math.random() * 300);
          }
        }
      }
      
      // 随机的"删除重填"行为（模拟用户输错了然后更正的情况）
      // 默认有小概率（10%）在当前输入字段进行删除重填
      const shouldRandomRetype = (Math.random() < 0.1 && inputStr.length > 2);

      // 如果上层显式要求在该字段强制执行删除重填（用于在一个页面的多个字段中只随机选择一个字段进行删除重填）
      const forceRetype = !!options.forceDeleteRetype;

      if (forceRetype || shouldRandomRetype) {
        const deleteCount = Math.floor(Math.random() * 3) + 1; // 删除1-3个字符
        const reType = inputStr.substring(inputStr.length - deleteCount);

        this.tasklog({ message: `执行删除重填: 删除 ${deleteCount} 字符（force=${forceRetype}）`, logID: 'RG-Info-Operate' });
        await this.page.waitForTimeout(utilRandomAround(200, 500));

        // 删除错误的字符
        for (let i = 0; i < deleteCount; i++) {
          await this.page.keyboard.press('Backspace');
          await this.page.waitForTimeout(50 + Math.random() * 100);
        }

        await this.page.waitForTimeout(utilRandomAround(150, 400));

        // 重新输入被删除的字符
        for (const ch of reType.split('')) {
          await this.page.keyboard.type(ch, { delay: 50 + Math.random() * 120 });
          if (Math.random() < 0.05) {
            await this.page.waitForTimeout(Math.random() * 200);
          }
        }
      }
      
      // 验证输入是否成功（可选）
      const inputValue = await element.inputValue().catch(() => '');
      if (inputValue !== inputStr) {
        console.warn(`⚠️ 输入验证失败: 期望 "${inputStr}", 实际 "${inputValue}"，尝试重新输入...`);
        
        // 清空并重新输入
        await element.click({ delay: utilRandomAround(150) });
        await this.page.keyboard.press('Control+A');
        await this.page.keyboard.press('Backspace');
        await this.page.waitForTimeout(utilRandomAround(200, 400));
        
        // 重新逐字符输入
        for (const ch of inputStr.split('')) {
          await this.page.keyboard.type(ch, { delay: 50 + Math.random() * 120 });
        }
      }
      
      await this.page.waitForTimeout(
        options.postDelay || utilRandomAround(1000, 1500)
      );
    } catch (error) {
      // 记录错误但不中断流程
      console.error(`fillInput 失败 (${options.title || '输入操作'}):`, error.message);
      this.tasklog({
        message: `${options.title || '输入操作'} 失败: ${error.message}`,
        logID: 'Warn-Info'
      });
      throw error; // 仍然抛出错误让上层处理
    }
  }

  /**
   * 等待随机时间
   */
  async waitRandom(min, max) {
    await this.page.waitForTimeout(utilRandomAround(min, max));
  }
}

module.exports = BaseOperations;
