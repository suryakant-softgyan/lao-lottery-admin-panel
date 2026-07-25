/**
 * Appearance contracts.
 *
 * Everything the user can tweak on the Appearance page is expressed here, and
 * the {@link ThemeService} projects it onto CSS custom properties. Components
 * never reference a raw colour — only `var(--ll-*)`.
 */

export type ThemeMode = 'light' | 'dark' | 'auto';

export type ThemePresetId =
  | 'corporate-blue'
  | 'emerald-green'
  | 'royal-purple'
  | 'banking-navy'
  | 'crimson-red'
  | 'sunset-orange'
  | 'teal'
  | 'indigo'
  | 'gold'
  | 'dark-professional'
  | 'midnight-black'
  | 'glassmorphism'
  | 'minimal-white';

export type FontFamilyId = 'inter' | 'roboto' | 'poppins' | 'open-sans' | 'nunito' | 'ibm-plex-sans';

export type IconStyle = 'material-symbols' | 'material-outlined' | 'material-round' | 'material-sharp';

export type Density = 'comfortable' | 'compact' | 'ultra-compact';

export type ButtonStyle =
  'material' | 'rounded' | 'pill' | 'square' | 'filled' | 'outlined' | 'soft' | 'gradient';

export type CardStyle = 'flat' | 'elevated' | 'glass' | 'gradient' | 'outline' | 'minimal';

export type TableStyle = 'zebra' | 'compact' | 'comfortable' | 'bordered' | 'hover-highlight';

export type SidebarMode = 'expanded' | 'collapsed' | 'mini' | 'floating' | 'overlay';

export type HeaderMode = 'fixed' | 'static' | 'transparent' | 'glass';

export type ContentWidth = 'boxed' | 'full' | 'fluid';

export type NavigationMode = 'left' | 'top' | 'mixed';

export type AnimationLevel = 'full' | 'reduced' | 'none';

export type AnimationSpeed = 'slow' | 'normal' | 'fast';

export type LoginTheme = 'banking' | 'corporate' | 'glass' | 'minimal' | 'split' | 'image' | 'video';

export type TextDirection = 'ltr' | 'rtl';

/** Raw palette a preset contributes for one mode. */
export interface ThemePalette {
  primary: string;
  primaryContrast: string;
  secondary: string;
  secondaryContrast: string;
  accent: string;
  accentContrast: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  /** Page background. */
  background: string;
  /** Slightly raised background used behind content. */
  surface: string;
  /** Cards, dialogs, menus. */
  surfaceElevated: string;
  surfaceHover: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  sidebar: string;
  sidebarText: string;
  sidebarActive: string;
  header: string;
  headerText: string;
  tableHeader: string;
}

export interface ThemePreset {
  id: ThemePresetId;
  name: string;
  description: string;
  /** Swatches shown in the preset picker. */
  swatches: string[];
  light: ThemePalette;
  dark: ThemePalette;
  /** Presets such as Glassmorphism force translucency on. */
  forcesGlass?: boolean;
  /** Preset ships with a preferred default mode. */
  preferredMode?: ThemeMode;
}

/** Colour overrides the administrator applies on top of a preset. */
export interface ThemeOverrides {
  primary?: string;
  secondary?: string;
  accent?: string;
  sidebar?: string;
  header?: string;
  surfaceElevated?: string;
  tableHeader?: string;
}

export interface TypographySettings {
  fontFamily: FontFamilyId;
  /** Root font size in px. */
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
}

export interface LayoutSettings {
  sidebar: SidebarMode;
  header: HeaderMode;
  contentWidth: ContentWidth;
  navigation: NavigationMode;
  /** Sidebar is pinned open on desktop. */
  sidebarPinned: boolean;
  showBreadcrumb: boolean;
  showFooter: boolean;
  showQuickPanel: boolean;
}

export interface AccessibilitySettings {
  highContrast: boolean;
  colourBlindSafe: boolean;
  focusIndicators: boolean;
  largeTargets: boolean;
  screenReaderHints: boolean;
}

export interface ThemeSettings {
  presetId: ThemePresetId;
  mode: ThemeMode;
  direction: TextDirection;
  overrides: ThemeOverrides;
  typography: TypographySettings;
  layout: LayoutSettings;
  accessibility: AccessibilitySettings;
  density: Density;
  borderRadius: number;
  shadowIntensity: number;
  buttonStyle: ButtonStyle;
  cardStyle: CardStyle;
  tableStyle: TableStyle[];
  iconStyle: IconStyle;
  animationLevel: AnimationLevel;
  animationSpeed: AnimationSpeed;
  glassEffect: boolean;
  loginTheme: LoginTheme;
}

/** White-label / branding payload. Replaceable by an upload endpoint later. */
export interface BrandingSettings {
  applicationName: string;
  applicationShortName: string;
  companyName: string;
  logoUrl: string;
  logoDarkUrl: string;
  loginLogoUrl: string;
  faviconUrl: string;
  dashboardBannerUrl: string;
  loginBackgroundUrl: string;
  loginVideoUrl: string;
  loadingAnimationUrl: string;
  loginWelcomeTitle: string;
  loginWelcomeMessage: string;
  footerText: string;
  copyright: string;
  supportEmail: string;
  supportPhone: string;
  primaryDomain: string;
}

/** Regional formatting, part of the white-label contract. */
export interface RegionalSettings {
  locale: string;
  currency: string;
  currencySymbol: string;
  currencyPosition: 'prefix' | 'suffix';
  dateFormat: string;
  timeFormat: '12h' | '24h';
  timezone: string;
  numberGrouping: boolean;
  firstDayOfWeek: 0 | 1 | 6;
}

/** A user-saved dashboard arrangement. */
export interface DashboardWidgetState {
  id: string;
  order: number;
  visible: boolean;
  pinned: boolean;
  /** Column span on a 12-column grid. */
  span: number;
}

export interface DashboardLayoutState {
  widgets: DashboardWidgetState[];
  updatedAt: number;
}
