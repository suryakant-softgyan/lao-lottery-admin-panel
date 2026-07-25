/** Agent / retailer distribution-network enums. */

export enum AgentTier {
  Master = 'MASTER',
  Distributor = 'DISTRIBUTOR',
  Retail = 'RETAIL',
}

export enum AgentStatus {
  Active = 'ACTIVE',
  Inactive = 'INACTIVE',
  PendingApproval = 'PENDING_APPROVAL',
  Suspended = 'SUSPENDED',
  Blocked = 'BLOCKED',
  Terminated = 'TERMINATED',
}

export enum RetailerStatus {
  Active = 'ACTIVE',
  Inactive = 'INACTIVE',
  PendingApproval = 'PENDING_APPROVAL',
  Suspended = 'SUSPENDED',
  Closed = 'CLOSED',
}

export enum ShopType {
  Standalone = 'STANDALONE',
  Kiosk = 'KIOSK',
  Convenience = 'CONVENIENCE',
  Supermarket = 'SUPERMARKET',
  FuelStation = 'FUEL_STATION',
  Mobile = 'MOBILE',
}

export enum PosDeviceStatus {
  PendingActivation = 'PENDING_ACTIVATION',
  Active = 'ACTIVE',
  Inactive = 'INACTIVE',
  Maintenance = 'MAINTENANCE',
  Faulty = 'FAULTY',
  Blocked = 'BLOCKED',
  Decommissioned = 'DECOMMISSIONED',
}

export enum PosDeviceModel {
  SunmiV2 = 'SUNMI_V2',
  PaxA920 = 'PAX_A920',
  IngenicoDx8000 = 'INGENICO_DX8000',
  NewlandN910 = 'NEWLAND_N910',
  AndroidTablet = 'ANDROID_TABLET',
  ThermalKiosk = 'THERMAL_KIOSK',
}

/** Lao PDR first-level administrative divisions. */
export enum LaoProvince {
  Vientiane = 'VIENTIANE_CAPITAL',
  VientianeProvince = 'VIENTIANE_PROVINCE',
  LuangPrabang = 'LUANG_PRABANG',
  Savannakhet = 'SAVANNAKHET',
  Champasak = 'CHAMPASAK',
  Xiangkhouang = 'XIANGKHOUANG',
  Bolikhamxai = 'BOLIKHAMXAI',
  Khammouane = 'KHAMMOUANE',
  Oudomxay = 'OUDOMXAY',
  LuangNamtha = 'LUANG_NAMTHA',
  Bokeo = 'BOKEO',
  Phongsaly = 'PHONGSALY',
  Houaphanh = 'HOUAPHANH',
  Xayaboury = 'XAYABOURY',
  Attapeu = 'ATTAPEU',
  Salavan = 'SALAVAN',
  Sekong = 'SEKONG',
  Xaisomboun = 'XAISOMBOUN',
}
