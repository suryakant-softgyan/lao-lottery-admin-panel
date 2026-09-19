import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';

import { STORAGE_KEYS } from '../constants/app.constants';
import {
  DEFAULT_BRANDING,
  DEFAULT_REGIONAL,
  DEFAULT_THEME_SETTINGS,
  FONT_STACKS,
  THEME_PRESETS,
  THEME_PRESET_MAP,
} from '../constants/theme-presets.constants';
import type {
  AnimationLevel,
  AnimationSpeed,
  BrandingSettings,
  ButtonStyle,
  CardStyle,
  Density,
  RegionalSettings,
  TableStyle,
  TextDirection,
  ThemeMode,
  ThemePalette,
  ThemePreset,
  ThemePresetId,
  ThemeSettings,
} from '../models/theme.model';
import { chartPalette, darken, lighten, readableTextOn, withAlpha } from '../utilities/colour.util';
import { StorageService } from './storage.service';

const ANIMATION_DURATION: Record<AnimationSpeed, number> = {
  slow: 420,
  normal: 240,
  fast: 130,
};

const DENSITY_SCALE: Record<Density, { row: number; gap: number; control: number }> = {
  comfortable: { row: 52, gap: 20, control: 44 },
  compact: { row: 44, gap: 14, control: 38 },
  'ultra-compact': { row: 36, gap: 10, control: 32 },
};

