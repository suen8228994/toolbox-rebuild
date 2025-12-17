// src/utils/msGraphROPC.js
// Resource Owner Password Credentials (ROPC) Flow
// 使用用户名和密码直接获取 refresh_token

const axios = require("axios");

const DEFAULT_TENANT = "consumers";
const DEFAULT_SCOPE = "offline_access https://graph.microsoft.com/Mail.Read";

/**
 * 使用 ROPC 流程获取 refresh_token
 * 注意：ROPC 流程需要特殊配置，不是所有应用都支持
 * 
 * @param {Object} opts
 * @param {string} opts.clientId - Application (client) ID
 * @param {string} opts.username - 邮箱地址
 * @param {string} opts.password - 密码
 * @param {string} [opts.scope] - OAuth scope，默认 offline_access + Mail.Read
 * @param {string} [opts.tenant] - 租户，默认 "consumers"
 * @returns {Promise<{ email, clientId, refreshToken, tokenResponse, line }>}
 */
async function getTokenByPassword({
  clientId,
  username,
  password,
  scope = DEFAULT_SCOPE,
  tenant = DEFAULT_TENANT,
}) {
  if (!clientId || !username || !password) {
    throw new Error("getTokenByPassword: clientId, username, password 必填");
  }

  const url = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
  
  const body = new URLSearchParams({
    client_id: clientId,
    scope: scope,
    username: username,
    password: password,
    grant_type: "password",
  }).toString();

  try {
    const res = await axios.post(url, body, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 15000,
    });

    if (!res.data || !res.data.refresh_token) {
      throw new Error("响应中没有 refresh_token");
    }

    const refreshToken = res.data.refresh_token;
    const line = `${username}|${clientId}|${refreshToken}`;

    return {
      email: username,
      clientId,
      refreshToken,
      tokenResponse: res.data,
      line,
    };
  } catch (err) {
    // 处理特殊错误
    if (err.response && err.response.data) {
      const errorData = err.response.data;
      if (errorData.error === "invalid_grant") {
        throw new Error("账号或密码错误，或账号需要额外验证");
      }
      if (errorData.error === "unauthorized_client") {
        throw new Error("此应用不支持密码授权，请使用Device Code Flow");
      }
      throw new Error(`授权失败: ${errorData.error} - ${errorData.error_description || ""}`);
    }
    throw err;
  }
}

/**
 * 批量获取多个账号的 refresh_token
 * 
 * @param {Object} opts
 * @param {string} opts.clientId - Application (client) ID
 * @param {Array<{email, password}>} opts.accounts - 账号列表
 * @param {number} [opts.concurrency] - 并发数，默认 3
 * @param {string} [opts.scope] - OAuth scope
 * @param {Function} [opts.onProgress] - 进度回调 (current, total, result)
 * @returns {Promise<Array<{email, password, success, refreshToken?, error?}>>}
 */
async function batchGetTokens({
  clientId,
  accounts,
  concurrency = 3,
  scope = DEFAULT_SCOPE,
  onProgress,
}) {
  const results = [];
  const queue = [...accounts];
  let completed = 0;

  async function processOne() {
    while (queue.length > 0) {
      const account = queue.shift();
      if (!account) break;

      try {
        const result = await getTokenByPassword({
          clientId,
          username: account.email,
          password: account.password,
          scope,
        });

        const successResult = {
          email: account.email,
          password: account.password,
          success: true,
          refreshToken: result.refreshToken,
          tokenLine: result.line,
        };

        results.push(successResult);
        completed++;

        if (onProgress) {
          onProgress(completed, accounts.length, successResult);
        }
      } catch (err) {
        const failResult = {
          email: account.email,
          password: account.password,
          success: false,
          error: err.message,
        };

        results.push(failResult);
        completed++;

        if (onProgress) {
          onProgress(completed, accounts.length, failResult);
        }
      }

      // 添加延迟避免频率限制
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // 创建并发任务
  const workers = Array(Math.min(concurrency, accounts.length))
    .fill(null)
    .map(() => processOne());

  await Promise.all(workers);

  return results;
}

module.exports = {
  getTokenByPassword,
  batchGetTokens,
  DEFAULT_SCOPE,
  DEFAULT_TENANT,
};
