export class GetAddressByPostalCodeDto {
  zipCode: string;
}

export interface AddressResult {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  latitude?: number;
  longitude?: number;
}
