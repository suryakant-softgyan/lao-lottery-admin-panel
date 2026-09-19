/**
 * Reference pools for the mock dataset.
 *
 * Kept separate from the generator so the vocabulary is easy to review and
 * localise, and so nothing about the data shape is buried inside name lists.
 */

export const LAO_GIVEN_NAMES: readonly string[] = [
  'Somsak',
  'Bounmy',
  'Khamla',
  'Vilaysone',
  'Noy',
  'Souphaphone',
  'Thongdy',
  'Phetsamone',
  'Khamphone',
  'Vandara',
  'Somchai',
  'Manivanh',
  'Bouasone',
  'Khamsing',
  'Souksavanh',
  'Vongsavanh',
  'Chanthala',
  'Phouvong',
  'Sengdao',
  'Malaythong',
  'Kongkeo',
  'Viengkham',
  'Somphone',
  'Latsamy',
  'Bounthanh',
  'Keomany',
  'Sisamone',
  'Thipphakone',
  'Anousone',
  'Daovone',
];

export const LAO_FAMILY_NAMES: readonly string[] = [
  'Vongphachanh',
  'Sisouphanh',
  'Phommachanh',
  'Keodara',
  'Chanthavong',
  'Inthavong',
  'Rattanavong',
  'Sengphachanh',
  'Souvannaphouma',
  'Xayasene',
  'Douangdy',
  'Phimmasone',
  'Vorachit',
  'Sayavong',
  'Khantivong',
  'Luangraj',
  'Namvong',
  'Chounlamany',
  'Southichak',
  'Vilayphone',
  'Bouddavong',
  'Sithideth',
  'Manivong',
  'Phanthavong',
  'Oudomsack',
];

export const PROVINCES: readonly { code: string; name: string; districts: string[] }[] = [
  {
    code: 'VTE',
    name: 'Vientiane Capital',
    districts: [
      'Chanthabuly',
      'Sikhottabong',
      'Xaysetha',
      'Sisattanak',
      'Naxaithong',
      'Xaythany',
      'Hadxaifong',
    ],
  },
  { code: 'VTP', name: 'Vientiane Province', districts: ['Phonhong', 'Thoulakhom', 'Keooudom', 'Vangvieng'] },
  { code: 'LPB', name: 'Luang Prabang', districts: ['Luang Prabang', 'Nambak', 'Pak Ou', 'Xieng Ngeun'] },
  {
    code: 'SVK',
    name: 'Savannakhet',
    districts: ['Kaysone Phomvihane', 'Outhoumphone', 'Atsaphangthong', 'Songkhone'],
  },
  { code: 'CPS', name: 'Champasak', districts: ['Pakse', 'Bachiangchaleunsook', 'Champasak', 'Phonthong'] },
  { code: 'XKH', name: 'Xiangkhouang', districts: ['Pek', 'Kham', 'Nonghet'] },
  { code: 'BLK', name: 'Bolikhamxai', districts: ['Pakxan', 'Thaphabat', 'Pakkading'] },
  { code: 'KHM', name: 'Khammouane', districts: ['Thakhek', 'Mahaxay', 'Nongbok'] },
  { code: 'ODX', name: 'Oudomxay', districts: ['Xay', 'La', 'Namor'] },
  { code: 'LNT', name: 'Luang Namtha', districts: ['Namtha', 'Sing', 'Long'] },
  { code: 'BKO', name: 'Bokeo', districts: ['Houayxay', 'Tonpheung', 'Meung'] },
  { code: 'SLV', name: 'Salavan', districts: ['Salavan', 'Toumlan', 'Lakhonepheng'] },
  { code: 'ATP', name: 'Attapeu', districts: ['Samakkhixay', 'Sanamxay', 'Xaysetha'] },
  { code: 'XSB', name: 'Xaisomboun', districts: ['Anouvong', 'Longcheng', 'Thathom'] },
];

export const VILLAGES: readonly string[] = [
  'Ban Nongbone',
  'Ban Phonpapao',
  'Ban Sisavath',
  'Ban Dongpalep',
  'Ban Thatluang',
  'Ban Saphanthong',
  'Ban Hongkae',
  'Ban Watnak',
  'Ban Sokpaluang',
  'Ban Nonsavang',
];

export const SHOP_PREFIXES: readonly string[] = [
  'Golden',
  'Lucky',
  'Mekong',
  'Champa',
  'Naga',
  'Sunrise',
  'Emerald',
  'Royal',
  'Star',
  'Diamond',
  'Lotus',
  'Elephant',
  'Silver',
  'Prosperity',
  'Fortune',
];

export const SHOP_SUFFIXES: readonly string[] = [
  'Mini Mart',
  'Lottery Shop',
  'Store',
  'Trading',
  'Convenience',
  'Kiosk',
  'Corner',
  'Outlet',
  'Centre',
  'Express',
];

