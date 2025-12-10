// US State Abbreviations Mapping
export const stateAbbreviations: Record<string, string> = {
  Alabama: 'AL',
  Alaska: 'AK',
  Arizona: 'AZ',
  Arkansas: 'AR',
  California: 'CA',
  Colorado: 'CO',
  Connecticut: 'CT',
  Delaware: 'DE',
  Florida: 'FL',
  Georgia: 'GA',
  Hawaii: 'HI',
  Idaho: 'ID',
  Illinois: 'IL',
  Indiana: 'IN',
  Iowa: 'IA',
  Kansas: 'KS',
  Kentucky: 'KY',
  Louisiana: 'LA',
  Maine: 'ME',
  Maryland: 'MD',
  Massachusetts: 'MA',
  Michigan: 'MI',
  Minnesota: 'MN',
  Mississippi: 'MS',
  Missouri: 'MO',
  Montana: 'MT',
  Nebraska: 'NE',
  Nevada: 'NV',
  'New Hampshire': 'NH',
  'New Jersey': 'NJ',
  'New Mexico': 'NM',
  'New York': 'NY',
  'North Carolina': 'NC',
  'North Dakota': 'ND',
  Ohio: 'OH',
  Oklahoma: 'OK',
  Oregon: 'OR',
  Pennsylvania: 'PA',
  'Rhode Island': 'RI',
  'South Carolina': 'SC',
  'South Dakota': 'SD',
  Tennessee: 'TN',
  Texas: 'TX',
  Utah: 'UT',
  Vermont: 'VT',
  Virginia: 'VA',
  Washington: 'WA',
  'West Virginia': 'WV',
  Wisconsin: 'WI',
  Wyoming: 'WY',
};

// State Coordinates (bounding boxes)
export const stateCoordinates: Record<string, Array<{ lat: number; lng: number }>> = {
  Alabama: [
    { lat: 30.2, lng: -88.5 },
    { lat: 35.0, lng: -84.9 },
  ],
  Alaska: [
    { lat: 51.2, lng: -179.1 },
    { lat: 71.5, lng: -129.9 },
  ],
  Arizona: [
    { lat: 31.3, lng: -114.8 },
    { lat: 37.0, lng: -109.0 },
  ],
  California: [
    { lat: 32.5, lng: -124.4 },
    { lat: 42.0, lng: -114.1 },
  ],
  Colorado: [
    { lat: 37.0, lng: -109.0 },
    { lat: 41.0, lng: -102.0 },
  ],
  Florida: [
    { lat: 24.5, lng: -87.6 },
    { lat: 31.0, lng: -80.0 },
  ],
  Georgia: [
    { lat: 30.4, lng: -85.6 },
    { lat: 35.0, lng: -80.8 },
  ],
  Illinois: [
    { lat: 37.0, lng: -91.5 },
    { lat: 42.5, lng: -87.5 },
  ],
  'New York': [
    { lat: 40.5, lng: -79.8 },
    { lat: 45.0, lng: -71.9 },
  ],
  Texas: [
    { lat: 25.8, lng: -106.6 },
    { lat: 36.5, lng: -93.5 },
  ],
  Washington: [
    { lat: 45.5, lng: -124.8 },
    { lat: 49.0, lng: -116.9 },
  ],
};

// Phone Number Area Codes by State
const stateAreaCodes: Record<string, string[]> = {
  AL: ['205', '251', '256', '334', '938'],
  AK: ['907'],
  AZ: ['480', '520', '602', '623', '928'],
  CA: ['209', '213', '310', '323', '408', '415', '510', '530', '559', '562', '619', '626', '650', '661', '707', '714', '760', '805', '818', '831', '858', '909', '916', '925', '949', '951'],
  CO: ['303', '719', '720', '970'],
  FL: ['239', '305', '321', '352', '386', '407', '561', '727', '754', '772', '786', '813', '850', '863', '904', '941', '954'],
  GA: ['229', '404', '470', '478', '678', '706', '762', '770', '912'],
  IL: ['217', '224', '309', '312', '331', '618', '630', '708', '773', '779', '815', '847', '872'],
  NY: ['212', '315', '347', '516', '518', '585', '607', '631', '646', '716', '718', '845', '914', '917', '929'],
  TX: ['210', '214', '254', '281', '325', '346', '361', '409', '430', '432', '469', '512', '682', '713', '737', '806', '817', '830', '832', '903', '915', '936', '940', '956', '972', '979'],
  WA: ['206', '253', '360', '425', '509', '564'],
};

export function getRandomPhoneNumber(stateCode: string): string {
  const areaCodes = stateAreaCodes[stateCode] || ['555'];
  const areaCode = areaCodes[Math.floor(Math.random() * areaCodes.length)];
  const exchange = Math.floor(Math.random() * 900) + 100;
  const subscriber = Math.floor(Math.random() * 9000) + 1000;
  return `(${areaCode}) ${exchange}-${subscriber}`;
}
