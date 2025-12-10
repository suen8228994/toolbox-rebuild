const axios = require("axios");

const BASE_URL = "http://api1.5sim.net/stubs/handler_api.php";

/**
 * 调用 5SIM API1 的 getNumber，返回 { id, phone, apiUrl, line }
 * @param {Object} opts
 * @param {string} opts.apiKey   API1 协议的 api_key（注意不是 JWT）
 * @param {string|number} opts.country 国家名或编号，例如 "usa" / "england" / 0
 * @param {string} opts.service  服务代号，如 "amazon", "other", "ot"
 * @param {string} [opts.operator]  运营商，默认 "any"
 * @param {number} [opts.forward]   是否开启转接，默认 0
 */
async function buyNumberAndBuildConfig(opts) {
  const {
    apiKey,
    country,
    service,
    operator = "any",
    forward = 0
  } = opts;

  if (!apiKey) {
    throw new Error("请先填写 API1 协议的 api_key");
  }
  if (!service) {
    throw new Error("请填写 service（产品代号），例如 amazon / other 等");
  }

  const res = await axios.get(BASE_URL, {
    params: {
      api_key: apiKey,
      action: "getNumber",
      service,
      forward,
      operator,
      country
    },
    responseType: "text",
    timeout: 15000
  });

  const text = String(res.data || "").trim();

  if (!text.startsWith("ACCESS_NUMBER")) {
    // 常见错误：NO_NUMBERS / NO_BALANCE / BAD_ACTION / BAD_KEY / BAD_SERVICE
    throw new Error("5sim 返回错误: " + text);
  }

  // 文档格式：ACCESS_NUMBER:$id:$number
  const parts = text.split(":");
  if (parts.length < 3) {
    throw new Error("解析 ACCESS_NUMBER 失败: " + text);
  }

  const id = parts[1];
  const phone = parts[2];

  // 拼你的脚本用的查询验证码 URL
  const apiUrl =
    `${BASE_URL}?api_key=${encodeURIComponent(apiKey)}` +
    `&action=getStatus&id=${encodeURIComponent(id)}`;

  // 最终给你的工具用的一行（你可以按自己格式调整）
  const line = `+${phone}----${apiUrl}`;

  return {
    id,
    phone,
    apiUrl,
    line,
    raw: text
  };
}

module.exports = {
  buyNumberAndBuildConfig
};
