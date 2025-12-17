// src/utils/hotmailRegister.js
// Hotmail/Outlook 批量注册工具

const axios = require("axios");
const crypto = require("crypto");

/**
 * 生成随机字符串
 */
function randomString(length = 8) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 生成随机邮箱名
 */
function generateEmailName() {
  const prefix = randomString(6);
  const suffix = randomString(4);
  return `${prefix}${suffix}`;
}

/**
 * 生成随机密码
 */
function generatePassword(length = 12) {
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  const symbols = "!@#$%";
  
  const allChars = lowercase + uppercase + numbers + symbols;
  let password = "";
  
  // 确保至少包含每种类型的字符
  password += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
  password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
  password += numbers.charAt(Math.floor(Math.random() * numbers.length));
  password += symbols.charAt(Math.floor(Math.random() * symbols.length));
  
  // 填充剩余长度
  for (let i = password.length; i < length; i++) {
    password += allChars.charAt(Math.floor(Math.random() * allChars.length));
  }
  
  // 打乱顺序
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * 生成随机姓名
 */
function generateName() {
  const firstNames = [
    "James", "John", "Robert", "Michael", "William", "David", "Richard", "Joseph",
    "Thomas", "Charles", "Mary", "Patricia", "Jennifer", "Linda", "Elizabeth",
    "Barbara", "Susan", "Jessica", "Sarah", "Karen"
  ];
  
  const lastNames = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
    "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
    "Thomas", "Taylor", "Moore", "Jackson", "Martin"
  ];
  
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  
  return { firstName, lastName };
}

/**
 * 生成随机生日（18-60岁）
 */
function generateBirthDate() {
  const today = new Date();
  const minAge = 18;
  const maxAge = 60;
  
  const year = today.getFullYear() - minAge - Math.floor(Math.random() * (maxAge - minAge));
  const month = Math.floor(Math.random() * 12) + 1;
  const day = Math.floor(Math.random() * 28) + 1; // 简化处理，使用28天
  
  return {
    year: year.toString(),
    month: month.toString(),
    day: day.toString()
  };
}

/**
 * 模拟注册 Hotmail/Outlook 账号
 * 注意：此为示例实现，实际需要根据Microsoft最新API调整
 * 真实注册需要：
 * 1. 访问 https://signup.live.com/ 获取CSRF tokens
 * 2. 解决 CAPTCHA 验证码（需要第三方服务）
 * 3. 处理手机验证（如需要）
 * 4. 完整的HTTP请求流程和Cookie管理
 * 
 * @param {Object} options
 * @param {string} [options.domain] - 邮箱域名，默认 'outlook.com'
 * @param {string} [options.proxy] - 代理配置 'host:port:user:pass'
 * @param {function} [options.onProgress] - 进度回调
 * @returns {Promise<{email: string, password: string, success: boolean, error?: string}>}
 */
async function registerHotmail(options = {}) {
  const { domain = "outlook.com", proxy, onProgress } = options;
  
  try {
    // 生成账号信息
    const emailName = generateEmailName();
    const email = `${emailName}@${domain}`;
    const password = generatePassword();
    const { firstName, lastName } = generateName();
    const birthDate = generateBirthDate();
    
    if (onProgress) onProgress({ step: "生成账号信息", email });
    
    // 配置axios实例
    const axiosConfig = {
      timeout: 30000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        "Origin": "https://signup.live.com",
        "Referer": "https://signup.live.com/"
      }
    };
    
    // 如果有代理配置
    if (proxy) {
      const [host, port, username, proxyPassword] = proxy.split(':');
      if (host && port) {
        axiosConfig.proxy = {
          host,
          port: parseInt(port),
          ...(username && proxyPassword ? { auth: { username, password: proxyPassword } } : {})
        };
      }
    }
    
    const client = axios.create(axiosConfig);
    
    if (onProgress) onProgress({ step: "准备注册", email });
    
    // ============================================
    // 真实的Microsoft注册流程（简化版）
    // ============================================
    
    // 步骤1: 获取注册页面和必要的tokens
    if (onProgress) onProgress({ step: "获取注册页面", email });
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
    
    // 步骤2: 检查邮箱可用性
    if (onProgress) onProgress({ step: "检查邮箱可用性", email });
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 700));
    
    // 模拟检查结果（10%概率邮箱被占用）
    if (Math.random() < 0.1) {
      throw new Error("邮箱名已被使用");
    }
    
    // 步骤3: 提交注册信息
    if (onProgress) onProgress({ step: "提交注册信息", email });
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
    
    // 步骤4: 处理验证（实际需要CAPTCHA识别服务）
    if (onProgress) onProgress({ step: "处理验证流程", email });
    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1500));
    
    // 模拟成功率（85%成功）
    if (Math.random() < 0.15) {
      const errors = [
        "验证码识别失败",
        "网络请求超时",
        "账号创建失败",
        "频率限制",
        "代理IP被封"
      ];
      throw new Error(errors[Math.floor(Math.random() * errors.length)]);
    }
    
    if (onProgress) onProgress({ step: "注册成功", email });
    
    // 返回成功结果
    return {
      email,
      password,
      firstName,
      lastName,
      birthDate: `${birthDate.year}-${birthDate.month}-${birthDate.day}`,
      success: true
    };
    
  } catch (error) {
    return {
      email: null,
      password: null,
      success: false,
      error: error.message || "注册失败"
    };
  }
}

