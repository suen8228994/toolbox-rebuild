/**
 * 美国手机号码生成工具类
 * 生成格式：+1XXXXXXXXXX (例如：+18022199626)
 */

class PhoneGenerator {
  constructor() {
    // 美国常用区号列表（提高真实性）
    this.popularAreaCodes = [
      // 加利福尼亚州
      '213', '310', '323', '424', '510', '562', '619', '626', '650', '657', '661', '669', '707', '714', '747', '760', '805', '818', '831', '858', '909', '916', '925', '949', '951',
      // 纽约州
      '212', '315', '347', '516', '518', '585', '607', '631', '646', '716', '718', '845', '914', '917', '929',
      // 德克萨斯州
      '210', '214', '254', '281', '325', '361', '409', '430', '432', '469', '512', '682', '713', '737', '806', '817', '830', '832', '903', '915', '936', '940', '956', '972', '979',
      // 佛罗里达州
      '305', '321', '352', '386', '407', '561', '727', '754', '772', '786', '813', '850', '863', '904', '941', '954',
      // 伊利诺伊州
      '217', '224', '309', '312', '331', '618', '630', '708', '773', '815', '847', '872',
      // 宾夕法尼亚州
      '215', '267', '272', '412', '484', '570', '610', '717', '724', '814', '878',
      // 俄亥俄州
      '216', '220', '234', '330', '380', '419', '440', '513', '567', '614', '740', '937',
      // 佐治亚州
      '229', '404', '470', '478', '678', '706', '762', '770', '912',
      // 北卡罗来纳州
      '252', '336', '704', '743', '828', '910', '919', '980', '984',
      // 密歇根州
      '231', '248', '269', '313', '517', '586', '616', '734', '810', '906', '947', '989',
      // 其他热门区号
      '202', '203', '303', '401', '503', '602', '702', '801', '802', '901', '302', '502'
    ];
  }

  /**
   * 生成单个随机美国手机号码
   * @param {boolean} usePopularAreaCode - 是否使用常用区号（默认true，提高真实性）
   * @returns {string} 格式：+1XXXXXXXXXX
   */
  generatePhone(usePopularAreaCode = true) {
    let areaCode;
    
    if (usePopularAreaCode && Math.random() < 0.8) {
      // 80% 概率使用真实常用区号
      areaCode = this.popularAreaCodes[Math.floor(Math.random() * this.popularAreaCodes.length)];
    } else {
      // 20% 概率或明确要求时生成随机区号
      // 区号规则：第一位 2-9，后两位 0-9
      areaCode = this.#generateRandomAreaCode();
    }
    
    // 中间3位：第一位 2-9，后两位 0-9
    const centralOfficeCode = this.#generateCentralOfficeCode();
    
    // 最后4位：0000-9999
    const lineNumber = this.#generateLineNumber();
    
    return `+1${areaCode}${centralOfficeCode}${lineNumber}`;
  }

  /**
   * 批量生成随机美国手机号码
   * @param {number} count - 生成数量
   * @param {boolean} usePopularAreaCode - 是否使用常用区号
   * @param {boolean} unique - 是否保证唯一性（默认true）
   * @returns {Array<string>} 手机号码数组
   */
  generatePhones(count, usePopularAreaCode = true, unique = true) {
    const phones = [];
    const phoneSet = new Set();
    
    let attempts = 0;
    const maxAttempts = count * 10; // 防止无限循环
    
    while (phones.length < count && attempts < maxAttempts) {
      const phone = this.generatePhone(usePopularAreaCode);
      
      if (unique) {
        if (!phoneSet.has(phone)) {
          phoneSet.add(phone);
          phones.push(phone);
        }
      } else {
        phones.push(phone);
      }
      
      attempts++;
    }
    
    return phones;
  }

  /**
   * 生成指定区号的手机号码
   * @param {string} areaCode - 区号（3位数字）
   * @returns {string} 格式：+1XXXXXXXXXX
   */
  generatePhoneWithAreaCode(areaCode) {
    // 验证区号格式
    if (!/^\d{3}$/.test(areaCode)) {
      throw new Error('区号必须是3位数字');
    }
    
    const centralOfficeCode = this.#generateCentralOfficeCode();
    const lineNumber = this.#generateLineNumber();
    
    return `+1${areaCode}${centralOfficeCode}${lineNumber}`;
  }

  /**
   * 批量生成指定区号的手机号码
   * @param {string} areaCode - 区号（3位数字）
   * @param {number} count - 生成数量
   * @returns {Array<string>} 手机号码数组
   */
  generatePhonesWithAreaCode(areaCode, count) {
    const phones = [];
    for (let i = 0; i < count; i++) {
      phones.push(this.generatePhoneWithAreaCode(areaCode));
    }
    return phones;
  }

  /**
   * 验证手机号码格式
   * @param {string} phone - 手机号码
   * @returns {boolean} 是否有效
   */
  validatePhone(phone) {
    // 验证格式：+1 + 10位数字
    const phoneRegex = /^\+1\d{10}$/;
    if (!phoneRegex.test(phone)) {
      return false;
    }
    
    // 提取各部分
    const areaCode = phone.substring(2, 5);
    const centralOffice = phone.substring(5, 8);
    
    // 验证区号第一位不能是0或1
    if (areaCode[0] === '0' || areaCode[0] === '1') {
      return false;
    }
    
    // 验证中间码第一位不能是0或1
    if (centralOffice[0] === '0' || centralOffice[0] === '1') {
      return false;
    }
    
    return true;
  }

