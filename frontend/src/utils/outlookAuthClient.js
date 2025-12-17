// outlookAuthClient.js
// 简单的 Outlook / Microsoft 账号 Device Code 授权工具类
// 适合 Electron / Node 环境使用

const axios = require("axios");
const qs = require("qs");

class OutlookAuthClient {
  /**
   * @param {Object} options
   * @param {string} options.clientId - Azure 应用的 client_id
   * @param {string} [options.tenant] - authority 租户：consumers / common / organizations
   * @param {string[]} [options.scopes] - 需要的权限 scope
   */
  constructor(options = {}) {
    this.clientId =
      options.clientId ||
      "4ef1dfe5-98e5-48e9-bbb3-fc4984a8c489"; // 你的 client_id

    // 你主要用个人 Outlook，就先用 consumers
    this.tenant = options.tenant || "consumers";

    // 常用 scope：登录 + 刷新 + 读写邮箱
    this.scopes =
      options.scopes || [
        "openid",
        "profile",
        "offline_access",
        "Mail.Read",
        "Mail.ReadWrite",
      ];
  }

  get deviceCodeEndpoint() {
    return `https://login.microsoftonline.com/${this.tenant}/oauth2/v2.0/devicecode`;
  }

  get tokenEndpoint() {
    return `https://login.microsoftonline.com/${this.tenant}/oauth2/v2.0/token`;
  }

  /**
   * 第一步：获取 device_code / user_code
   * 调用后，把返回的 verificationUri + userCode 提示给用户去浏览器输入
   *
   * @returns {Promise<{
   *   deviceCode: string;
   *   userCode: string;
   *   verificationUri: string;
   *   expiresIn: number;
   *   interval: number;
   *   message: string;
   * }>}
   */
  async startDeviceLogin() {
    const data = qs.stringify({
      client_id: this.clientId,
      scope: this.scopes.join(" "),
    });

    const resp = await axios.post(this.deviceCodeEndpoint, data, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    return {
      deviceCode: resp.data.device_code,
      userCode: resp.data.user_code,
      verificationUri:
        resp.data.verification_uri || resp.data.verification_uri_complete,
      expiresIn: resp.data.expires_in,
      interval: resp.data.interval || 5,
      message: resp.data.message,
    };
  }

  /**
   * 第二步：轮询 token，直到授权成功或失败
   *
   * @param {string} deviceCode  startDeviceLogin 返回的 deviceCode
   * @param {number} intervalSec 建议用返回的 interval，一般 5 秒
   * @param {number} [timeoutSec] 最大等待时间，默认 900 秒（15 分钟）
   * @returns {Promise<{
   *   accessToken: string;
   *   refreshToken: string;
   *   expiresIn: number;
   *   idToken?: string;
   *   raw: any;
   * }>}
   */
  async pollForToken(deviceCode, intervalSec, timeoutSec = 900) {
    const startedAt = Date.now();

    while (true) {
      if (Date.now() - startedAt > timeoutSec * 1000) {
        throw new Error("Device code 授权超时（本地超时控制）");
      }

      try {
        const data = qs.stringify({
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          client_id: this.clientId,
          device_code: deviceCode,
        });

        const resp = await axios.post(this.tokenEndpoint, data, {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });

        // 成功拿到 token
        if (resp.data.access_token) {
          return {
            accessToken: resp.data.access_token,
            refreshToken: resp.data.refresh_token,
            expiresIn: resp.data.expires_in,
            idToken: resp.data.id_token,
            raw: resp.data,
          };
        }
      } catch (err) {
        const data = err.response && err.response.data;

        if (!data) {
          throw err;
        }

        // 典型轮询中的几个错误：
        // authorization_pending: 用户还没在网页上完成登录
        // authorization_declined: 用户拒绝
        // expired_token: device_code 过期（这时就别继续轮询了）
        if (data.error === "authorization_pending") {
          await this.sleep(intervalSec * 1000);
          continue;
        }

        if (data.error === "authorization_declined") {
          throw new Error("用户在网页上拒绝授权");
        }

        if (data.error === "expired_token") {
          throw new Error("device_code 已过期，请重新开始授权流程");
        }

        if (data.error === "bad_verification_code") {
          throw new Error("验证码错误或已失效");
        }

        // 其他错误直接抛出去
        throw new Error(
          data.error_description || data.error || "获取 token 失败"
        );
      }

      await this.sleep(intervalSec * 1000);
    }
  }

  /**
   * 用 refresh_token 刷新 access_token
   *
   * @param {string} refreshToken
   * @returns {Promise<{
   *   accessToken: string;
   *   refreshToken: string;
   *   expiresIn: number;
   *   idToken?: string;
   *   raw: any;
   * }>}
   */
  async refreshWithToken(refreshToken) {
    const data = qs.stringify({
      grant_type: "refresh_token",
      client_id: this.clientId,
      refresh_token: refreshToken,
      scope: this.scopes.join(" "),
    });

    const resp = await axios.post(this.tokenEndpoint, data, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    return {
      accessToken: resp.data.access_token,
      refreshToken: resp.data.refresh_token || refreshToken, // 有的不会返回新的
      expiresIn: resp.data.expires_in,
      idToken: resp.data.id_token,
      raw: resp.data,
    };
  }

  /**
   * 简单示例：用 access_token 读取当前用户信息
   *
   * @param {string} accessToken
   */
  async getMe(accessToken) {
    const resp = await axios.get("https://graph.microsoft.com/v1.0/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return resp.data;
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = {
  OutlookAuthClient,
  // 默认实例（直接用也行）
  outlookAuthClient: new OutlookAuthClient(),
};