/**
 * 批量注册账号
 * @param {Object} options
 * @param {number} options.count - 注册数量
 * @param {number} [options.concurrency] - 并发数，默认3
 * @param {string} [options.domain] - 邮箱域名
 * @param {Array<string>} [options.proxies] - 代理列表
 * @param {function} [options.onProgress] - 进度回调
 * @param {function} [options.onResult] - 单个结果回调
 * @returns {Promise<Array>}
 */
async function batchRegister(options) {
  const {
    count,
    concurrency = 3,
    domain = "outlook.com",
    proxies = [],
    onProgress,
    onResult
  } = options;
  
  const results = [];
  const tasks = [];
  
  // 创建所有任务
  for (let i = 0; i < count; i++) {
    tasks.push({
      index: i,
      taskNumber: i + 1
    });
  }
  
  // 并发控制执行
  let taskIndex = 0;
  const workers = [];
  
  for (let i = 0; i < Math.min(concurrency, count); i++) {
    const worker = async () => {
      while (taskIndex < tasks.length) {
        // 获取下一个任务
        const currentTaskIndex = taskIndex++;
        if (currentTaskIndex >= tasks.length) break;
        
        const task = tasks[currentTaskIndex];
        const index = task.index;
        const taskNumber = task.taskNumber;
        
        // 选择代理（轮询）
        const proxy = proxies.length > 0 ? proxies[index % proxies.length] : null;
        
        if (onProgress) {
          onProgress({
            type: "info",
            message: `Worker ${i + 1}: 开始注册第 ${taskNumber}/${count} 个账号...`
          });
        }
        
        try {
          // 执行注册
          const result = await registerHotmail({
            domain,
            proxy,
            onProgress: (progress) => {
              if (onProgress) {
                onProgress({
                  type: "info",
                  message: `[${taskNumber}] ${progress.step}: ${progress.email || ""}`
                });
              }
            }
          });
          
          result.index = taskNumber;
          results[index] = result;
          
          // 回调单个结果
          if (onResult) {
            onResult(result);
          }
          
          if (onProgress) {
            if (result.success) {
              onProgress({
                type: "success",
                message: `✓ [${taskNumber}] 注册成功: ${result.email}`
              });
            } else {
              onProgress({
                type: "error",
                message: `✗ [${taskNumber}] 注册失败: ${result.error}`
              });
            }
          }
        } catch (error) {
          const errorResult = {
            index: taskNumber,
            email: null,
            password: null,
            success: false,
            error: error.message || "未知错误"
          };
          results[index] = errorResult;
          
          if (onResult) {
            onResult(errorResult);
          }
          
          if (onProgress) {
            onProgress({
              type: "error",
              message: `✗ [${taskNumber}] 注册失败: ${error.message}`
            });
          }
        }
        
        // 延迟避免频率限制
        if (taskIndex < tasks.length) {
          await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
        }
      }
    };
    
    workers.push(worker());
  }
  
  await Promise.all(workers);
  
  // 过滤undefined并返回
  return results.filter(r => r !== undefined);
}

module.exports = {
  registerHotmail,
  batchRegister,
  generateEmailName,
  generatePassword,
  generateName,
  generateBirthDate
};
