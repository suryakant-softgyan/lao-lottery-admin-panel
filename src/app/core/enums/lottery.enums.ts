/** Lottery product, draw and ticket enums. */

export enum LotteryType {
  TwoDigit = 'TWO_DIGIT',
  ThreeDigit = 'THREE_DIGIT',
  FourDigit = 'FOUR_DIGIT',
  FiveDigit = 'FIVE_DIGIT',
  SixDigit = 'SIX_DIGIT',
  Animal = 'ANIMAL',
  Special = 'SPECIAL',
  Holiday = 'HOLIDAY',
  Powerball = 'POWERBALL',
}

export enum LotteryStatus {
  Draft = 'DRAFT',
  Active = 'ACTIVE',
  Paused = 'PAUSED',
  Archived = 'ARCHIVED',
}

export enum DrawFrequency {
  Daily = 'DAILY',
  TwiceWeekly = 'TWICE_WEEKLY',
  Weekly = 'WEEKLY',
  Fortnightly = 'FORTNIGHTLY',
  Monthly = 'MONTHLY',
  Special = 'SPECIAL',
}

export enum DrawStatus {
  Scheduled = 'SCHEDULED',
  SalesOpen = 'SALES_OPEN',
  SalesClosed = 'SALES_CLOSED',
  Drawing = 'DRAWING',
  PendingVerification = 'PENDING_VERIFICATION',
  Published = 'PUBLISHED',
  RolledBack = 'ROLLED_BACK',
  Cancelled = 'CANCELLED',
}

export enum DrawMode {
  Manual = 'MANUAL',
  Automatic = 'AUTOMATIC',
  Live = 'LIVE',
}

export enum TicketStatus {
  Pending = 'PENDING',
  Sold = 'SOLD',
  Cancelled = 'CANCELLED',
  Void = 'VOID',
  Winning = 'WINNING',
  Claimed = 'CLAIMED',
  Expired = 'EXPIRED',
}

export enum TicketChannel {
  Retailer = 'RETAILER',
  MobileApp = 'MOBILE_APP',
  Web = 'WEB',
  Pos = 'POS',
  Kiosk = 'KIOSK',
  Ussd = 'USSD',
}

export enum PrizeTierCode {
  Jackpot = 'JACKPOT',
  First = 'FIRST',
  Second = 'SECOND',
  Third = 'THIRD',
  Fourth = 'FOURTH',
  Fifth = 'FIFTH',
  Consolation = 'CONSOLATION',
}

export enum AnimalSymbol {
  Rat = 'RAT',
  Buffalo = 'BUFFALO',
  Tiger = 'TIGER',
  Rabbit = 'RABBIT',
  Naga = 'NAGA',
  Snake = 'SNAKE',
  Horse = 'HORSE',
  Goat = 'GOAT',
  Monkey = 'MONKEY',
  Rooster = 'ROOSTER',
  Dog = 'DOG',
  Elephant = 'ELEPHANT',
}

export enum ClaimStatus {
  Unclaimed = 'UNCLAIMED',
  Submitted = 'SUBMITTED',
  UnderReview = 'UNDER_REVIEW',
  Approved = 'APPROVED',
  Paid = 'PAID',
  Rejected = 'REJECTED',
  Expired = 'EXPIRED',
}
