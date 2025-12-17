/**
 * 基础操作类 - 提供通用的页面交互方法
 */

const {
  generateRandomDelay: utilRandomAround,
  generateFluctuatingDelay: utilFluctuateAround
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
   * 点击元素（通用方法）
   */
  async clickElement(locator, options = {}) {
    const {
      title = '点击元素',
      waitForURL = false,
      timeout = 30000
    } = options;

    await locator.waitFor({ timeout });
    await humanClickLocator(locator);

    if (waitForURL) {
      await this.page.waitForLoadState('load');
      await this.page.waitForTimeout(utilRandomAround(1000, 2000));
    }
  }

  /**
   * 填写输入框（通用方法）
   */
  async fillInput(locator, value, options = {}) {
    const {
      title = '填写输入框',
      timeout = 30000
    } = options;

    await locator.waitFor({ timeout });
    await humanTypeLocator(locator, value);
  }

  /**
   * 等待随机时间
   */
  async waitRandom(min, max) {
    await this.page.waitForTimeout(utilRandomAround(min, max));
  }
}

module.exports = BaseOperations;
