/**
 * IP2Location 验证工具
 * 用于在打开浏览器窗口前验证代理 IP 是否有效
 */

const axios = require('axios');

/**
 * 通过 IP2Location API 验证 IP 地址
 * @param {string} ip - 要验证的 IP 地址
 * @param {number} timeout - 超时时间（毫秒），默认 5000ms
 * @returns {Promise<Object>} 验证结果
 */
async function validateIP(ip, timeout = 5000) {
  try {
    console.log(`[IP2Location] 开始验证 IP: ${ip}`);
    
    // 使用 ip-api.com 的免费 API（不需要密钥）
    // 备用方案：ipapi.co, ipinfo.io
    const response = await axios.get(`http://ip-api.com/json/${ip}`, {
      timeout: timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const data = response.data;
    
    // ip-api.com 返回格式：
    // {
    //   "status": "success" | "fail",
    //   "country": "United States",
    //   "countryCode": "US",
    //   "region": "CA",
    //   "regionName": "California",
    //   "city": "Los Angeles",
    //   "zip": "90001",
    //   "lat": 34.0522,
    //   "lon": -118.2437,
    //   "timezone": "America/Los_Angeles",
    //   "isp": "Google LLC",
    //   "org": "Google Cloud",
    //   "as": "AS15169 Google LLC",
    //   "query": "8.8.8.8"
    // }
    
    if (data.status === 'success') {
      console.log(`[IP2Location] ✅ IP 验证成功`);
      console.log(`[IP2Location]    国家: ${data.country} (${data.countryCode})`);
      console.log(`[IP2Location]    地区: ${data.regionName}`);
      console.log(`[IP2Location]    城市: ${data.city}`);
      console.log(`[IP2Location]    ISP: ${data.isp}`);
      
      return {
        valid: true,
        ip: data.query,
        country: data.country,
        countryCode: data.countryCode,
        region: data.regionName,
        city: data.city,
        isp: data.isp,
        org: data.org,
        timezone: data.timezone
      };
    } else {
      console.error(`[IP2Location] ❌ IP 验证失败: ${data.message || 'Unknown error'}`);
      return {
        valid: false,
        ip: ip,
        error: data.message || 'IP validation failed'
      };
    }
    
  } catch (error) {
    console.error(`[IP2Location] ❌ IP 验证异常:`, error.message);
    
    // 网络错误或超时，返回失败
    return {
      valid: false,
      ip: ip,
      error: error.message
    };
  }
}

/**
 * 从代理字符串中提取 IP 地址
 * @param {string} proxyString - 代理字符串（支持多种格式）
 * @returns {string|null} IP 地址，如果提取失败返回 null
 */
function extractIPFromProxy(proxyString) {
  if (!proxyString || typeof proxyString !== 'string') {
    return null;
  }
  
  try {
    // 格式1: host:port:username:password
    // 格式2: http://user:pass@host:port
    // 格式3: socks5://user:pass@host:port
    
    let host = null;
    
    if (proxyString.includes('://')) {
      // URL 格式
      const url = new URL(proxyString);
      host = url.hostname;
    } else {
      // 冒号分隔格式
      const parts = proxyString.split(':');
      if (parts.length >= 2) {
        host = parts[0];
      }
    }
    
    // 验证是否是有效的 IP 地址或域名
    if (host && (isValidIP(host) || isValidDomain(host))) {
      return host;
    }
    
    return null;
  } catch (error) {
    console.error('[IP2Location] 提取 IP 失败:', error.message);
    return null;
  }
}

/**
 * 验证是否是有效的 IPv4 地址
 */
function isValidIP(str) {
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipRegex.test(str)) return false;
  
  const parts = str.split('.');
  return parts.every(part => {
    const num = parseInt(part);
    return num >= 0 && num <= 255;
  });
}

/**
 * 验证是否是有效的域名
 */
function isValidDomain(str) {
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-_.]+[a-zA-Z0-9]$/;
  return domainRegex.test(str) && str.length <= 253;
}

/**
 * 通过代理获取外部 IP（用于验证代理是否工作）
 * @param {string} proxyString - 代理字符串
 * @returns {Promise<string|null>} 外部 IP 地址，失败返回 null
 */
async function getExternalIPThroughProxy(proxyString) {
  try {
    // 解析代理配置
    let proxyConfig = {};
    
    if (proxyString.includes('://')) {
      const url = new URL(proxyString);
      proxyConfig = {
        host: url.hostname,
        port: parseInt(url.port),
        auth: url.username ? {
          username: url.username,
          password: url.password
        } : undefined
      };
    } else {
      const parts = proxyString.split(':');
      proxyConfig = {
        host: parts[0],
        port: parseInt(parts[1]),
        auth: parts.length >= 4 ? {
          username: parts[2],
          password: parts[3]
        } : undefined
      };
    }
    
    // 通过代理请求 IP 查询服务
    const response = await axios.get('https://api.ipify.org?format=json', {
      proxy: proxyConfig,
      timeout: 10000
    });
    
    return response.data.ip;
    
  } catch (error) {
    console.error('[IP2Location] 通过代理获取 IP 失败:', error.message);
    return null;
  }
}

module.exports = {
  validateIP,
  extractIPFromProxy,
  getExternalIPThroughProxy,
  isValidIP,
  isValidDomain
};
