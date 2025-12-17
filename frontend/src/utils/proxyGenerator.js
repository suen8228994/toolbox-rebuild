// src/utils/proxyGenerator.js
// IPMars 代理生成工具
// 格式: na.1c23e0905fcf5ae5.ipmars.vip:4900:anIpTP3cZa-zone-mars-region-US-st-michigan-city-grandrapids-session-hTkdemdC-sessTime-60:81388147

// IPMars 代理配置
const IPMARS_CONFIG = {
  host: 'na.1c23e0905fcf5ae5.ipmars.vip',
  port: 4900,
  prefix: 'rZwC7qlCe8',
  password: '52572596',
  zone: 'mars'
};

// 美国州和城市映射
const US_STATES = [
  { state: 'california', cities: ['losangeles', 'sanfrancisco', 'sandiego', 'sacramento'] },
  { state: 'texas', cities: ['houston', 'dallas', 'austin', 'sanantonio'] },
  { state: 'florida', cities: ['miami', 'tampa', 'orlando', 'jacksonville'] },
  { state: 'newyork', cities: ['newyork', 'buffalo', 'rochester', 'albany'] },
  { state: 'pennsylvania', cities: ['philadelphia', 'pittsburgh', 'allentown'] },
  { state: 'illinois', cities: ['chicago', 'aurora', 'naperville'] },
  { state: 'ohio', cities: ['columbus', 'cleveland', 'cincinnati'] },
  { state: 'georgia', cities: ['atlanta', 'augusta', 'columbus', 'savannah'] },
  { state: 'michigan', cities: ['detroit', 'grandrapids', 'warren'] },
  { state: 'washington', cities: ['seattle', 'spokane', 'tacoma'] }
];

// 生成随机会话ID
function generateSessionId() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let session = '';
  for (let i = 0; i < 8; i++) {
    session += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return session;
}

/**
 * 生成代理配置
 * @param {Object} options - 配置选项
 * @param {string} options.country - 国家代码（US, UK, CA等）
 * @param {number} options.quantity - 生成数量
 * @param {string} options.prefix - 用户名前缀
 * @param {string} options.password - 统一密码
 * @returns {Array<string>} 代理列表，格式：Host:Port:Username:Password
 */
function generateProxies(options = {}) {
  const {
    country = 'US',
    quantity = 1,
    prefix = 'rZwC7qlCe8',
    password = '52572596'
  } = options;
  
  const proxies = [];
  
  for (let i = 0; i < quantity; i++) {
    // 随机选择州和城市
    const stateData = US_STATES[Math.floor(Math.random() * US_STATES.length)];
    const city = stateData.cities[Math.floor(Math.random() * stateData.cities.length)];
    
    // 生成会话ID
    const sessionId = generateSessionId();
    
    // 构建用户名
    // 格式: anIpTP3cZa-zone-mars-region-US-st-michigan-city-grandrapids-session-hTkdemdC-sessTime-60
    const username = prefix + '-zone-' + IPMARS_CONFIG.zone + '-region-' + country + '-st-' + stateData.state + '-city-' + city + '-session-' + sessionId + '-sessTime-60';
    
    // 格式：Host:Port:Username:Password
    const proxyLine = IPMARS_CONFIG.host + ':' + IPMARS_CONFIG.port + ':' + username + ':' + password;
    proxies.push(proxyLine);
  }
  
  return proxies;
}

/**
 * 生成单个代理
 * @param {string} country - 国家代码
 * @param {string} prefix - 用户名前缀
 * @param {string} password - 密码
 * @returns {string} 代理字符串
 */
function generateSingleProxy(country = 'US', prefix = 'rZwC7qlCe8', password = '52572596') {
  const proxies = generateProxies({ country, quantity: 1, prefix, password });
  return proxies[0];
}

/**
 * 解析代理字符串
 * @param {string} proxyString - 代理字符串 (IP:Port:Username:Password)
 * @returns {Object} 解析后的代理对象
 */
function parseProxy(proxyString) {
  const [host, port, username, proxyPassword] = proxyString.split(':');
  return {
    host,
    port: parseInt(port),
    username,
    password: proxyPassword
  };
}

/**
 * 格式化代理列表为文本
 * @param {Array<string>} proxies - 代理列表
 * @returns {string} 格式化的文本
 */
function formatProxies(proxies) {
  return proxies.join('\n');
}

/**
 * 验证代理格式
 * @param {string} proxyString - 代理字符串
 * @returns {boolean} 是否有效
 */
function validateProxy(proxyString) {
  if (!proxyString) return false;
  const parts = proxyString.split(':');
  if (parts.length !== 4) return false;
  
  const [host, port, username, password] = parts;
  
  // 验证IP格式
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipRegex.test(host)) return false;
  
  // 验证端口
  const portNum = parseInt(port);
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) return false;
  
  // 验证用户名和密码不为空
  if (!username || !password) return false;
  
  return true;
}

/**
 * 获取支持的国家列表
 * @returns {Array<Object>} 国家列表
 */
function getSupportedCountries() {
  return [
    { code: 'US', name: '美国', flag: '🇺🇸' },
    { code: 'UK', name: '英国', flag: '🇬🇧' },
    { code: 'CA', name: '加拿大', flag: '🇨🇦' },
    { code: 'AU', name: '澳大利亚', flag: '🇦🇺' },
    { code: 'DE', name: '德国', flag: '🇩🇪' },
    { code: 'FR', name: '法国', flag: '🇫🇷' },
    { code: 'JP', name: '日本', flag: '🇯🇵' },
    { code: 'CN', name: '中国', flag: '🇨🇳' },
    { code: 'SG', name: '新加坡', flag: '🇸🇬' },
    { code: 'HK', name: '香港', flag: '🇭🇰' }
  ];
}

module.exports = {
  generateProxies,
  generateSingleProxy,
  parseProxy,
  formatProxies,
  validateProxy,
  getSupportedCountries
};
