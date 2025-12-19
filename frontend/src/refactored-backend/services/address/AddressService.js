/**
 * 地址服务
 * 负责生成美国地址信息，包括邮政编码地址和随机地址
 */

const { stateAbbreviations } = require('../../utils/usStateData');
const { createPollingFactory, CustomError } = require('../../utils/toolUtils');

class AddressService {
  #boundingBoxCache = new Map();

  /**
   * 根据邮政编码生成地址信息
   * @param {string} postalCode - 美国邮政编码
   * @returns {Promise<Object>} 地址信息对象
   */
  async generatePostalCodeAddress(postalCode) {
    const locationBounds = await this.#getLocationByPostalCode(postalCode);
    
    if (!this.#boundingBoxCache.get(postalCode)) {
      this.#boundingBoxCache.set(postalCode, locationBounds);
    }

    const addressData = await this.#getAddressFromCoordinates(postalCode);
    this.#boundingBoxCache.delete(postalCode);

    return {
      data: {
        ...addressData,
        postalCode,
        region: 'us'
      }
    };
  }

  /**
   * 生成随机美国地址
   * @returns {Promise<Object>} 随机地址信息
   */
  async generateRandomAddress() {
    console.log('[AddressService] 开始生成随机地址');
    const { postalCode, locationBounds } = await this.#getRandomGeographyInfo();
    console.log('[AddressService] 获取到邮编和边界:', postalCode, locationBounds);
    
    if (!this.#boundingBoxCache.get(postalCode)) {
      this.#boundingBoxCache.set(postalCode, locationBounds);
      console.log('[AddressService] 缓存边界信息');
    }

    const addressData = await this.#getAddressFromCoordinates(postalCode);
    this.#boundingBoxCache.delete(postalCode);
    console.log('[AddressService] 生成地址成功');

    return {
      data: {
        ...addressData,
        postalCode,
        region: 'us'
      }
    };
  }

  /**
   * 从地理坐标获取地址信息
   * @private
   */
  async #getAddressFromCoordinates(postalCode) {
    let attemptCount = 0;
    const addressPolling = createPollingFactory({
      maxWait: 60000,  // 增加到60秒
      interval: 2000,  // 减少间隔到2秒，增加尝试次数
      error(err) {
        attemptCount++;
        console.log(`[AddressService] 第 ${attemptCount} 次尝试失败: ${err.message}`);
      },
      complete() {
        throw new CustomError({
          message: `获取随机位置信息失败（尝试了 ${attemptCount} 次）`,
          logID: 'Error-Info'
        });
      }
    });

