/**
 * 地址服务包装器 - 提供与渲染进程的接口
 * 替代已弃用的addressGenerator.js，直接使用AddressService
 */

const AddressService = require('../refactored-backend/services/address/AddressService');

const addressService = new AddressService();

/**
 * 生成指定数量的随机地址
 * @param {number} count - 生成数量
 * @returns {Promise<Array>} 地址列表
 */
async function generateRandom(count = 1) {
  const addresses = [];
  
  for (let i = 0; i < count; i++) {
    try {
      const result = await addressService.generateRandomAddress();
      addresses.push({
        index: i + 1,
        success: true,
        data: result.data
      });
    } catch (error) {
      addresses.push({
        index: i + 1,
        success: false,
        error: error.message
      });
    }
  }
  
  return addresses;
}

/**
 * 根据邮编生成地址
 * @param {string} postalCode - 邮政编码
 * @returns {Promise<Object>} 地址信息
 */
async function generateByPostalCode(postalCode) {
  try {
    const result = await addressService.generatePostalCodeAddress(postalCode);
    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 批量根据邮编生成地址
 * @param {Array<string>} postalCodes - 邮编列表
 * @returns {Promise<Array>} 地址列表
 */
async function generateByPostalCodes(postalCodes) {
  const addresses = [];
  
  for (let i = 0; i < postalCodes.length; i++) {
    try {
      const result = await addressService.generatePostalCodeAddress(postalCodes[i]);
      addresses.push({
        index: i + 1,
        postalCode: postalCodes[i],
        success: true,
        data: result.data
      });
    } catch (error) {
      addresses.push({
        index: i + 1,
        postalCode: postalCodes[i],
        success: false,
        error: error.message
      });
    }
  }
  
  return addresses;
}

/**
 * 格式化地址为文本或CSV
 * @param {Array<Object>} addresses - 地址对象数组
 * @param {string} format - 格式类型: 'text' 或 'csv'
 * @returns {string} 格式化后的地址文本
 */
function formatForExport(addresses, format = 'text') {
  if (!Array.isArray(addresses) || addresses.length === 0) {
    return '';
  }
  
  if (format === 'csv') {
    const header = 'Index,Phone,Address,City,State,PostalCode\n';
    const rows = addresses
      .filter(item => item.success && item.data)
      .map((item, idx) => {
        const { phoneNumber, addressLine1, city, stateCode, postalCode } = item.data;
        return `${idx + 1},"${phoneNumber}","${addressLine1}","${city}","${stateCode}","${postalCode}"`;
      })
      .join('\n');
    return header + rows;
  } else {
    // 默认为text格式，每行一个地址
    return addresses
      .filter(item => item.success && item.data)
      .map((item) => {
        const { phoneNumber, addressLine1, city, stateCode, postalCode } = item.data;
        return `${phoneNumber}----${addressLine1}----${city}----${stateCode}----${postalCode}`;
      })
      .join('\n');
  }
}

module.exports = {
  generateRandom,
  generateByPostalCode,
  generateByPostalCodes,
  formatForExport
};
