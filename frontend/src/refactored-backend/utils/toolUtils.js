/**
 * 工具函数集合
 * 包含各种辅助功能：随机数生成、轮询、密码生成、TOTP等
 */

const crypto = require('crypto');
const os = require('os');

/**
 * 生成波动范围内的随机数
 * @param {number} num - 基准值
 * @returns {number} 在基准值±30范围内的随机数
 */
function generateFluctuatingDelay(num) {
  const min = Math.max(0, num - 30);
  const max = num + 30;
  return Math.random() * (max - min) + min;
}

/**
 * 生成指定范围内的随机数
 * @param {...number} args - 可变参数，支持0个、1个或2个参数
 * @returns {number} 随机数
 */
function generateRandomDelay(...args) {
  if (!args.length) {
    return Math.floor(Math.random() * 801) + 200;
  }

  const [arg1, arg2] = args;
  
  if (args.length === 1) {
    if (arg1 <= 100) return arg1;
    const fluctuation = Math.floor(Math.random() * 71) + 30;
    return arg1 + (Math.random() > 0.5 ? fluctuation : -fluctuation);
  }

  const [min, max] = [Math.min(arg1, arg2), Math.max(arg1, arg2)];
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 自定义错误类
 */
class CustomError extends Error {
  constructor({ message, logID }) {
    super(message);
    this.name = 'CustomError';
    this.message = message;
    this.logID = logID;
    Object.setPrototypeOf(this, CustomError.prototype);
  }
}

/**
 * 从字符串中提取第一个字符和剩余部分
 */
function splitHeadAndTail(str) {
  const cleaned = (str || '').replace(/\s/g, '');
  return cleaned.length > 0 ? [cleaned[0], cleaned.slice(1)] : ['', ''];
}

/**
 * 从时间码转换为时间戳
 */
function convertCodeToTimestamp(str) {
  if (!str || str.length < 6) return 0;

  try {
    const year = (str.charCodeAt(0) - 48) * 10 + (str.charCodeAt(1) - 48);
    const month = (str.charCodeAt(2) - 48) * 10 + (str.charCodeAt(3) - 48) - 1;
    const day = (str.charCodeAt(4) - 48) * 10 + (str.charCodeAt(5) - 48);
    
    let hour = 0, minute = 0;
    if (str.length > 6) {
      hour = (str.charCodeAt(7) - 48) * 10 + (str.charCodeAt(8) - 48);
      minute = (str.charCodeAt(9) - 48) * 10 + (str.charCodeAt(10) - 48);
    }

    return new Date(2000 + year, month, day, hour, minute).getTime();
  } catch {
    return 0;
  }
}

/**
 * 从邮件内容中提取验证码
 * @param {string} htmlContent - HTML 邮件内容
 * @returns {string[]} 验证码数组
 */
function extractEmailVerificationCode(htmlContent) {
  if (!htmlContent || typeof htmlContent !== 'string') {
    return [];
  }

  const cleanedText = htmlContent
    .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleanedText.match(/\b\d{6}\b/g) || [];
}

/**
 * 生成随机浏览器窗口大小命令
 */
function generateRandomWindowSizeCommand() {
  const width = Math.floor(Math.random() * (1920 - 1800 + 1)) + 1800;
  const height = Math.floor(Math.random() * (1050 - 1000 + 1)) + 1000;
  return `--window-size=${width},${height}`;
}

/**
 * 从邮箱地址提取用户名
 */
function extractNameFromEmail(email) {
  if (!email || typeof email !== 'string') return '';

  let localPart = '';
  for (let i = 0; i < email.length; i++) {
    if (email[i] === '@') break;
    localPart += email[i];
  }

  let lettersOnly = '';
  for (let i = 0; i < localPart.length; i++) {
    const char = localPart[i];
    if ((char >= 'A' && char <= 'Z') || (char >= 'a' && char <= 'z')) {
      lettersOnly += char;
    }
  }

  if (!lettersOnly) return '';

  const words = [];
  let wordStart = 0;

  for (let i = 1; i < lettersOnly.length; i++) {
    const prev = lettersOnly[i - 1];
    const curr = lettersOnly[i];
    const next = lettersOnly[i + 1] || '';

    const prevIsLower = prev >= 'a' && prev <= 'z';
    const currIsUpper = curr >= 'A' && curr <= 'Z';
    const nextIsLower = next >= 'a' && next <= 'z';

    if ((prevIsLower && currIsUpper) || 
        (currIsUpper && prev >= 'A' && prev <= 'Z' && nextIsLower)) {
      words.push(lettersOnly.slice(wordStart, i));
      wordStart = i;
    }
  }
  words.push(lettersOnly.slice(wordStart));

  if (words.length > 1) {
    return words
      .map(word => word[0].toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  const mid = Math.ceil(lettersOnly.length / 2);
  const first = lettersOnly.slice(0, mid);
  const second = lettersOnly.slice(mid);

  return [
    first[0].toUpperCase() + first.slice(1).toLowerCase(),
    second ? second[0].toUpperCase() + second.slice(1).toLowerCase() : ''
  ].filter(Boolean).join(' ');
}

/**
 * 基于用户名生成密码
 */
function generatePasswordFromName(name) {
  if (!name || typeof name !== 'string') return '';

  const words = name.trim().split(/\s+/);
  if (words.length === 0) return '';

  const longestWord = words.reduce(
    (longest, word) => word.length > longest.length ? word : longest,
    ""
  );

  const numLength = 3 + Math.floor(Math.random() * 4);
  const digits = Array.from(
    { length: numLength },
    () => Math.floor(Math.random() * 10)
  ).join('');

  const shouldAddLetters = Math.random() < 0.5;
  const lettersPool = words.map(w => w[0].toUpperCase()).join('');
  const lettersCount = Math.min(
    Math.floor(Math.random() * 3) + 1,
    lettersPool.length
  );

  const randomLetters = shouldAddLetters
    ? Array.from({ length: lettersCount }, () => {
        const idx = Math.floor(Math.random() * lettersPool.length);
        return lettersPool[idx];
      }).join('')
    : '';

  const basePassword = longestWord + digits + randomLetters;

  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnopqrstuvwxyz0123456789';
  const remainingLength = Math.max(0, 12 - basePassword.length);
  const additionalChars = Array.from({ length: remainingLength }, () => {
    const idx = Math.floor(Math.random() * chars.length);
    return chars[idx];
  }).join('');

  return basePassword + additionalChars;
}

/**
 * 扁平化对象
 */
function flattenObject(obj) {
  let result = '';
  for (const value of Object.values(obj)) {
    result += typeof value === 'object' && value !== null
      ? flattenObject(value)
      : String(value);
  }
  return result;
}

/**
 * 创建轮询工厂函数
 */
function createPollingFactory({
  interval = 3000,
  maxWait = 30000,
  error,
  complete,
  stop
} = {}) {
  return async (fn, ...args) => {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      if (stop && await Promise.resolve(stop.call(this))) {
        break;
      }

      try {
        const result = await fn(...args);
        return result;
      } catch (err) {
        if (error) {
          await Promise.resolve(error.call(this, err));
        }
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }

    if (complete) {
      await Promise.resolve(complete.call(this));
    }
  };
}

/* generateSlowType removed — slow typing behavior merged into AmazonRegisterCore.fillInput */

/**
 * 生成网格位置
 */
function generateGridPositions(config) {
  const { width, height, source, gap, padding = 5 } = config;
  const positions = [];
  const [rows, cols] = [3, 3];

  const cellWidth = (width - gap * (cols - 1)) / cols;
  const cellHeight = (height - gap * (rows - 1)) / rows;

  const shuffleArray = (arr) => {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };

  const getRandomPositionInCell = (cellIndex) => {
    const row = Math.floor(cellIndex / cols);
    const col = cellIndex % cols;
    
    const x = col * (cellWidth + gap) + padding + 
              Math.random() * (cellWidth - 2 * padding);
    const y = row * (cellHeight + gap) + padding + 
              Math.random() * (cellHeight - 2 * padding);
    
    return { x, y };
  };

  const shuffled = shuffleArray(source);
  shuffled.forEach(value => {
    if (typeof value === 'number' && (value < 0 || value > 8)) {
      return;
    }
    const pos = getRandomPositionInCell(Number(value));
    positions.push({ ...pos });
  });

  return positions;
}

/**
 * 获取系统健康状态
 */
function getSystemHealth() {
  const toMB = (bytes) => Math.round(bytes / 1024 / 1024 * 100) / 100;

  const totalMemory = toMB(os.totalmem());
  const freeMemory = toMB(os.freemem());
  const processMemory = toMB(process.memoryUsage().rss);
  const memoryUsage = Math.round(
    totalMemory > 0 ? ((totalMemory - freeMemory) / totalMemory) * 100 : 0
  );

  const cpus = os.cpus();
  let cpuUsage = 0;

  if (cpus.length > 0) {
    let idle = 0, total = 0;
    
    for (const cpu of cpus) {
      const times = cpu.times;
      idle += times.idle;
      total += times.user + times.nice + times.sys + times.irq + times.idle;
    }
    
    cpuUsage = total > 0 ? Math.round((1 - idle / total) * 100) : 0;
  }

  return {
    totalMemory,
    freeMemory,
    processMemory,
    memoryUsage,
    cpuUsage
  };
}

/**
 * Base32 解码
 */
function decodeBase32(input) {
  const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const base32CharMap = base32Chars.split('').reduce(
    (map, char, i) => ({ ...map, [char]: i }),
    {}
  );

  input = input.toUpperCase().replace(/=+$/, '');
  const buffer = new Uint8Array(Math.ceil((input.length * 5) / 8));
  let bitIndex = 0;

  for (const char of input) {
    const charIndex = base32CharMap[char];
    if (charIndex === undefined) return null;

    for (let j = 4; j >= 0; j--) {
      const bitValue = (charIndex >> j) & 1;
      const byteIndex = Math.floor(bitIndex / 8);
      const bitOffset = 7 - (bitIndex % 8);
      buffer[byteIndex] |= bitValue << bitOffset;
      bitIndex++;
    }
  }

  return buffer;
}

/**
 * 生成 TOTP 验证码
 */
async function generateTOTP(secret, timeStep = 30, digits = 6) {
  try {
    if (!secret || typeof secret !== 'string') {
      return { code: '', remainingTime: 0 };
    }

    const decoded = decodeBase32(secret.toUpperCase());
    if (!decoded) {
      return { code: '', remainingTime: 0 };
    }

    const timeBuffer = Buffer.alloc(8);
    timeBuffer.writeUInt32BE(Math.floor(Date.now() / 1000 / timeStep), 4);

    const hmac = crypto
      .createHmac('sha1', decoded)
      .update(timeBuffer)
      .digest();

    const offset = hmac[hmac.length - 1] & 0x0f;
    const binaryCode =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);

    const otp = String(binaryCode % 10 ** digits).padStart(digits, '0');
    const remainingTime = timeStep - (Math.floor(Date.now() / 1000) % timeStep);

    return { code: otp, remainingTime };
  } catch {
    return { code: '', remainingTime: 0 };
  }
}

module.exports = {
  generateFluctuatingDelay,
  generateRandomDelay,
  CustomError,
  splitHeadAndTail,
  convertCodeToTimestamp,
  extractEmailVerificationCode,
  generateRandomWindowSizeCommand,
  extractNameFromEmail,
  generatePasswordFromName,
  flattenObject,
  createPollingFactory,
  generateGridPositions,
  getSystemHealth,
  generateTOTP
};