/**
 * Central appearance engine.
 *
 * The service owns one signal of {@link ThemeSettings} plus branding and
 * regional settings. An `effect` projects the resolved palette onto CSS custom
 * properties on `<html>`, so changes are applied instantly application-wide and
 * no component ever needs a hard-coded colour.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storage = inject(StorageService);

  private readonly settingsSignal = signal<ThemeSettings>(this.restoreSettings());
  private readonly brandingSignal = signal<BrandingSettings>(
    this.storage.get<BrandingSettings>(STORAGE_KEYS.branding, DEFAULT_BRANDING),
  );
  private readonly regionalSignal = signal<RegionalSettings>(
    this.storage.get<RegionalSettings>(STORAGE_KEYS.regional, DEFAULT_REGIONAL),
  );

  /** Tracks the OS colour-scheme preference for `mode: 'auto'`. */
  private readonly systemPrefersDark = signal(this.detectSystemDark());

  readonly settings = this.settingsSignal.asReadonly();
  readonly branding = this.brandingSignal.asReadonly();
  readonly regional = this.regionalSignal.asReadonly();
  readonly presets: readonly ThemePreset[] = THEME_PRESETS;

  /** The concrete light/dark decision after resolving `auto`. */
  readonly resolvedMode = computed<'light' | 'dark'>(() => {
    const mode = this.settingsSignal().mode;
    if (mode === 'auto') {
      return this.systemPrefersDark() ? 'dark' : 'light';
    }
    return mode;
  });

  readonly isDark = computed(() => this.resolvedMode() === 'dark');

  readonly activePreset = computed<ThemePreset>(
    () => THEME_PRESET_MAP.get(this.settingsSignal().presetId) ?? THEME_PRESETS[0]!,
  );

  /** Preset palette with the administrator's colour overrides applied. */
  readonly palette = computed<ThemePalette>(() => {
    const preset = this.activePreset();
    const base = this.resolvedMode() === 'dark' ? preset.dark : preset.light;
    const overrides = this.settingsSignal().overrides;
    const merged: ThemePalette = {
      ...base,
      ...(overrides.primary
        ? { primary: overrides.primary, primaryContrast: readableTextOn(overrides.primary) }
        : {}),
      ...(overrides.secondary
        ? { secondary: overrides.secondary, secondaryContrast: readableTextOn(overrides.secondary) }
        : {}),
      ...(overrides.accent
        ? { accent: overrides.accent, accentContrast: readableTextOn(overrides.accent) }
        : {}),
      ...(overrides.sidebar
        ? { sidebar: overrides.sidebar, sidebarText: readableTextOn(overrides.sidebar) }
        : {}),
      ...(overrides.header ? { header: overrides.header, headerText: readableTextOn(overrides.header) } : {}),
      ...(overrides.surfaceElevated ? { surfaceElevated: overrides.surfaceElevated } : {}),
      ...(overrides.tableHeader ? { tableHeader: overrides.tableHeader } : {}),
    };
    return this.settingsSignal().accessibility.highContrast ? this.boostContrast(merged) : merged;
  });

  /** Ordered colours handed to every chart, honouring colour-blind-safe mode. */
  readonly chartColours = computed(() => {
    const palette = this.palette();
    return chartPalette(
      [palette.primary, palette.secondary, palette.accent, palette.success, palette.warning, palette.info],
      this.settingsSignal().accessibility.colourBlindSafe,
    );
  });

  readonly animationsEnabled = computed(() => this.settingsSignal().animationLevel !== 'none');

  readonly isRtl = computed(() => this.settingsSignal().direction === 'rtl');

  constructor() {
    this.watchSystemPreference();
    // Single projection point: every settings change re-renders the CSS layer.
    effect(() => this.applyToDocument());
  }

  // ---------------------------------------------------------------- mutations

  update(changes: Partial<ThemeSettings>): void {
    this.settingsSignal.update((current) => ({ ...current, ...changes }));
    this.persist();
  }

  setPreset(presetId: ThemePresetId): void {
    const preset = THEME_PRESET_MAP.get(presetId);
    this.settingsSignal.update((current) => ({
      ...current,
      presetId,
      // A preset defines its own identity — drop stale colour overrides.
      overrides: {},
      glassEffect: preset?.forcesGlass ? true : current.glassEffect,
      mode: preset?.preferredMode ?? current.mode,
    }));
    this.persist();
  }

  setMode(mode: ThemeMode): void {
    this.update({ mode });
  }

  toggleDarkMode(): void {
    this.setMode(this.isDark() ? 'light' : 'dark');
  }

  setDirection(direction: TextDirection): void {
    this.update({ direction });
  }

  setDensity(density: Density): void {
    this.update({ density });
  }

  setButtonStyle(buttonStyle: ButtonStyle): void {
    this.update({ buttonStyle });
  }

  setCardStyle(cardStyle: CardStyle): void {
    this.update({ cardStyle });
  }

  setTableStyle(tableStyle: TableStyle[]): void {
    this.update({ tableStyle });
  }

  setAnimation(level: AnimationLevel, speed?: AnimationSpeed): void {
    this.update({ animationLevel: level, ...(speed ? { animationSpeed: speed } : {}) });
  }

  setOverride(key: keyof ThemeSettings['overrides'], value: string | undefined): void {
    this.settingsSignal.update((current) => {
      const overrides = { ...current.overrides };
      if (value) {
        overrides[key] = value;
      } else {
        delete overrides[key];
      }
      return { ...current, overrides };
    });
    this.persist();
  }

  updateTypography(changes: Partial<ThemeSettings['typography']>): void {
    this.settingsSignal.update((current) => ({
      ...current,
      typography: { ...current.typography, ...changes },
    }));
    this.persist();
  }

  updateLayout(changes: Partial<ThemeSettings['layout']>): void {
    this.settingsSignal.update((current) => ({
      ...current,
      layout: { ...current.layout, ...changes },
    }));
    this.persist();
  }

  updateAccessibility(changes: Partial<ThemeSettings['accessibility']>): void {
    this.settingsSignal.update((current) => ({
      ...current,
      accessibility: { ...current.accessibility, ...changes },
    }));
    this.persist();
  }

  updateBranding(changes: Partial<BrandingSettings>): void {
    this.brandingSignal.update((current) => ({ ...current, ...changes }));
    this.storage.set(STORAGE_KEYS.branding, this.brandingSignal());
  }

  updateRegional(changes: Partial<RegionalSettings>): void {
    this.regionalSignal.update((current) => ({ ...current, ...changes }));
    this.storage.set(STORAGE_KEYS.regional, this.regionalSignal());
  }

  resetTheme(): void {
    this.settingsSignal.set({ ...DEFAULT_THEME_SETTINGS });
    this.persist();
  }

  resetBranding(): void {
    this.brandingSignal.set({ ...DEFAULT_BRANDING });
    this.storage.set(STORAGE_KEYS.branding, this.brandingSignal());
  }

  /** Serialises the full appearance configuration for export/white-labelling. */
  exportConfiguration(): string {
    return JSON.stringify(
      { theme: this.settingsSignal(), branding: this.brandingSignal(), regional: this.regionalSignal() },
      null,
      2,
    );
  }

  /** Applies a previously exported configuration. Returns false when invalid. */
  importConfiguration(json: string): boolean {
    try {
      const parsed = JSON.parse(json) as {
        theme?: ThemeSettings;
        branding?: BrandingSettings;
        regional?: RegionalSettings;
      };
      if (parsed.theme) {
        this.settingsSignal.set({ ...DEFAULT_THEME_SETTINGS, ...parsed.theme });
        this.persist();
      }
      if (parsed.branding) {
        this.brandingSignal.set({ ...DEFAULT_BRANDING, ...parsed.branding });
        this.storage.set(STORAGE_KEYS.branding, this.brandingSignal());
      }
      if (parsed.regional) {
        this.regionalSignal.set({ ...DEFAULT_REGIONAL, ...parsed.regional });
        this.storage.set(STORAGE_KEYS.regional, this.regionalSignal());
      }
      return true;
    } catch {
      return false;
    }
  }

  // ------------------------------------------------------------------ internals

  private restoreSettings(): ThemeSettings {
    const stored = this.storage.get<Partial<ThemeSettings>>(STORAGE_KEYS.theme, {});
    // Merge nested objects explicitly so new defaults survive a stale payload.
    return {
      ...DEFAULT_THEME_SETTINGS,
      ...stored,
      typography: { ...DEFAULT_THEME_SETTINGS.typography, ...stored.typography },
      layout: { ...DEFAULT_THEME_SETTINGS.layout, ...stored.layout },
      accessibility: { ...DEFAULT_THEME_SETTINGS.accessibility, ...stored.accessibility },
      overrides: { ...stored.overrides },
    };
  }

  private persist(): void {
    this.storage.set(STORAGE_KEYS.theme, this.settingsSignal());
  }

  private detectSystemDark(): boolean {
    return this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }

  private watchSystemPreference(): void {
    const media = this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
    media?.addEventListener?.('change', (event) => this.systemPrefersDark.set(event.matches));
  }

  /** Pushes text and borders apart for the high-contrast accessibility mode. */
  private boostContrast(palette: ThemePalette): ThemePalette {
    const dark = this.resolvedMode() === 'dark';
    return {
      ...palette,
      textPrimary: dark ? '#ffffff' : '#000000',
      textSecondary: dark ? '#e2e8f0' : '#1f2937',
      textMuted: dark ? '#cbd5e1' : '#374151',
      border: dark ? '#94a3b8' : '#334155',
      surfaceElevated: dark ? '#000000' : '#ffffff',
      background: dark ? '#000000' : '#ffffff',
    };
  }

  /** The single place where appearance state becomes CSS. */
  private applyToDocument(): void {
    const settings = this.settingsSignal();
    const palette = this.palette();
    const root = this.document.documentElement;
    const style = root.style;

    const set = (name: string, value: string): void => style.setProperty(name, value);

    // Core palette.
    set('--ll-primary', palette.primary);
    set('--ll-primary-contrast', palette.primaryContrast);
    set('--ll-primary-soft', withAlpha(palette.primary, 0.12));
    set('--ll-primary-hover', darken(palette.primary, 0.1));
    set('--ll-secondary', palette.secondary);
    set('--ll-secondary-contrast', palette.secondaryContrast);
    set('--ll-secondary-soft', withAlpha(palette.secondary, 0.12));
    set('--ll-accent', palette.accent);
    set('--ll-accent-contrast', palette.accentContrast);
    set('--ll-accent-soft', withAlpha(palette.accent, 0.12));

    // Status colours plus their soft backgrounds for badges and alerts.
    for (const tone of ['success', 'warning', 'danger', 'info'] as const) {
      set(`--ll-${tone}`, palette[tone]);
      set(`--ll-${tone}-soft`, withAlpha(palette[tone], 0.14));
      set(`--ll-${tone}-border`, withAlpha(palette[tone], 0.38));
    }
    set('--ll-neutral', palette.textMuted);
    set('--ll-neutral-soft', withAlpha(palette.textMuted, 0.14));
    set('--ll-neutral-border', withAlpha(palette.textMuted, 0.34));

    // Surfaces.
    set('--ll-background', palette.background);
    set('--ll-surface', palette.surface);
    set('--ll-surface-elevated', palette.surfaceElevated);
    set('--ll-surface-hover', palette.surfaceHover);
    set('--ll-border', palette.border);
    set('--ll-border-strong', darken(palette.border, this.isDark() ? -0.2 : 0.12));
    set('--ll-text', palette.textPrimary);
    set('--ll-text-secondary', palette.textSecondary);
    set('--ll-text-muted', palette.textMuted);
    set('--ll-sidebar', palette.sidebar);
    set('--ll-sidebar-text', palette.sidebarText);
    set('--ll-sidebar-active', palette.sidebarActive);
    set('--ll-sidebar-active-soft', withAlpha(palette.sidebarActive, 0.18));
    set('--ll-header', palette.header);
    set('--ll-header-text', palette.headerText);
    set('--ll-table-header', palette.tableHeader);
    set('--ll-scrim', withAlpha(this.isDark() ? '#000000' : '#0f172a', 0.55));

    // Gradients used by hero banners and gradient buttons/cards.
    set(
      '--ll-gradient-primary',
      `linear-gradient(135deg, ${palette.primary} 0%, ${lighten(palette.accent, 0.08)} 100%)`,
    );
    set(
      '--ll-gradient-hero',
      `linear-gradient(120deg, ${withAlpha(palette.primary, 0.94)} 0%, ${withAlpha(palette.secondary, 0.88)} 55%, ${withAlpha(palette.accent, 0.82)} 100%)`,
    );
    set(
      '--ll-gradient-sidebar',
      `linear-gradient(180deg, ${palette.sidebar} 0%, ${darken(palette.sidebar, 0.18)} 100%)`,
    );

    // Typography.
    set('--ll-font-family', FONT_STACKS[settings.typography.fontFamily] ?? FONT_STACKS['inter']!);
    set('--ll-font-size', `${settings.typography.fontSize}px`);
    set('--ll-line-height', String(settings.typography.lineHeight));
    set('--ll-letter-spacing', `${settings.typography.letterSpacing}px`);

    // Shape, elevation and density.
    set('--ll-radius', `${settings.borderRadius}px`);
    set('--ll-radius-sm', `${Math.max(2, settings.borderRadius - 5)}px`);
    set('--ll-radius-lg', `${settings.borderRadius + 6}px`);
    set('--ll-radius-pill', '999px');
    const shadowAlpha = 0.05 + settings.shadowIntensity * 0.035;
    const shadowColour = this.isDark() ? '#000000' : '#0f172a';
    set('--ll-shadow-xs', `0 1px 2px ${withAlpha(shadowColour, shadowAlpha)}`);
    set('--ll-shadow-sm', `0 2px 8px ${withAlpha(shadowColour, shadowAlpha * 1.2)}`);
    set('--ll-shadow-md', `0 8px 24px ${withAlpha(shadowColour, shadowAlpha * 1.5)}`);
    set('--ll-shadow-lg', `0 18px 44px ${withAlpha(shadowColour, shadowAlpha * 1.8)}`);

    const density = DENSITY_SCALE[settings.density];
    set('--ll-row-height', `${density.row}px`);
    set('--ll-gap', `${density.gap}px`);
    set('--ll-control-height', `${density.control}px`);

    // Motion.
    const duration = settings.animationLevel === 'none' ? 0 : ANIMATION_DURATION[settings.animationSpeed];
    set('--ll-duration', `${duration}ms`);
    set('--ll-duration-fast', `${Math.round(duration * 0.6)}ms`);
    set('--ll-duration-slow', `${Math.round(duration * 1.6)}ms`);
    set('--ll-ease', 'cubic-bezier(0.4, 0, 0.2, 1)');

    // Glass surfaces.
    const glass = settings.glassEffect || this.activePreset().forcesGlass === true;
    set('--ll-glass-blur', glass ? '18px' : '0px');
    set('--ll-glass-bg', withAlpha(palette.surfaceElevated, glass ? 0.72 : 1));
    set('--ll-glass-border', withAlpha(palette.border, glass ? 0.5 : 1));

    // Angular Material bridge — keeps Material components on the same palette.
    set('--mat-sys-primary', palette.primary);
    set('--mat-sys-on-primary', palette.primaryContrast);
    set('--mat-sys-surface', palette.surfaceElevated);
    set('--mat-sys-on-surface', palette.textPrimary);
    set('--mat-sys-background', palette.background);
    set('--mat-sys-error', palette.danger);
    set('--mat-sys-outline', palette.border);

    // Declarative hooks for CSS that varies by discrete option.
    root.dataset['theme'] = this.resolvedMode();
    root.dataset['preset'] = settings.presetId;
    root.dataset['density'] = settings.density;
    root.dataset['buttonStyle'] = settings.buttonStyle;
    root.dataset['cardStyle'] = settings.cardStyle;
    root.dataset['tableStyle'] = settings.tableStyle.join(' ');
    root.dataset['iconStyle'] = settings.iconStyle;
    root.dataset['sidebar'] = settings.layout.sidebar;
    root.dataset['header'] = settings.layout.header;
    root.dataset['contentWidth'] = settings.layout.contentWidth;
    root.dataset['navigation'] = settings.layout.navigation;
    root.dataset['animation'] = settings.animationLevel;
    root.dataset['glass'] = String(glass);
    root.dataset['highContrast'] = String(settings.accessibility.highContrast);
    root.dataset['focusRings'] = String(settings.accessibility.focusIndicators);
    root.dataset['largeTargets'] = String(settings.accessibility.largeTargets);

    root.setAttribute('dir', settings.direction);
    root.style.colorScheme = this.resolvedMode();

    // Keep the mobile browser chrome in step with the header colour.
    this.document.querySelector('meta[name="theme-color"]')?.setAttribute('content', palette.header);
  }
}
