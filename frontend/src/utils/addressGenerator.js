/**
 * 地址生成工具类
 * 复用现有的AddressService来生成美国地址
 */

const AddressService = require('../refactored-backend/services/address/AddressService');

class AddressGenerator {
  constructor() {
    this.addressService = new AddressService();
  }

  /**
   * 生成随机地址
   * @param {number} count - 生成数量
   * @returns {Promise<Array>} 地址列表
   */
  async generateRandomAddresses(count = 1) {
    const addresses = [];
    
    for (let i = 0; i < count; i++) {
      try {
        const result = await this.addressService.generateRandomAddress();
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
  async generateAddressByPostalCode(postalCode) {
    try {
      const result = await this.addressService.generatePostalCodeAddress(postalCode);
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
  async generateAddressesByPostalCodes(postalCodes) {
    const addresses = [];
    
    for (let i = 0; i < postalCodes.length; i++) {
      try {
        const result = await this.addressService.generatePostalCodeAddress(postalCodes[i]);
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
   * 格式化地址为文本
   * @param {Object} address - 地址对象
   * @returns {string} 格式化后的地址文本
   */
  formatAddress(address) {
    const { phoneNumber, addressLine1, city, stateCode, postalCode } = address;
    return `${phoneNumber}----${addressLine1}----${city}----${stateCode}----${postalCode}`;
  }

  /**
   * 格式化地址为JSON字符串
   * @param {Object} address - 地址对象
   * @returns {string} JSON字符串
   */
  formatAddressAsJSON(address) {
    return JSON.stringify(address, null, 2);
  }

  /**
   * 格式化地址列表为导出文本
   * @param {Array} addresses - 地址列表
   * @param {string} format - 格式类型 ('text' | 'json' | 'csv')
   * @returns {string} 导出文本
   */
  formatAddressesForExport(addresses, format = 'text') {
    switch (format) {
      case 'text':
        return addresses
          .filter(addr => addr.success)
          .map(addr => this.formatAddress(addr.data))
          .join('\n');
      
      case 'json':
        return JSON.stringify(
          addresses.filter(addr => addr.success).map(addr => addr.data),
          null,
          2
        );
      
      case 'csv':
        const headers = 'Phone,Address,City,State,PostalCode';
        const rows = addresses
          .filter(addr => addr.success)
          .map(addr => {
            const { phoneNumber, addressLine1, city, stateCode, postalCode } = addr.data;
            return `"${phoneNumber}","${addressLine1}","${city}","${stateCode}","${postalCode}"`;
          })
          .join('\n');
        return `${headers}\n${rows}`;
      
      default:
        return this.formatAddressesForExport(addresses, 'text');
    }
  }
}

module.exports = AddressGenerator;
