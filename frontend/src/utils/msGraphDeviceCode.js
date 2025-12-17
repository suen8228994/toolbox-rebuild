// src/utils/msGraphDeviceCode.js
// 适用于 Outlook/Hotmail 等个人账号，tenant 固定用 "consumers"

const axios = require("axios");

const DEFAULT_TENANT = "consumers";
const DEFAULT_SCOPE = "offline_access https://graph.microsoft.com/Mail.Read";

/**
 * 第一步：请求 device code
 * @param {Object} opts
 * @param {string} opts.clientId - Application (client) ID
 * @param {string} [opts.scope]  - OAuth scope，默认 offline_access + Mail.Read
 * @param {string} [opts.tenant] - 租户，默认 "consumers"
 * @returns {Promise<object>}    - 返回微软原始的 device code 响应对象
 */
async function startDeviceCodeFlow({
  clientId,
  scope = DEFAULT_SCOPE,
  tenant = DEFAULT_TENANT,
}) {
  if (!clientId) {
    throw new Error("startDeviceCodeFlow: clientId 必填");
  }

  const url = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/devicecode`;
  const body = new URLSearchParams({
    client_id: clientId,
    scope,
  }).toString();

  const res = await axios.post(url, body, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 15000,
  });

  // 返回的数据大概包含：
  // device_code, user_code, verification_uri, expires_in, interval, message ...
  return res.data;
}

/**
 * 第二步：轮询 token，直到拿到 refresh_token
 * @param {Object} opts
 * @param {string} opts.clientId    - Application (client) ID
 * @param {string} opts.deviceCode  - 第一步返回的 device_code
 * @param {string} [opts.tenant]    - 租户，默认 "consumers"
 * @param {number} [opts.interval]  - 建议轮询间隔（秒），默认 5
 * @param {number} [opts.expiresIn] - device code 过期时间（秒），可选
 * @param {string} [opts.email]     - 这个 refresh_token 对应的邮箱，只用于返回 line 时拼接
 * @returns {Promise<{ email:string|undefined, clientId:string, refreshToken:string, tokenResponse:object, line:string }>}
 */
async function pollForRefreshToken({
  clientId,
  deviceCode,
  tenant = DEFAULT_TENANT,
  interval = 5,
  expiresIn,
  email,
}) {
  if (!clientId || !deviceCode) {
    throw new Error("pollForRefreshToken: clientId 和 deviceCode 必填");
  }

  const url = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
  const startTime = Date.now();
  const pollIntervalMs = Math.max(4000, interval * 1000);

  while (true) {
    // 超时检测（可选）
    if (expiresIn && Date.now() - startTime > expiresIn * 1000) {
      const err = new Error("device code 已过期，请重新获取");
      err.code = "DEVICE_CODE_EXPIRED";
      throw err;
    }

    // 等待一段时间再轮询
    await new Promise((r) => setTimeout(r, pollIntervalMs));

    try {
      const body = new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        client_id: clientId,
        device_code: deviceCode,
      }).toString();

      const res = await axios.post(url, body, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 15000,
      });

      // 如果还是在等待用户同意
      if (res.data && res.data.error) {
        const errCode = res.data.error;
        if (errCode === "authorization_pending" || errCode === "slow_down") {
          // 继续下一轮
          continue;
        }
        const err = new Error("token 错误: " + errCode);
        err.details = res.data;
        throw err;
      }

      const refreshToken = res.data.refresh_token;
      if (!refreshToken) {
        const err = new Error("响应中没有 refresh_token");
        err.details = res.data;
        throw err;
      }

      const line = `${email || ""}|${clientId}|${refreshToken}`;

      return {
        email,
        clientId,
        refreshToken,
        tokenResponse: res.data,
        line,
      };
    } catch (e) {
      // 处理 authorization_pending / slow_down 之外的错误
      if (
        e.response &&
        e.response.data &&
        e.response.data.error &&
        (e.response.data.error === "authorization_pending" ||
          e.response.data.error === "slow_down")
      ) {
        continue;
      }
      throw e;
    }
  }
}

module.exports = {
  startDeviceCodeFlow,
  pollForRefreshToken,
  DEFAULT_SCOPE,
  DEFAULT_TENANT,
};