export const BANKS: readonly { code: string; name: string; nameLo: string; swift: string }[] = [
  {
    code: 'BCEL',
    name: 'Banque pour le Commerce Extérieur Lao',
    nameLo: 'ທະນາຄານການຄ້າຕ່າງປະເທດລາວ',
    swift: 'COEBLALA',
  },
  { code: 'LDB', name: 'Lao Development Bank', nameLo: 'ທະນາຄານພັດທະນາລາວ', swift: 'LDBKLALA' },
  { code: 'APB', name: 'Agricultural Promotion Bank', nameLo: 'ທະນາຄານສົ່ງເສີມກະສິກຳ', swift: 'APBKLALA' },
  { code: 'JDB', name: 'Joint Development Bank', nameLo: 'ທະນາຄານຮ່ວມພັດທະນາ', swift: 'JDBKLALA' },
  { code: 'STB', name: 'ST Bank', nameLo: 'ທະນາຄານ ເອສ ທີ', swift: 'STBKLALA' },
  { code: 'BIC', name: 'BIC Bank Lao', nameLo: 'ທະນາຄານ ບີໄອຊີ ລາວ', swift: 'BICKLALA' },
  { code: 'PSVB', name: 'Phongsavanh Bank', nameLo: 'ທະນາຄານ ພงສະຫວັນ', swift: 'PSVBLALA' },
  { code: 'IDB', name: 'Indochina Bank', nameLo: 'ທະນາຄານອິນດູຈີນ', swift: 'IDCBLALA' },
];

export const PAYMENT_GATEWAYS: readonly { code: string; name: string; provider: string }[] = [
  { code: 'BCEL_ONE', name: 'BCEL One', provider: 'BCEL' },
  { code: 'LAO_QR', name: 'Lao National QR', provider: 'Bank of the Lao PDR' },
  { code: 'UMONEY', name: 'U-Money', provider: 'Unitel' },
  { code: 'MMONEY', name: 'M-Money', provider: 'Lao Telecom' },
  { code: 'ONEPAY', name: 'OnePay Gateway', provider: 'LDB' },
  { code: 'CARD_INTL', name: 'International Cards', provider: 'Visa / Mastercard' },
];

export const DEPARTMENTS: readonly string[] = [
  'Operations',
  'Finance',
  'Compliance',
  'Customer Care',
  'Technology',
  'Marketing',
  'Draw Management',
  'Risk & Audit',
  'Executive',
];

export const DESIGNATIONS: readonly string[] = [
  'Manager',
  'Senior Officer',
  'Officer',
  'Supervisor',
  'Analyst',
  'Coordinator',
  'Team Lead',
  'Specialist',
  'Assistant Manager',
  'Head of Department',
];

export const DEVICE_BROWSERS: readonly string[] = ['Chrome 138', 'Edge 138', 'Safari 19', 'Firefox 141'];

export const DEVICE_OS: readonly string[] = [
  'Windows 11',
  'macOS 16',
  'Android 16',
  'iOS 20',
  'Ubuntu 26.04',
];

export const AUDIT_DESCRIPTIONS: readonly string[] = [
  'Updated the commission plan for the northern territory',
  'Approved a retailer KYC submission',
  'Published draw results',
  'Exported the daily sales report',
  'Suspended an agent account pending investigation',
  'Adjusted a wallet balance after a reconciliation variance',
  'Created a new sub-administrator account',
  'Changed the ticket cut-off time for the evening draw',
  'Rejected a withdrawal request flagged by risk rules',
  'Rolled back a draw after a verification mismatch',
  'Enabled a feature flag for the pilot provinces',
  'Reset a user password on a verified support request',
];

export const ANNOUNCEMENT_SEEDS: readonly { title: string; message: string }[] = [
  {
    title: 'Evening draw cut-off moved to 19:30',
    message:
      'From Monday the 6-digit evening draw closes 30 minutes earlier to allow extra verification time.',
  },
  {
    title: 'Scheduled maintenance this Sunday',
    message: 'Payment reconciliation will be unavailable between 02:00 and 04:00 on Sunday.',
  },
  {
    title: 'New commission structure published',
    message: 'Tiered commission rates for distributor agents take effect at the start of next month.',
  },
  {
    title: 'KYC backlog cleared',
    message: 'All retailer verification requests older than seven days have now been processed.',
  },
];

/** Numbers that look plausible for a Lao mobile line. */
export function laoPhone(seedDigits: string): string {
  const prefix = seedDigits.charAt(0) < '5' ? '20 55' : '20 99';
  return `+856 ${prefix}${seedDigits.slice(0, 2)} ${seedDigits.slice(2, 6)}`;
}
