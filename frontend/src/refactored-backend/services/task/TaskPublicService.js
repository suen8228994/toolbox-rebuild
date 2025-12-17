/**
 * 任务公共服务
 * 管理任务配置、页面操作和日志记录
 */

const eventEmitter = require('../../utils/eventEmitter');
const { generateRandomDelay, CustomError } = require('../../utils/toolUtils');

class TaskPublicService {
  #page = null;
  #baseConfig = null;
  #registerConfig = null;
  #checkliveConfig = null;

  constructor() {}

  /**
   * 获取当前页面对象
   */
  get currentPage() {
    return this.#page;
  }

  /**
   * 获取基础配置
   */
  get baseConfig() {
    return this.#baseConfig;
  }

  /**
   * 获取注册配置
   */
  get registerConfig() {
    return this.#registerConfig;
  }

  /**
   * 获取测活配置
   */
  get checkliveConfig() {
    return this.#checkliveConfig;
  }

  /**
   * 初始化测活任务配置
   */
  initCheckliveTask({ common, checklive }) {
    this.#baseConfig = common;
    this.#checkliveConfig = {
      colorWaitTime: checklive.colorWaitTime,
      singleCount: checklive.singleCount,
      cardRecord: [],
      isSignin: false,
      username: '',
      defaultCardCount: 0,
      addCounts: 0
    };
  }

  /**
   * 初始化注册任务配置
   */
  initRegisterTask({ common, register }) {
    this.#baseConfig = common;
    this.#registerConfig = {
      ...register,
      isCaptcha: false,
      pageClose: false,
      notUseEmail: '',
      notUsePhone: '',
      language: 'en-US'
    };
  }

  /**
   * 初始化页面对象
   */
  initPage(page) {
    this.#page = page;
  }

  /**
   * 更新测活配置
   */
  updateCheckliveConfig(mutator) {
    mutator(this.#checkliveConfig);
  }

  /**
   * 更新注册配置
   */
  updateRegisterConfig(mutator) {
    mutator(this.#registerConfig);
  }

  /**
   * 创建鼠标事件并执行点击
   * @private
   */
  async #createMouseEvent(element) {
    await element.waitFor();
    await element.evaluate(el => {
      el.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    });

    await this.#page.waitForTimeout(generateRandomDelay(750, 1000));
    
    const coordinate = await this.#computeCoordinate(element);
    
    await element.evaluate(async (el, coords) => {
      const createMouseEvent = (eventName, options) => {
        return new MouseEvent(eventName, {
          bubbles: true,
          cancelable: true,
          clientX: options.x,
          clientY: options.y
        });
      };

      const mouseDown = createMouseEvent('mousedown', coords);
      const mouseUp = createMouseEvent('mouseup', coords);
      const click = createMouseEvent('click', coords);

      el.dispatchEvent(mouseDown);
      
      const delay = 50 + Math.random() * 100;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      el.dispatchEvent(mouseUp);
      el.dispatchEvent(click);
    }, coordinate);
  }

  /**
   * 计算元素内随机坐标
   * @private
   */
  async #computeCoordinate(element) {
    const box = await element.boundingBox();
    
    const offsetX = (Math.random() - 0.5) * Math.min(box.width * 0.1, 4);
    const offsetY = (Math.random() - 0.5) * Math.min(box.height * 0.1, 4);
    
    const x = box.width / 2 + offsetX;
    const y = box.height / 2 + offsetY;
    
    return { x, y };
  }

  /**
   * 记录任务日志
   */
  logTask(options) {
    eventEmitter.emit('RUN_TASK_LOG', {
      ...options,
      remark: this.#baseConfig.remark || '',
      serial: this.#baseConfig.serial || options.serial,
      containerCode: this.#baseConfig.containerCode || options.containerCode,
      timestamp: Date.now()
    });
  }

  /**
   * 抛出自定义错误
   */
  throwError({ message, logID }) {
    throw new CustomError({ message, logID });
  }
}

module.exports = TaskPublicService;
