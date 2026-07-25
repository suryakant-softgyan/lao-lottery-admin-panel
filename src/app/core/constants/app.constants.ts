import type { SelectOption } from '../models/common.model';

/** Prefix for every key this application writes to Web Storage. */
export const STORAGE_PREFIX = 'll-admin';

export const STORAGE_KEYS = {
  accessToken: 'auth.access-token',
  refreshToken: 'auth.refresh-token',
  tokenExpiry: 'auth.token-expiry',
  currentUser: 'auth.user',
  rememberedUser: 'auth.remembered-username',
  theme: 'ui.theme',
  branding: 'ui.branding',
  regional: 'ui.regional',
  language: 'ui.language',
  sidebarState: 'ui.sidebar',
  favourites: 'ui.nav-favourites',
  pinned: 'ui.nav-pinned',
  recentPages: 'ui.nav-recent',
  dashboardLayout: 'ui.dashboard-layout',
  tablePrefs: 'ui.table-prefs',
  featureFlags: 'system.feature-flags',
  tenant: 'system.tenant',
} as const;

export const PAGE_SIZE_OPTIONS: readonly number[] = [10, 25, 50, 100, 200];

export const DEFAULT_PAGE_SIZE = 25;

export const DEBOUNCE_MS = {
  search: 350,
  resize: 120,
  autosave: 800,
} as const;

/** Toast / snackbar durations in milliseconds. */
export const TOAST_DURATION = {
  short: 2500,
  normal: 4000,
  long: 7000,
  sticky: 0,
} as const;

export const DATE_FORMATS = {
  date: 'dd MMM yyyy',
  dateShort: 'dd/MM/yyyy',
  dateTime: 'dd MMM yyyy, HH:mm',
  dateTimeSeconds: 'dd MMM yyyy, HH:mm:ss',
  time: 'HH:mm',
  monthYear: 'MMM yyyy',
  iso: 'yyyy-MM-dd',
} as const;

export const REGEX = {
  /** Lao mobile numbers: +856 20 XXXX XXXX and local 020 forms. */
  laoPhone: /^(\+?856|0)?(20|30)\d{7,8}$/,
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  username: /^[a-zA-Z0-9._-]{4,32}$/,
  /** At least one lower, one upper, one digit, one symbol, 8+ characters. */
  strongPassword: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/,
  numeric: /^\d+$/,
  decimal: /^\d+(\.\d{1,4})?$/,
  ticketNumber: /^LL-\d{4}-\d{6}$/,
  ipAddress: /^(\d{1,3}\.){3}\d{1,3}$/,
  hexColour: /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/,
} as const;

export const VALIDATION_LIMITS = {
  nameMin: 2,
  nameMax: 80,
  usernameMin: 4,
  usernameMax: 32,
  passwordMin: 8,
  passwordMax: 64,
  otpLength: 6,
  notesMax: 1000,
  descriptionMax: 500,
  maxUploadBytes: 10 * 1024 * 1024,
} as const;

export const ACCEPTED_UPLOAD_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'] as const;

export const LANGUAGES: readonly SelectOption[] = [
  { value: 'en', label: 'English', icon: '🇬🇧', description: 'English (United Kingdom)' },
  { value: 'lo', label: 'ລາວ', icon: '🇱🇦', description: 'Lao (ພາສາລາວ)' },
];

/** Application-wide keyboard shortcuts, surfaced in the help dialog. */
export const KEYBOARD_SHORTCUTS: readonly { keys: string; description: string; scope: string }[] = [
  { keys: 'Ctrl/⌘ + K', description: 'Open the command palette', scope: 'Global' },
  { keys: 'Ctrl/⌘ + /', description: 'Focus global search', scope: 'Global' },
  { keys: 'Ctrl/⌘ + B', description: 'Toggle the sidebar', scope: 'Global' },
  { keys: 'Ctrl/⌘ + Shift + D', description: 'Toggle dark mode', scope: 'Global' },
  { keys: 'Ctrl/⌘ + Shift + F', description: 'Toggle fullscreen', scope: 'Global' },
  { keys: 'Ctrl/⌘ + R', description: 'Refresh page data', scope: 'Page' },
  { keys: 'Ctrl/⌘ + P', description: 'Print the current view', scope: 'Page' },
  { keys: 'Ctrl/⌘ + E', description: 'Export the current table', scope: 'Table' },
  { keys: 'Esc', description: 'Close dialog / clear selection', scope: 'Global' },
  { keys: '?', description: 'Show this shortcut reference', scope: 'Global' },
];

/** Placeholder imagery. Swap these for uploaded assets via the Branding page. */
export const PLACEHOLDER = {
  avatar: (seed: string): string =>
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}&backgroundType=gradientLinear`,
  photo: (seed: string, w = 400, h = 300): string =>
    `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`,
  banner: (seed: string): string => `https://picsum.photos/seed/${encodeURIComponent(seed)}/1600/400`,
  logo: 'assets/images/logo.svg',
  logoDark: 'assets/images/logo-dark.svg',
} as const;
