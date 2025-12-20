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

    // 在每次页面加载或导航后检查是否出现登录提示页（auth prompt）
    const detect = async () => {
      try {
        const p = this.#page;
        if (!p) return;

        const exists = await p.locator('form[name="signIn"], #authportal-main-section, #authportal-center-section').count().then(c => c > 0).catch(() => false);
        if (exists) {
          this.logTask({ message: '检测到 Amazon 登录提示页', logID: 'RG-Info-Operate' });
          // 发布事件，供上层操作决定如何处理（是否自动填写密码并提交）
          eventEmitter.emit('AUTH_PROMPT_DETECTED', { page: p });
        }

        // Detect account-fixup phone collection page and try to click the "Not now" skip link
        const fixupExists = await p.locator('#ap-account-fixup-phone-skip-link, form#auth-account-fixup-phone-form').count().then(c => c > 0).catch(() => false);
        if (fixupExists && !p.__accountFixupSkipped) {
          try {
            this.logTask({ message: '检测到 Account Fixup (phone) 页面，尝试点击跳过', logID: 'RG-Info-Operate' });
            const skip = p.locator('#ap-account-fixup-phone-skip-link');
            if (await skip.count()) {
              await this.#createMouseEvent(skip);
              // mark as handled on this page to avoid repeated clicks
              try { p.__accountFixupSkipped = true; } catch (e) {}
              this.logTask({ message: '已尝试点击跳过绑定手机号', logID: 'RG-Info-Operate' });
            }
          } catch (e) {
            // ignore to avoid blocking main flows
          }
        }
      } catch (err) {
        // 不抛出错误，避免影响主流程
      }
    };

    // 触发一次以应对已经加载的页面
    detect();

    // 监听页面级加载与导航事件
    try {
      page.on('load', detect);
      page.on('framenavigated', detect);
    } catch (e) {
      // ignore if not supported in some environments
    }
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
