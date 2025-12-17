const fetch = require('node-fetch');

/**
 * RoxyBrowser API客户端
 * API文档: https://faq.roxybrowser.com/zh/api-documentation/api-endpoint
 */
class RoxyBrowserClient {
  constructor() {
    this.host = '127.0.0.1';
    this.port = 50000;
    this.token = 'ca66c0807cbd842e10b9a148cb38a747';
    this.baseUrl = `http://${this.host}:${this.port}`;
    this.workspaceId = null; // 延迟初始化
  }

  _buildHeaders() {
    return {
      'Content-Type': 'application/json',
      'token': this.token
    };
  }

  async _post(path, data = null) {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: this._buildHeaders(),
        body: data ? JSON.stringify(data) : null,
        timeout: 30000
      });
      return await response.json();
    } catch (error) {
      console.error(`RoxyBrowser POST ${path} 错误:`, error.message);
      throw error;
    }
  }

  async _get(path, params = null) {
    try {
      let url = `${this.baseUrl}${path}`;
      if (params) {
        const queryString = Object.entries(params)
          .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
          .join('&');
        url = `${url}?${queryString}`;
      }
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this._buildHeaders(),
        timeout: 30000
      });
      return await response.json();
    } catch (error) {
      console.error(`RoxyBrowser GET ${path} 错误:`, error.message);
      throw error;
    }
  }

  /**
   * 初始化：获取工作空间ID
   */
  async initialize() {
    if (this.workspaceId) return this.workspaceId;
    
    const result = await this._get('/browser/workspace');
    if (result.code === 0 && result.data && result.data.rows && result.data.rows.length > 0) {
      this.workspaceId = result.data.rows[0].id;
      console.log(`✅ RoxyBrowser初始化成功，工作空间ID: ${this.workspaceId}`);
      return this.workspaceId;
    }
    
    throw new Error('无法获取RoxyBrowser工作空间');
  }

  /**
   * 创建浏览器窗口
   * @param {Object} profile - 窗口配置
   * @param {string} profile.windowName - 窗口名称
   * @param {Object} profile.proxyInfo - 代理配置
   * @returns {Promise<Object>} 返回 {dirId, ...}
   */
  async createProfile(profile = {}) {
    await this.initialize();
    
    const data = {
      workspaceId: this.workspaceId,
      windowName: profile.windowName || `Hotmail_${Date.now()}`,
      coreVersion: '117',
      os: 'Windows',
      osVersion: '11',
      proxyInfo: profile.proxyInfo || {
        proxyMethod: 'custom',
        proxyCategory: 'noproxy'
      },
      fingerInfo: {
        randomFingerprint: false,
        clearCacheFile: true,
        clearCookie: true,
        clearLocalStorage: true,
        ignoreCertificateErrors: true  // 忽略 SSL 证书错误
      },
      syncTab: false,
      syncCookie: false,
      portScanProtect: false
    };

    const result = await this._post('/browser/create', data);
    if (result.code === 0 && result.data && result.data.dirId) {
      console.log(`✅ 创建窗口成功: ${result.data.dirId}`);
      return result.data;
    }
    
    throw new Error(`创建窗口失败: ${result.msg}`);
  }

  /**
   * 打开浏览器窗口
   * @param {string} dirId - 窗口ID
   * @returns {Promise<Object>} 返回 {ws, http, driver, ...}
   */
  async openProfile(dirId) {
    const result = await this._post('/browser/open', {
      workspaceId: this.workspaceId,
      dirId,
      args: []
    });

    if (result.code === 0 && result.data && result.data.ws) {
      console.log(`✅ 打开窗口成功: ${dirId}`);
      console.log(`   WebSocket: ${result.data.ws}`);
      return result.data;
    }
    
    throw new Error(`打开窗口失败: ${result.msg}`);
  }

  /**
   * 关闭浏览器窗口
   * @param {string} dirId - 窗口ID
   */
  async closeProfile(dirId) {
    const result = await this._post('/browser/close', { dirId });
    if (result.code === 0) {
      console.log(`✅ 关闭窗口成功: ${dirId}`);
      return true;
    }
    
    console.warn(`关闭窗口失败: ${result.msg}`);
    return false;
  }

  /**
   * 删除浏览器窗口
   * @param {string} dirId - 窗口ID
   */
  async deleteProfile(dirId) {
    await this.initialize();
    
    const result = await this._post('/browser/delete', {
      workspaceId: this.workspaceId,
      dirIds: [dirId]
    });

    if (result.code === 0) {
      console.log(`✅ 删除窗口成功: ${dirId}`);
      return true;
    }
    
    console.warn(`删除窗口失败: ${result.msg}`);
    return false;
  }

  /**
   * 生成代理配置
   * @returns {Promise<Object>} 代理配置对象
   */
  async generateProxy() {
    // TODO: 从程序中的"生成代理"功能获取
    // 这里先返回空代理，需要集成实际的代理生成逻辑
    return {
      proxyMethod: 'custom',
      proxyCategory: 'noproxy'
    };
  }
}

// 导出单例
const roxyClient = new RoxyBrowserClient();

module.exports = {
  RoxyBrowserClient,
  roxyClient
};
