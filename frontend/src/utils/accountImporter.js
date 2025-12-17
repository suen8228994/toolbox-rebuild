// src/utils/accountImporter.js
// 邮箱账号导入工具

const fs = require('fs');
const path = require('path');

/**
 * 从文件导入账号
 * @param {string} filePath - 文件路径
 * @param {string} format - 格式 (txt/csv/json)
 * @returns {Array<{email: string, password: string}>}
 */
function importAccountsFromFile(filePath, format = 'txt') {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    switch (format) {
      case 'txt':
        return parseTxtFormat(content);
      case 'csv':
        return parseCsvFormat(content);
      case 'json':
        return parseJsonFormat(content);
      default:
        throw new Error('不支持的格式');
    }
  } catch (error) {
    console.error('导入账号失败:', error);
    throw error;
  }
}

/**
 * 解析TXT格式
 * 支持格式：
 * - email:password
 * - email----password
 * - email|password
 * - email\tpassword
 */
function parseTxtFormat(content) {
  const accounts = [];
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    // 尝试不同的分隔符
    let email, password;
    
    if (trimmed.includes('----')) {
      [email, password] = trimmed.split('----');
    } else if (trimmed.includes(':') && !trimmed.includes('@:')) {
      [email, password] = trimmed.split(':');
    } else if (trimmed.includes('|')) {
      [email, password] = trimmed.split('|');
    } else if (trimmed.includes('\t')) {
      [email, password] = trimmed.split('\t');
    } else if (trimmed.includes(' ')) {
      [email, password] = trimmed.split(/\s+/);
    }
    
    if (email && password) {
      email = email.trim();
      password = password.trim();
      
      if (isValidEmail(email)) {
        accounts.push({ email, password });
      }
    }
  }
  
  return accounts;
}

/**
 * 解析CSV格式
 */
function parseCsvFormat(content) {
  const accounts = [];
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || i === 0) continue; // 跳过空行和标题行
    
    const parts = line.split(',');
    if (parts.length >= 2) {
      const email = parts[0].trim().replace(/["']/g, '');
      const password = parts[1].trim().replace(/["']/g, '');
      
      if (isValidEmail(email)) {
        accounts.push({ email, password });
      }
    }
  }
  
  return accounts;
}

/**
 * 解析JSON格式
 */
function parseJsonFormat(content) {
  const accounts = [];
  const data = JSON.parse(content);
  
  if (Array.isArray(data)) {
    for (const item of data) {
      if (item.email && item.password && isValidEmail(item.email)) {
        accounts.push({
          email: item.email,
          password: item.password
        });
      }
    }
  } else if (data.accounts && Array.isArray(data.accounts)) {
    return parseJsonFormat(JSON.stringify(data.accounts));
  }
  
  return accounts;
}

/**
 * 验证邮箱格式
 */
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * 从文本内容解析账号
 */
function parseAccountsFromText(text, format = 'auto') {
  if (format === 'auto') {
    // 自动检测格式
    if (text.trim().startsWith('[') || text.trim().startsWith('{')) {
      format = 'json';
    } else if (text.includes(',') && text.split('\n')[0].includes(',')) {
      format = 'csv';
    } else {
      format = 'txt';
    }
  }
  
  switch (format) {
    case 'txt':
      return parseTxtFormat(text);
    case 'csv':
      return parseCsvFormat(text);
    case 'json':
      return parseJsonFormat(text);
    default:
      return parseTxtFormat(text);
  }
}

/**
 * 验证账号（检查是否能登录）
 * @param {Object} account
 * @param {string} clientId
 */
async function validateAccount(account, clientId) {
  try {
    const msGraphROPC = require('./msGraphROPC');
    
    const result = await msGraphROPC.getTokenByPassword({
      clientId: clientId,
      username: account.email,
      password: account.password,
      scope: 'https://outlook.office.com/.default offline_access'
    });
    
    return {
      ...account,
      valid: true,
      refreshToken: result.refreshToken,
      accessToken: result.accessToken
    };
  } catch (error) {
    return {
      ...account,
      valid: false,
      error: error.message
    };
  }
}

/**
 * 批量验证账号
 */
async function batchValidateAccounts(accounts, clientId, concurrency = 3, onProgress) {
  const results = [];
  const queue = [...accounts];
  let completed = 0;
  
  const workers = [];
  for (let i = 0; i < Math.min(concurrency, queue.length); i++) {
    workers.push(async () => {
      while (queue.length > 0) {
        const account = queue.shift();
        if (!account) break;
        
        if (onProgress) {
          onProgress({
            type: 'info',
            message: `验证账号 ${account.email}...`
          });
        }
        
        const result = await validateAccount(account, clientId);
        results.push(result);
        completed++;
        
        if (onProgress) {
          if (result.valid) {
            onProgress({
              type: 'success',
              message: `✓ ${account.email} 验证成功`
            });
          } else {
            onProgress({
              type: 'error',
              message: `✗ ${account.email} 验证失败: ${result.error}`
            });
          }
          
          onProgress({
            type: 'progress',
            current: completed,
            total: accounts.length
          });
        }
        
        // 延迟避免频率限制
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
      }
    });
  }
  
  await Promise.all(workers);
  
  return results;
}

module.exports = {
  importAccountsFromFile,
  parseAccountsFromText,
  parseTxtFormat,
  parseCsvFormat,
  parseJsonFormat,
  validateAccount,
  batchValidateAccounts,
  isValidEmail
};