    return addressPolling(async (postalCode) => {
      const { lat, lon } = this.#getRandomPointInBoundingBox(postalCode);
      
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
        {
          headers: {
            'User-Agent': 'ToolBox Address Service',
            'Accept': 'application/json'
          }
        }
      );

      this.#validateContentType(response.headers.get('content-type'));
      const data = await response.json();

      if (!data || !data.address) {
        throw new Error(`API返回数据不完整: ${JSON.stringify(data)}`);
      }

      if (!data.address.house_number) {
        throw new Error(`没有房屋编号 (lat: ${lat.toFixed(4)}, lon: ${lon.toFixed(4)})`);
      }

      // OpenStreetMap API 返回的地址字段可能有多种命名方式
      const address = data.address;
      const state = address.state;
      const house_number = address.house_number;
      const road = address.road;
      
      // 验证必需字段
      if (!state) {
        throw new Error(`缺少州信息: ${JSON.stringify(address)}`);
      }
      if (!road) {
        throw new Error(`缺少道路信息: ${JSON.stringify(address)}`);
      }
      
      // city 可能是 city, town, village, hamlet, municipality 等
      const city = address.city || 
                   address.town || 
                   address.village || 
                   address.hamlet || 
                   address.municipality || 
                   address.county || 
                   'Unknown';
      
      const stateCode = stateAbbreviations[state];
      
      // 如果州代码未找到，抛出错误重新获取
      if (!stateCode) {
        throw new Error(`未找到州代码: ${state}，重新获取`);
      }
      
      const phoneNumber = this.#generateRandomPhoneNumber(stateCode);

      return {
        addressLine1: `${house_number} ${road}`,
        city,
        stateCode,      // 与toolbox保持一致：stateCode 而不是 countryCode
        phoneNumber     // 与toolbox保持一致：phoneNumber 而不是 randomPhone
      };
    }, postalCode);
  }

  /**
   * 通过邮政编码获取地理边界
   * @private
   */
  async #getLocationByPostalCode(postalCode) {
    let attemptCount = 0;
    const postalPolling = createPollingFactory({
      maxWait: 40000,
      interval: 2000,
      error(err) {
        attemptCount++;
        console.log(`[AddressService] 邮编查询第 ${attemptCount} 次失败: ${err.message}`);
      },
      complete() {
        throw new CustomError({
          message: `通过邮编获取地理信息失败（尝试了 ${attemptCount} 次）`,
          logID: 'Error-Info'
        });
      }
    });

    return postalPolling(async (code) => {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?postalcode=${code}&countrycodes=us&format=json&limit=1`,
        {
          headers: {
            'User-Agent': 'ToolBox Address Service',
            'Accept': 'application/json'
          }
        }
      );

      this.#validateContentType(response.headers.get('content-type'));
      const data = await response.json();

      if (!data || data.length === 0) {
        throw new Error('通过邮编获取地理数据失败');
      }

      return data[0].boundingbox;
    }, postalCode);
  }

  /**
   * 验证响应内容类型
   * @private
   */
  #validateContentType(contentType) {
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('接口返回数据格式不正确');
    }
  }

  /**
   * 在边界框内生成随机坐标点
   * @private
   */
  #getRandomPointInBoundingBox(postalCode) {
    const bounds = this.#boundingBoxCache.get(postalCode);
    const minLat = Number(bounds[0]);
    const maxLat = Number(bounds[1]);
    const minLon = Number(bounds[2]);
    const maxLon = Number(bounds[3]);

    const lat = Math.random() * (maxLat - minLat) + minLat;
    const lon = Math.random() * (maxLon - minLon) + minLon;

    return { lat, lon };
  }

  /**
   * 获取随机地理信息
   * @private
   */
  #getRandomGeographyInfo() {
    let attemptCount = 0;
    const geographyPolling = createPollingFactory({
      maxWait: 40000,
      interval: 2000,
      error(err) {
        attemptCount++;
        console.log(`[AddressService] 随机地理第 ${attemptCount} 次失败: ${err.message}`);
      },
      complete() {
        throw new CustomError({
          message: `获取随机地理信息失败（尝试了 ${attemptCount} 次）`,
          logID: 'Error-Info'
        });
      }
    });

    return geographyPolling(async () => {
      const { lat, lon } = this.#getRandomUSCoordinate();
      console.log(`[AddressService] 尝试随机坐标: lat=${lat.toFixed(4)}, lon=${lon.toFixed(4)}`);
      
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
        {
          headers: {
            'User-Agent': 'ToolBox Address Service',
            'Accept': 'application/json'
          }
        }
      );

      this.#validateContentType(response.headers.get('content-type'));
      const data = await response.json();

      if (!data || !data.address?.postcode) {
        throw new Error(`获取随机邮编地理数据失败 (lat: ${lat.toFixed(4)}, lon: ${lon.toFixed(4)})`);
      }

      console.log(`[AddressService] 找到邮编: ${data.address.postcode}`);
      return {
        locationBounds: data.boundingbox,
        postalCode: data.address.postcode
      };
    });
  }

  /**
   * 生成美国境内随机坐标
   * @private
   */
  #getRandomUSCoordinate() {
    const { stateCoordinates } = require('../../utils/usStateData');
    const stateKeys = Object.keys(stateCoordinates);
    const randomState = stateKeys[Math.floor(Math.random() * stateKeys.length)];
    const bounds = stateCoordinates[randomState];

    const minLat = Number(bounds[0].lat);
    const maxLat = Number(bounds[1].lat);
    const minLon = Number(bounds[0].lng);
    const maxLon = Number(bounds[1].lng);

    const lat = Math.random() * (maxLat - minLat) + minLat;
    const lon = Math.random() * (maxLon - minLon) + minLon;

    return { lat, lon };
  }

  /**
   * 生成随机电话号码
   * @private
   */
  #generateRandomPhoneNumber(stateCode) {
    const { areaCodesUS } = require('../../utils/usStateData');
    const areaCodeList = areaCodesUS[stateCode] || ['000'];
    const areaCode = areaCodeList[Math.floor(Math.random() * areaCodeList.length)];
    
    const exchangeCode = Math.floor(200 + Math.random() * 700).toString().padStart(3, '0');
    const lineNumber = Math.floor(1000 + Math.random() * 9000).toString().padStart(4, '0');
    
    return `${areaCode}${exchangeCode}${lineNumber}`;
  }
}

module.exports = AddressService;
