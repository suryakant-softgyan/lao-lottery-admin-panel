/** Sidebar / command-palette navigation contracts. */

export interface NavBadge {
  /** Signal-backed values are resolved by the navigation service at render time. */
  key: string;
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

export interface NavItem {
  id: string;
  /** i18n key; falls back to `label` when the key is missing. */
  labelKey: string;
  label: string;
  icon?: string;
  route?: string;
  /** External link, opened in a new tab. */
  href?: string;
  children?: NavItem[];
  /** Any one of these permissions grants visibility. Empty = always visible. */
  permissions?: string[];
  /** Any one of these roles grants visibility. Empty = always visible. */
  roles?: string[];
  /** Hides the entry when the feature flag is off. */
  featureFlag?: string;
  badge?: NavBadge;
  /** Renders a non-clickable section caption. */
  divider?: boolean;
  sectionTitle?: boolean;
  /** Keywords that make the entry findable in the command palette. */
  keywords?: string[];
  disabled?: boolean;
}

export interface Breadcrumb {
  label: string;
  labelKey?: string;
  url: string;
  icon?: string;
  /** The trailing crumb is not a link. */
  terminal?: boolean;
}

export interface RecentPage {
  route: string;
  label: string;
  icon: string;
  visitedAt: number;
}

export type CommandCategory = 'navigation' | 'action' | 'setting' | 'search' | 'theme' | 'recent' | 'help';

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: string;
  category: CommandCategory;
  keywords: string[];
  shortcut?: string;
  route?: string;
  /** Executed instead of navigating when present. */
  run?: () => void;
  permissions?: string[];
}

export type SearchEntityType = 'user' | 'agent' | 'retailer' | 'ticket' | 'draw' | 'transaction' | 'page';

export interface GlobalSearchResult {
  id: string;
  type: SearchEntityType;
  title: string;
  subtitle: string;
  meta?: string;
  icon: string;
  avatarUrl?: string;
  route: string;
  score: number;
}
