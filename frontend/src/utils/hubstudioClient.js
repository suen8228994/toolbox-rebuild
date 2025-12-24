/**
 * HubStudio API客户端
 * 文档: https://support.hubstudio.cn/0379/7beb/fbb0/6964
 */

const fetch = require('node-fetch');

class HubStudioClient {
  constructor(baseUrl = 'http://127.0.0.1:6873', appId = '', appSecret = '') {
    this.baseUrl = baseUrl;
    this.appId = appId;
    this.appSecret = appSecret;
    this.groupCode = ''; // 团队code，需要从设置中获取
  }

  /**
   * 打开环境（启动浏览器）
   * @param {Object} options - 启动选项
   * @param {string} options.containerCode - 环境ID（必传）
   * @param {boolean} options.isHeadless - 无头模式，默认false
   * @param {boolean} options.isWebDriverReadOnlyMode - 只读模式，默认false
   * @param {Array<string>} options.containerTabs - 启动URL数组
   * @param {Array<string>} options.args - 启动参数数组，例如 ["--kiosk", "--start-maximized"]
   * @param {boolean} options.cdpHide - 是否屏蔽cdp检测，默认false
   * @param {float} options.pageZoom - 页面缩放比例，例如 1.5 表示 150%
   * @returns {Promise<Object>} 返回浏览器信息，包含 debuggingPort 等
   */
  async startBrowser(options) {
    const {
      containerCode,
      isHeadless = false,
      isWebDriverReadOnlyMode = false,
      containerTabs = [],
      args = [],
      cdpHide = false,
      pageZoom = 1.0
    } = options;

    if (!containerCode) {
      throw new Error('containerCode is required');
    }

    const url = `${this.baseUrl}/api/v1/browser/start`;
    const body = {
      containerCode,
      isHeadless,
      isWebDriverReadOnlyMode
    };

    // 添加可选参数
    if (containerTabs && containerTabs.length > 0) {
      body.containerTabs = containerTabs;
    }

    if (args && args.length > 0) {
      body.args = args;
    }

    if (cdpHide) {
      body.cdpHide = cdpHide;
    }

    if (pageZoom && pageZoom !== 1.0) {
      body.pageZoom = pageZoom;
    }

    console.log('[HubStudio] 启动浏览器请求:', JSON.stringify(body, null, 2));

    try {
      // 设置60秒超时
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const result = await response.json();

      if (result.code !== 0) {
        const errorMsg = this.getErrorMessage(result.code);
        throw new Error(`HubStudio API Error [${result.code}]: ${errorMsg} - ${result.msg}`);
      }

      console.log('[HubStudio] 浏览器启动成功:', {
        browserID: result.data.browserID,
        debuggingPort: result.data.debuggingPort,
        ip: result.data.ip,
        proxyType: result.data.proxyType
      });

      return result.data;
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error('[HubStudio] 启动浏览器超时（60秒）');
        throw new Error('启动浏览器超时，请检查HubStudio客户端是否正常运行');
      }
      console.error('[HubStudio] 启动浏览器失败:', error);
      throw error;
    }
  }

  /**
   * 关闭环境
   * @param {string} containerCode - 环境ID
   * @returns {Promise<Object>}
   */
  async stopBrowser(containerCode) {
    if (!containerCode) {
      throw new Error('containerCode is required');
    }

    const url = `${this.baseUrl}/api/v1/browser/stop`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ containerCode })
      });

      const result = await response.json();

      if (result.code !== 0) {
        throw new Error(`HubStudio API Error [${result.code}]: ${result.msg}`);
      }

      console.log('[HubStudio] 浏览器已关闭:', containerCode);
      return result.data;
    } catch (error) {
      console.error('[HubStudio] 关闭浏览器失败:', error);
      throw error;
    }
  }

  /**
   * 获取浏览器状态
   * @param {Array<string>} containerCodes - 环境ID数组
   * @returns {Promise<Object>} 状态: 0-已开启, 1-开启中, 2-关闭中, 3-已关闭
   */
  async getBrowserStatus(containerCodes) {
    const url = `${this.baseUrl}/api/v1/browser/all-browser-status`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ containerCodes: containerCodes || [] })
      });

      const result = await response.json();
      
      console.log('[HubStudio] getBrowserStatus 原始响应:', JSON.stringify(result, null, 2));

      // HubStudio API有两种返回格式:
      // 1. 标准格式: { code: 0, data: {...} }
      // 2. 旧格式: { statusCode: "0", containers: [...], err: "成功", action: "..." }
      
      if (result.statusCode !== undefined) {
        // 旧格式
        if (result.statusCode !== "0" && result.statusCode !== 0) {
          throw new Error(`HubStudio API Error: ${result.err}`);
        }
        return result; // 返回完整对象，包含 containers 字段
      } else if (result.code !== undefined) {
        // 标准格式
        if (result.code !== 0) {
          throw new Error(`HubStudio API Error [${result.code}]: ${result.msg}`);
        }
        return result.data;
      } else {
        throw new Error('Unknown HubStudio API response format');
      }
    } catch (error) {
      console.error('[HubStudio] 获取浏览器状态失败:', error);
      throw error;
    }
  }

  /**
   * 浏览器窗口自定义排列
   * @param {Object} options - 排列选项
   * @param {number} options.x - 起始位置x坐标，默认10
   * @param {number} options.y - 起始位置y坐标，默认10
   * @param {number} options.width - 窗口宽度，默认600
   * @param {number} options.height - 窗口高度，默认500
   * @param {number} options.gapX - 窗口横向间距，默认20
   * @param {number} options.gapY - 窗口纵向间距，默认20
   * @param {number} options.colNum - 每行展示窗口数量，默认3
   * @param {number} options.screenId - 屏幕id
   * @returns {Promise<Object>}
   */
  async arrangeBrowserWindows(options = {}) {
    const url = `${this.baseUrl}/api/v1/browser/arrange`;
    
    const body = {
      x: options.x || 10,
      y: options.y || 10,
      width: options.width || 600,
      height: options.height || 500,
      gapX: options.gapX || 20,
      gapY: options.gapY || 20,
      colNum: options.colNum || 3
    };

    if (options.screenId) {
      body.screenId = options.screenId;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const result = await response.json();

      if (result.code !== 0) {
        throw new Error(`HubStudio API Error [${result.code}]: ${result.msg}`);
      }

      console.log('[HubStudio] 窗口排列成功');
      return result.data;
    } catch (error) {
      console.error('[HubStudio] 窗口排列失败:', error);
      throw error;
    }
  }

  /**
   * 关闭所有环境
   * @param {boolean} clearOpening - 是否清空启动环境队列
   * @returns {Promise<Object>}
   */
  async stopAllBrowsers(clearOpening = false) {
    const url = `${this.baseUrl}/api/v1/browser/stop-all`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ clearOpening })
      });

      const result = await response.json();

      if (result.code !== 0) {
        throw new Error(`HubStudio API Error [${result.code}]: ${result.msg}`);
      }

      console.log('[HubStudio] 所有浏览器已关闭');
      return result.data;
    } catch (error) {
      console.error('[HubStudio] 关闭所有浏览器失败:', error);
      throw error;
    }
  }

  /**
   * 切换浏览器窗口（置顶显示）
   * @param {string} containerCode - 环境ID
   * @returns {Promise<Object>}
   */
  async focusBrowser(containerCode) {
    const url = `${this.baseUrl}/api/v1/browser/foreground`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ containerCode })
      });

      const result = await response.json();

      if (result.code !== 0) {
        throw new Error(`HubStudio API Error [${result.code}]: ${result.msg}`);
      }

      return result.data;
    } catch (error) {
      console.error('[HubStudio] 切换窗口失败:', error);
      throw error;
    }
  }

  /**
   * 创建环境
   * @param {Object} options - 创建选项
   * @param {string} options.name - 环境名称
   * @param {string} options.platform - 平台 'chrome' 或 'firefox'
   * @param {string} options.proxyType - 代理类型: 'noproxy', 'http', 'https', 'socks5'
   * @param {Object} options.proxyConfig - 代理配置
   * @param {Object} options.fingerprint - 指纹配置
   * @returns {Promise<Object>} 返回创建的环境信息，包含 containerCode
   */
  async createContainer(options = {}) {
    // HubStudio 官方 API 路径：https://support-orig.hubstudio.cn/0379/7beb/fbb0/8e65
    const url = `${this.baseUrl}/api/v1/env/create`;
    
    console.log('[HubStudio] createContainer 收到的 options:', JSON.stringify(options, null, 2));
    
    const body = {
      containerName: options.containerName || options.name || `Amazon-${Date.now()}`,
      asDynamicType: options.asDynamicType || 0,
      proxyTypeName: options.proxyTypeName || options.proxyType || '不使用代理',
      remark: options.remark || '',
      tagName: options.tagName || ''
      // 不设置 coreVersion，让 HubStudio 使用默认最新版本
    };
    
    // 添加代理配置字段（注意：HubStudio API 使用 proxyServer 而非 proxyHost）
    if (options.proxyServer || options.proxyHost) {
      const server = options.proxyServer || options.proxyHost;
      console.log('[HubStudio] 添加 proxyServer:', server);
      body.proxyServer = server;
    }
    if (options.proxyPort) {
      console.log('[HubStudio] 添加 proxyPort:', options.proxyPort);
      body.proxyPort = options.proxyPort;
    }
    if (options.proxyAccount) {
      console.log('[HubStudio] 添加 proxyAccount:', options.proxyAccount);
      body.proxyAccount = options.proxyAccount;
    }
    if (options.proxyPassword) {
      console.log('[HubStudio] 添加 proxyPassword:', options.proxyPassword);
      body.proxyPassword = options.proxyPassword;
    }
    
    // 如果用户明确指定了其他参数，添加到 body
    if (options.coreVersion) body.coreVersion = options.coreVersion;
    if (options.advancedBo) body.advancedBo = options.advancedBo;
    if (options.cookie) body.cookie = options.cookie;

    console.log('[HubStudio] 最终请求体:', JSON.stringify(body, null, 2));
    console.log('[HubStudio] 创建环境请求:', JSON.stringify(body, null, 2));

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const result = await response.json();
      console.log('[HubStudio] 创建环境响应:', JSON.stringify(result, null, 2));

      // 检查多种可能的响应格式
      if (result.code !== undefined && result.code !== 0) {
        const errorMsg = this.getErrorMessage(result.code);
        throw new Error(`HubStudio API Error [${result.code}]: ${errorMsg} - ${result.msg}`);
      }
      
      if (result.statusCode !== undefined && result.statusCode !== "0" && result.statusCode !== 0) {
        throw new Error(`HubStudio API Error: ${result.err || result.message}`);
      }

      console.log('[HubStudio] 环境创建成功:', result.data || result);
      return result.data || result;
    } catch (error) {
      console.error('[HubStudio] 创建环境失败:', error);
      throw error;
    }
  }

  /**
   * 删除环境
   * @param {string} containerCode - 环境ID
   * @returns {Promise<Object>}
   */
  async deleteContainer(containerCode) {
    if (!containerCode) {
      throw new Error('containerCode is required');
    }

    const url = `${this.baseUrl}/api/v1/env/del`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ containerCodes: [containerCode] }) // 官方文档要求数组格式
      });

      const result = await response.json();

      if (result.code !== 0) {
        throw new Error(`HubStudio API Error [${result.code}]: ${result.msg}`);
      }

      console.log('[HubStudio] 环境已删除:', containerCode);
      return result.data;
    } catch (error) {
      console.error('[HubStudio] 删除环境失败:', error);
      throw error;
    }
  }

  /**
   * 更新环境信息（例如备注）
   * @param {Object} options - 更新选项
   * @param {string} options.containerCode - 环境ID
   * @param {string} options.remark - 备注内容
   * @returns {Promise<Object>}
   */
  async updateContainer(options = {}) {
    const { containerCode, remark } = options;

    if (!containerCode) {
      throw new Error('containerCode is required');
    }

    // Use documented batch-update-remark endpoint (v3.37+)
    const url = `${this.baseUrl}/api/v1/container/batch-update-remark`;

    // API expects containerCodes array and type (1=overwrite,2=append)
    const body = {
      containerCodes: [containerCode],
      remark: remark || '',
      type: Number.isInteger(options && options.type) ? options.type : 1
    };

    // allow caller to pass coreVersion to target specific client core
    if (options && options.coreVersion) body.coreVersion = options.coreVersion;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const result = await response.json();
      console.log('[HubStudio] batch-update-remark 响应:', JSON.stringify(result, null, 2));

      // Expected shape: { code: 0, data: true, message: '', success: true }
      if (result.code !== undefined && result.code !== 0) {
        throw new Error(`HubStudio API Error [${result.code}]: ${result.msg || result.message}`);
      }

      if (result.success === false) {
        throw new Error(`HubStudio API indicated failure: ${JSON.stringify(result)}`);
      }

      return result.data || result;
    } catch (error) {
      console.error('[HubStudio] 更新环境备注失败:', error);
      throw error;
    }
  }

  /**
   * 兼容方法：部分代码调用 destroyContainer，提供别名以调用 deleteContainer
   */
  async destroyContainer(containerCode) {
    return this.deleteContainer(containerCode);
  }

  /**
   * 获取错误信息
   * @param {number} code - 错误码
   * @returns {string} 错误描述
   */
  getErrorMessage(code) {
    const errorMessages = {
      0: '成功',
      5: '初始化代理失败',
      7: '启动内核失败',
      15: '获取openDetail参数失败',
      17: '容器正在被占用',
      18: '取消',
      20: '不可打开状态',
      21: '获取ip超时',
      22: '转换userAgent失败',
      24: 'openDetail超时',
      25: '获取磁盘信息失败',
      26: 'API免费版本不支持',
      27: '环境打开次数超过限制',
      '-10000': '未知异常',
      '-10003': '登录失败',
      '-10004': '未找到环境信息，请检查环境ID是否正确',
      '-10005': '该店铺上次请求的startBrowser还未执行结束',
      '-10007': '内核不存在，请手动打开客户端下载',
      '-10008': '系统资源不足',
      '-10011': '环境不存在或未开启，请检查环境ID是否正确',
      '-10012': '插件ID列表不能为空',
      '-10013': '环境正在运行',
      '-10014': 'IPC超时',
      '-10015': '数据获取失败，请勿过于频繁操作，或检查网络环境后重试',
      '-10016': '内核版本过低，本客户端不允许打开',
      '-10017': '当前Firefox内核的环境无法通过API打开',
      '-10018': '下载内核失败'
    };

    return errorMessages[code] || errorMessages[String(code)] || '未知错误';
  }
}

module.exports = HubStudioClient;