  /**
   * 格式化手机号码（添加分隔符）
   * @param {string} phone - 手机号码（+1XXXXXXXXXX）
   * @param {string} format - 格式类型 ('dash' | 'space' | 'parentheses')
   * @returns {string} 格式化后的手机号码
   */
  formatPhone(phone, format = 'dash') {
    if (!this.validatePhone(phone)) {
      throw new Error('无效的手机号码格式');
    }
    
    const areaCode = phone.substring(2, 5);
    const centralOffice = phone.substring(5, 8);
    const lineNumber = phone.substring(8, 12);
    
    switch (format) {
      case 'dash':
        // +1-802-219-9626
        return `+1-${areaCode}-${centralOffice}-${lineNumber}`;
      case 'space':
        // +1 802 219 9626
        return `+1 ${areaCode} ${centralOffice} ${lineNumber}`;
      case 'parentheses':
        // +1 (802) 219-9626
        return `+1 (${areaCode}) ${centralOffice}-${lineNumber}`;
      default:
        return phone;
    }
  }

  /**
   * 导出手机号码为文本格式
   * @param {Array<string>} phones - 手机号码数组
   * @param {string} format - 导出格式 ('plain' | 'formatted')
   * @returns {string} 导出文本
   */
  exportPhones(phones, format = 'plain') {
    if (format === 'formatted') {
      return phones.map(phone => this.formatPhone(phone, 'dash')).join('\n');
    }
    return phones.join('\n');
  }

  /**
   * 获取所有常用区号列表
   * @returns {Array<string>} 区号数组
   */
  getPopularAreaCodes() {
    return [...this.popularAreaCodes];
  }

  /**
   * 按州生成手机号码
   * @param {string} state - 州名或州代码
   * @param {number} count - 生成数量
   * @returns {Array<string>} 手机号码数组
   */
  generatePhonesByState(state, count = 1) {
    const stateAreaCodes = this.#getAreaCodesByState(state);
    if (stateAreaCodes.length === 0) {
      throw new Error(`未找到州 ${state} 的区号`);
    }
    
    const phones = [];
    for (let i = 0; i < count; i++) {
      const areaCode = stateAreaCodes[Math.floor(Math.random() * stateAreaCodes.length)];
      phones.push(this.generatePhoneWithAreaCode(areaCode));
    }
    return phones;
  }

  // ==================== 私有方法 ====================

  /**
   * 生成随机区号（3位，第一位2-9）
   * @private
   */
  #generateRandomAreaCode() {
    const firstDigit = Math.floor(Math.random() * 8) + 2; // 2-9
    const secondDigit = Math.floor(Math.random() * 10); // 0-9
    const thirdDigit = Math.floor(Math.random() * 10); // 0-9
    return `${firstDigit}${secondDigit}${thirdDigit}`;
  }

  /**
   * 生成中间局码（3位，第一位2-9）
   * @private
   */
  #generateCentralOfficeCode() {
    const firstDigit = Math.floor(Math.random() * 8) + 2; // 2-9
    const secondDigit = Math.floor(Math.random() * 10); // 0-9
    const thirdDigit = Math.floor(Math.random() * 10); // 0-9
    return `${firstDigit}${secondDigit}${thirdDigit}`;
  }

  /**
   * 生成线路号（4位，0000-9999）
   * @private
   */
  #generateLineNumber() {
    return Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  }

  /**
   * 根据州获取区号列表
   * @private
   */
  #getAreaCodesByState(state) {
    const stateMap = {
      'CA': ['213', '310', '323', '424', '510', '562', '619', '626', '650', '657', '661', '669', '707', '714', '747', '760', '805', '818', '831', '858', '909', '916', '925', '949', '951'],
      'NY': ['212', '315', '347', '516', '518', '585', '607', '631', '646', '716', '718', '845', '914', '917', '929'],
      'TX': ['210', '214', '254', '281', '325', '361', '409', '430', '432', '469', '512', '682', '713', '737', '806', '817', '830', '832', '903', '915', '936', '940', '956', '972', '979'],
      'FL': ['305', '321', '352', '386', '407', '561', '727', '754', '772', '786', '813', '850', '863', '904', '941', '954'],
      'IL': ['217', '224', '309', '312', '331', '618', '630', '708', '773', '815', '847', '872'],
      'PA': ['215', '267', '272', '412', '484', '570', '610', '717', '724', '814', '878'],
      'OH': ['216', '220', '234', '330', '380', '419', '440', '513', '567', '614', '740', '937'],
      'GA': ['229', '404', '470', '478', '678', '706', '762', '770', '912'],
      'NC': ['252', '336', '704', '743', '828', '910', '919', '980', '984'],
      'MI': ['231', '248', '269', '313', '517', '586', '616', '734', '810', '906', '947', '989']
    };
    
    return stateMap[state.toUpperCase()] || [];
  }
}

module.exports = PhoneGenerator;
