/**
 * 2FA验证码生成工具类
 * 复用现有的TOTP生成逻辑
 */

const crypto = require('crypto');

class TwoFactorGenerator {
  /**
   * Base32 解码
   * @private
   */
  decodeBase32(input) {
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
   * @param {string} secret - Base32编码的密钥
   * @param {number} timeStep - 时间步长（秒），默认30秒
   * @param {number} digits - 验证码位数，默认6位
   * @returns {Object} { code: 验证码, remainingTime: 剩余有效时间(秒) }
   */
  generateTOTP(secret, timeStep = 30, digits = 6) {
    try {
      if (!secret || typeof secret !== 'string') {
        return { code: '', remainingTime: 0, error: '密钥不能为空' };
      }

      // 移除空格和特殊字符
      secret = secret.replace(/\s/g, '').replace(/-/g, '');

      const decoded = this.decodeBase32(secret.toUpperCase());
      if (!decoded) {
        return { code: '', remainingTime: 0, error: '密钥格式错误，必须是Base32编码' };
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

      return { 
        code: otp, 
        remainingTime,
        success: true 
      };
    } catch (error) {
      return { 
        code: '', 
        remainingTime: 0, 
        success: false,
        error: error.message 
      };
    }
  }

  /**
   * 验证密钥格式是否正确
   * @param {string} secret - Base32编码的密钥
   * @returns {boolean} 是否有效
   */
  validateSecret(secret) {
    if (!secret || typeof secret !== 'string') {
      return false;
    }

    // 移除空格和特殊字符
    secret = secret.replace(/\s/g, '').replace(/-/g, '');

    // Base32字符集检查
    const base32Regex = /^[A-Z2-7]+=*$/;
    return base32Regex.test(secret.toUpperCase());
  }

  /**
   * 格式化密钥显示（添加分隔符）
   * @param {string} secret - Base32密钥
   * @returns {string} 格式化后的密钥
   */
  formatSecret(secret) {
    if (!secret) return '';
    
    // 移除空格和特殊字符
    secret = secret.replace(/\s/g, '').replace(/-/g, '').toUpperCase();
    
    // 每4个字符添加一个空格
    return secret.match(/.{1,4}/g)?.join(' ') || secret;
  }

  /**
   * 批量生成多个密钥的验证码
   * @param {Array<string>} secrets - 密钥数组
   * @param {number} timeStep - 时间步长
   * @param {number} digits - 验证码位数
   * @returns {Array<Object>} 结果数组
   */
  batchGenerateTOTP(secrets, timeStep = 30, digits = 6) {
    return secrets.map((secret, index) => {
      const result = this.generateTOTP(secret, timeStep, digits);
      return {
        index: index + 1,
        secret: this.formatSecret(secret),
        ...result
      };
    });
  }

  /**
   * 持续生成验证码（用于实时更新）
   * @param {string} secret - 密钥
   * @param {Function} callback - 回调函数，接收 { code, remainingTime }
   * @param {number} timeStep - 时间步长
   * @param {number} digits - 验证码位数
   * @returns {Function} 停止函数
   */
  startContinuousGeneration(secret, callback, timeStep = 30, digits = 6) {
    let intervalId = null;
    
    const generate = () => {
      const result = this.generateTOTP(secret, timeStep, digits);
      callback(result);
    };

    // 立即生成一次
    generate();

    // 每秒更新一次
    intervalId = setInterval(generate, 1000);

    // 返回停止函数
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
  }

  /**
   * 解析otpauth URI
   * @param {string} uri - otpauth://totp/...
   * @returns {Object} 解析结果
   */
  parseOtpAuthUri(uri) {
    try {
      if (!uri.startsWith('otpauth://totp/')) {
        return { success: false, error: 'URI格式错误' };
      }

      const url = new URL(uri);
      const secret = url.searchParams.get('secret');
      const issuer = url.searchParams.get('issuer') || '';
      const accountName = decodeURIComponent(url.pathname.replace('/totp/', ''));
      const digits = parseInt(url.searchParams.get('digits') || '6');
      const period = parseInt(url.searchParams.get('period') || '30');

      if (!secret) {
        return { success: false, error: '未找到密钥' };
      }

      return {
        success: true,
        secret,
        issuer,
        accountName,
        digits,
        period
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = TwoFactorGenerator;
