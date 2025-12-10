import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { stateAbbreviations, stateCoordinates, getRandomPhoneNumber } from '../utils/us-states';
import { createPollingFactory } from '../utils/polling';

@Injectable()
export class AddressService {
  private boundingBox = new Map<string, any>();

  async generatePostalCodeAddress(postalCode: string) {
    const location = await this.getLocationByPostalCode(postalCode);
    if (!this.boundingBox.get(postalCode)) {
      this.boundingBox.set(postalCode, location);
    }
    const addressData = await this.getAddressFromCoordinates(postalCode);
    this.boundingBox.delete(postalCode);
    return {
      data: {
        ...addressData,
        postalCode,
        region: 'us',
      },
    };
  }

  async generateRandomAddress() {
    const { postalCode, location } = await this.getRandomGeographyInfo();
    if (!this.boundingBox.get(postalCode)) {
      this.boundingBox.set(postalCode, location);
    }
    const addressData = await this.getAddressFromCoordinates(postalCode);
    this.boundingBox.delete(postalCode);
    return {
      data: {
        ...addressData,
        postalCode,
        region: 'us',
      },
    };
  }

  private async getAddressFromCoordinates(postalCode: string) {
    const addressPolling = createPollingFactory({
      complete() {
        throw new HttpException('获取随机位置信息失败', HttpStatus.INTERNAL_SERVER_ERROR);
      },
    });

    return addressPolling(async (postalCode: string) => {
      const { lat, lon } = this.postalCodeInBoundingBox(postalCode);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
        {
          headers: {
            'User-Agent': 'NestJS Address Service',
            Accept: 'application/json',
          },
        }
      );

      this.validContentType(response.headers.get('content-type'));
      const data = await response.json();

      if (!data || !data.address.house_number) {
        throw new Error('没有房屋编号，重新获取');
      }

      const { state, house_number, road, city } = data.address;
      const countryCode = stateAbbreviations[state];
      const randomPhone = getRandomPhoneNumber(countryCode);

      return {
        addressLine1: `${house_number} ${road}`,
        city,
        countryCode,
        randomPhone,
      };
    }, postalCode);
  }

  private async getLocationByPostalCode(postalCode: string) {
    const postalPolling = createPollingFactory({
      complete() {
        throw new HttpException('通过邮编获取地理信息失败', HttpStatus.INTERNAL_SERVER_ERROR);
      },
    });

    return postalPolling(async (post: string) => {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?postalcode=${post}&countrycodes=us&format=json&limit=1`,
        {
          headers: {
            'User-Agent': 'NestJS Address Service',
            Accept: 'application/json',
          },
        }
      );

      this.validContentType(response.headers.get('content-type'));
      const data = await response.json();

      if (!data || data.length === 0) {
        throw new Error('通过邮编获取地理数据失败');
      }

      return data[0].boundingbox;
    }, postalCode);
  }

  private validContentType(contentType: string | null) {
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('接口返回数据格式不正确');
    }
  }

  private postalCodeInBoundingBox(postalCode: string) {
    const box = this.boundingBox.get(postalCode);
    const minLatNum = Number(box[0]);
    const maxLatNum = Number(box[1]);
    const minLonNum = Number(box[2]);
    const maxLonNum = Number(box[3]);

    const lat = Math.random() * (maxLatNum - minLatNum) + minLatNum;
    const lon = Math.random() * (maxLonNum - minLonNum) + minLonNum;

    return { lat, lon };
  }

  private getRandomGeographyInfo() {
    const geographyPolling = createPollingFactory({
      complete() {
        throw new HttpException('通过邮编获取地理信息失败', HttpStatus.INTERNAL_SERVER_ERROR);
      },
    });

    return geographyPolling(async () => {
      const { lat, lon } = this.randomInBoundingBox();
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
        {
          headers: {
            'User-Agent': 'NestJS Address Service',
            Accept: 'application/json',
          },
        }
      );

      this.validContentType(response.headers.get('content-type'));
      const data = await response.json();

      if (!data || !data.address?.postcode) {
        throw new Error('获取随机邮编地理数据失败');
      }

      return {
        location: data.boundingbox,
        postalCode: data.address.postcode,
      };
    });
  }

  private randomInBoundingBox() {
    const arr = Object.keys(stateCoordinates);
    const box = stateCoordinates[arr[Math.floor(Math.random() * arr.length)]];
    const minLatNum = Number(box[0].lat);
    const maxLatNum = Number(box[1].lat);
    const minLonNum = Number(box[0].lng);
    const maxLonNum = Number(box[1].lng);

    const lat = Math.random() * (maxLatNum - minLatNum) + minLatNum;
    const lon = Math.random() * (maxLonNum - minLonNum) + minLonNum;

    return { lat, lon };
  }
}
