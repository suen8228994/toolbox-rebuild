import { Controller, Get, Post, Body } from '@nestjs/common';
import { AddressService } from '../services/address.service';

class AddressDto {
  postalCode: string;
}

@Controller('address')
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  @Post('postal')
  async getPostalCodeAddress(@Body() body: AddressDto) {
    return this.addressService.generatePostalCodeAddress(body.postalCode);
  }

  @Get('random')
  async getRandomAddress() {
    return this.addressService.generateRandomAddress();
  }
}
