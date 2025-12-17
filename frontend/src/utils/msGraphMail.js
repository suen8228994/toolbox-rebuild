// src/utils/msGraphMail.js
// Microsoft Graph邮件操作工具

const axios = require('axios');

/**
 * 使用refresh token获取access token
 */
async function getAccessToken(clientId, refreshToken) {
  const url = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: 'https://graph.microsoft.com/Mail.Read offline_access'
  }).toString();
  
  const response = await axios.post(url, body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 15000
  });
  
  return response.data.access_token;
}

/**
 * 获取邮件列表
 */
async function getEmails(accessToken, options = {}) {
  const {
    maxResults = 10,
    searchKeyword = '',
    folder = 'inbox',
    onlyUnread = false
  } = options;
  
  let url = `https://graph.microsoft.com/v1.0/me/mailFolders/${folder}/messages`;
  url += `?$top=${maxResults}`;
  url += `&$select=subject,from,receivedDateTime,bodyPreview,body,isRead`;
  
  // 如果有搜索关键词，不能使用$orderby
  if (searchKeyword) {
    url += `&$search="${searchKeyword}"`;
  } else {
    url += `&$orderby=receivedDateTime DESC`;
  }
  
  if (onlyUnread) {
    url += `&$filter=isRead eq false`;
  }
  
  const response = await axios.get(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    timeout: 15000
  });
  
  // 如果使用了搜索，手动按时间排序
  const emails = response.data.value;
  if (searchKeyword) {
    emails.sort((a, b) => new Date(b.receivedDateTime) - new Date(a.receivedDateTime));
  }
  
  return emails;
}

/**
 * 从邮件中提取验证码
 */
function extractVerificationCode(emailBody) {
  // 优先使用更精确的模式
  const patterns = [
    // Amazon OTP格式 - 最精确的匹配
    /One Time Password \(OTP\)[：:\s]*[<>\s]*(\d{6})/i,
    /OTP[：:\s]*[<>\s]*(\d{6})/i,
    // 查找"OTP:"后面的数字（可能有HTML标签）
    /OTP[：:\s]*[^0-9]*(\d{6})/i,
    // 验证码关键词
    /verification code[：:\s]*[^0-9]*(\d{6})/i,
    /verify.*code[：:\s]*[^0-9]*(\d{6})/i,
    // 中文
    /验证码[：:\s]*([A-Z0-9]{4,8})/i,
    // 最后才尝试纯数字（但要确保前后有合适的上下文）
    /(?:code|otp|verify)[^\d]*(\d{6})(?!\d)/i,
  ];
  
  // 清理HTML标签以便更好地匹配
  const cleanText = emailBody.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ');
  
  for (const pattern of patterns) {
    const match = cleanText.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  // 如果所有模式都失败，尝试在纯文本中找6位数字（但要避免误匹配）
  const fallbackMatch = cleanText.match(/\b(\d{6})\b/);
  if (fallbackMatch) {
    return fallbackMatch[1];
  }
  
  return null;
}

/**
 * 等待并获取验证码邮件
 * @param {string} email - 邮箱地址
 * @param {string} refreshToken - refresh token
 * @param {string} clientId - client ID
 * @param {Object} options - 配置选项
 * @returns {Promise<string>} 验证码
 */
async function waitForVerificationEmail(email, refreshToken, clientId, options = {}) {
  const {
    maxRetries = 20,          // 最多重试次数
    retryInterval = 5000,     // 重试间隔(毫秒)
    searchKeyword = 'verification', // 搜索关键词
    fromFilter = '',          // 发件人过滤
    startTime = null,         // 起始时间戳，只获取此时间之后的邮件
    onProgress = () => {}     // 进度回调
  } = options;
  
  onProgress({ type: 'info', message: '正在获取Access Token...' });
  const accessToken = await getAccessToken(clientId, refreshToken);
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      onProgress({ 
        type: 'info', 
        message: `尝试获取验证码邮件 (${attempt}/${maxRetries})...` 
      });
      
      const emails = await getEmails(accessToken, {
        maxResults: 5,
        searchKeyword: searchKeyword,
        onlyUnread: false
      });
      
      if (emails.length === 0) {
        onProgress({ type: 'warning', message: '暂无新邮件，等待中...' });
        await new Promise(resolve => setTimeout(resolve, retryInterval));
        continue;
      }
      
      // 显示所有邮件的时间信息用于调试
      onProgress({ 
        type: 'info', 
        message: `收到 ${emails.length} 封邮件，startTime: ${startTime ? new Date(startTime).toLocaleString('zh-CN') : '无限制'}` 
      });
      
      // 查找最新的验证码邮件
      for (const emailMsg of emails) {
        const from = emailMsg.from?.emailAddress?.address || '';
        const subject = emailMsg.subject || '';
        const bodyText = emailMsg.body?.content || emailMsg.bodyPreview || '';
        const receivedTime = new Date(emailMsg.receivedDateTime);
        const timestamp = receivedTime.getTime();
        
        // 时间过滤：只处理 startTime 之后收到的邮件
        if (startTime && timestamp <= startTime) {
          onProgress({ 
            type: 'info', 
            message: `跳过旧邮件: ${subject.substring(0, 30)}... (${receivedTime.toLocaleString('zh-CN')})` 
          });
          continue;
        }
        
        // 如果指定了发件人过滤
        if (fromFilter && !from.toLowerCase().includes(fromFilter.toLowerCase())) {
          continue;
        }
        
        onProgress({ 
          type: 'info', 
          message: `检查邮件: ${subject.substring(0, 50)}... (来自: ${from})` 
        });
        
        // 尝试提取验证码
        const code = extractVerificationCode(bodyText);
        if (code) {
          onProgress({ 
            type: 'success', 
            message: `✅ 找到验证码: ${code}`,
            code: code,
            from: from,
            subject: subject,
            receivedTime: receivedTime
          });
          
          // 额外验证：确保不是明显错误的验证码
          if (code === '007185' || code === '000000' || code === '111111' || code === '123456') {
            onProgress({ 
              type: 'warning', 
              message: `⚠️ 验证码可疑: ${code}，继续查找其他邮件...` 
            });
            continue;
          }
          
          return code;
        }
      }
      
      onProgress({ type: 'warning', message: '未找到验证码，继续等待...' });
      await new Promise(resolve => setTimeout(resolve, retryInterval));
      
    } catch (error) {
      onProgress({ 
        type: 'error', 
        message: `获取邮件失败: ${error.message}` 
      });
      
      if (attempt === maxRetries) {
        throw new Error(`获取验证码邮件失败: ${error.message}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, retryInterval));
    }
  }
  
  throw new Error(`超时未收到验证码邮件 (尝试了${maxRetries}次)`);
}

module.exports = {
  getAccessToken,
  getEmails,
  extractVerificationCode,
  waitForVerificationEmail
};
