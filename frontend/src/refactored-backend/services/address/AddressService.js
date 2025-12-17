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
    const { postalCode, locationBounds } = await this.#getRandomGeographyInfo();
    
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
   * 从地理坐标获取地址信息
   * @private
   */
  async #getAddressFromCoordinates(postalCode) {
    const addressPolling = createPollingFactory({
      complete() {
        throw new CustomError({
          message: '获取随机位置信息失败',
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

      if (!data || !data.address.house_number) {
        throw new Error('没有房屋编号，重新获取');
      }

      const { state, house_number, road, city } = data.address;
      const stateCode = stateAbbreviations[state];
      const phoneNumber = this.#generateRandomPhoneNumber(stateCode);

      return {
        addressLine1: `${house_number} ${road}`,
        city,
        stateCode,
        phoneNumber
      };
    }, postalCode);
  }

  /**
   * 通过邮政编码获取地理边界
   * @private
   */
  async #getLocationByPostalCode(postalCode) {
    const postalPolling = createPollingFactory({
      complete() {
        throw new CustomError({
          message: '通过邮编获取地理信息失败',
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
    const geographyPolling = createPollingFactory({
      complete() {
        throw new CustomError({
          message: '获取随机地理信息失败',
          logID: 'Error-Info'
        });
      }
    });

    return geographyPolling(async () => {
      const { lat, lon } = this.#getRandomUSCoordinate();
      
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
        throw new Error('获取随机邮编地理数据失败');
      }

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
