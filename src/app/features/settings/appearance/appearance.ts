import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';

import { LANGUAGES } from '@core/constants/app.constants';
import type {
  AnimationLevel,
  AnimationSpeed,
  ButtonStyle,
  CardStyle,
  ContentWidth,
  Density,
  FontFamilyId,
  HeaderMode,
  IconStyle,
  LoginTheme,
  NavigationMode,
  SidebarMode,
  TableStyle,
  TextDirection,
  ThemeMode,
  ThemeOverrides,
  ThemePresetId,
} from '@core/models/theme.model';
import { ConfirmService } from '@core/services/confirm.service';
import { ThemeService } from '@core/services/theme.service';
import { ToastService } from '@core/services/toast.service';
import { TranslationService } from '@core/services/translation.service';
import { triggerDownload } from '@core/utilities/file.util';
import { PageHeader } from '@shared/components/page-header/page-header';
import { StatCard } from '@shared/components/stat-card/stat-card';

/**
 * Appearance settings.
 *
 * The control surface for the entire theme system: preset, mode, colour
 * overrides, typography, density, shape, component styles, layout, motion and
 * accessibility. Every change is applied live — there is no "preview" mode
 * because the whole portal *is* the preview.
 */
@Component({
  selector: 'll-appearance',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatButtonModule,
    MatSlideToggleModule,
    MatSliderModule,
    MatTabsModule,
    MatTooltipModule,
    PageHeader,
    StatCard,
  ],
  templateUrl: './appearance.html',
  styleUrl: './appearance.scss',
})
export class Appearance {
  protected readonly theme = inject(ThemeService);
  protected readonly translation = inject(TranslationService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly languages = LANGUAGES;
  protected readonly presets = this.theme.presets;
  protected readonly settings = this.theme.settings;

  protected readonly modes: { value: ThemeMode; label: string; icon: string; hint: string }[] = [
    { value: 'light', label: 'Light', icon: 'light_mode', hint: 'Always use the light palette' },
    { value: 'dark', label: 'Dark', icon: 'dark_mode', hint: 'Always use the dark palette' },
    { value: 'auto', label: 'Auto', icon: 'brightness_auto', hint: 'Follow the operating system' },
  ];

  protected readonly fonts: { value: FontFamilyId; label: string; stack: string }[] = [
    { value: 'inter', label: 'Inter', stack: "'Inter', sans-serif" },
    { value: 'roboto', label: 'Roboto', stack: "'Roboto', sans-serif" },
    { value: 'poppins', label: 'Poppins', stack: "'Poppins', sans-serif" },
    { value: 'open-sans', label: 'Open Sans', stack: "'Open Sans', sans-serif" },
    { value: 'nunito', label: 'Nunito', stack: "'Nunito', sans-serif" },
    { value: 'ibm-plex-sans', label: 'IBM Plex Sans', stack: "'IBM Plex Sans', sans-serif" },
  ];

  protected readonly densities: { value: Density; label: string; hint: string }[] = [
    { value: 'comfortable', label: 'Comfortable', hint: 'Generous spacing, easiest to read' },
    { value: 'compact', label: 'Compact', hint: 'Balanced — more rows on screen' },
    { value: 'ultra-compact', label: 'Ultra compact', hint: 'Maximum density for large tables' },
  ];

  protected readonly buttonStyles: ButtonStyle[] = [
    'material',
    'rounded',
    'pill',
    'square',
    'filled',
    'outlined',
    'soft',
    'gradient',
  ];

  protected readonly cardStyles: CardStyle[] = [
    'flat',
    'elevated',
    'glass',
    'gradient',
    'outline',
    'minimal',
  ];

  protected readonly tableStyles: { value: TableStyle; label: string }[] = [
    { value: 'zebra', label: 'Zebra striping' },
    { value: 'hover-highlight', label: 'Hover highlight' },
    { value: 'bordered', label: 'Cell borders' },
    { value: 'compact', label: 'Compact rows' },
    { value: 'comfortable', label: 'Comfortable rows' },
  ];

  protected readonly sidebarModes: { value: SidebarMode; label: string; icon: string }[] = [
    { value: 'expanded', label: 'Expanded', icon: 'menu_open' },
    { value: 'collapsed', label: 'Collapsed', icon: 'menu' },
    { value: 'mini', label: 'Mini rail', icon: 'view_sidebar' },
    { value: 'floating', label: 'Floating', icon: 'filter_none' },
    { value: 'overlay', label: 'Overlay', icon: 'layers' },
  ];

  protected readonly headerModes: { value: HeaderMode; label: string; icon: string }[] = [
    { value: 'fixed', label: 'Fixed', icon: 'push_pin' },
    { value: 'static', label: 'Static', icon: 'horizontal_rule' },
    { value: 'transparent', label: 'Transparent', icon: 'opacity' },
    { value: 'glass', label: 'Glass', icon: 'blur_on' },
  ];

  protected readonly contentWidths: { value: ContentWidth; label: string; icon: string }[] = [
    { value: 'boxed', label: 'Boxed', icon: 'crop_square' },
    { value: 'fluid', label: 'Fluid', icon: 'crop_landscape' },
    { value: 'full', label: 'Full width', icon: 'fit_screen' },
  ];

  protected readonly navigationModes: { value: NavigationMode; label: string; icon: string }[] = [
    { value: 'left', label: 'Left navigation', icon: 'view_sidebar' },
    { value: 'top', label: 'Top navigation', icon: 'view_headline' },
    { value: 'mixed', label: 'Mixed', icon: 'dashboard' },
  ];

  protected readonly loginThemes: { value: LoginTheme; label: string }[] = [
    { value: 'split', label: 'Split screen' },
    { value: 'banking', label: 'Banking' },
    { value: 'corporate', label: 'Corporate' },
    { value: 'glass', label: 'Glass' },
    { value: 'minimal', label: 'Minimal' },
    { value: 'image', label: 'Full background image' },
  ];

  protected readonly iconStyles: { value: IconStyle; label: string }[] = [
    { value: 'material-symbols', label: 'Material Symbols' },
    { value: 'material-outlined', label: 'Material Outlined' },
    { value: 'material-round', label: 'Material Round' },
    { value: 'material-sharp', label: 'Material Sharp' },
  ];

  protected readonly animationLevels: { value: AnimationLevel; label: string; hint: string }[] = [
    { value: 'full', label: 'Full', hint: 'All transitions and entrances' },
    { value: 'reduced', label: 'Reduced', hint: 'Shorter, subtler motion' },
    { value: 'none', label: 'None', hint: 'No animation at all' },
  ];

  protected readonly animationSpeeds: AnimationSpeed[] = ['slow', 'normal', 'fast'];

  /** Colour overrides exposed on the palette editor. */
  protected readonly overrideFields: { key: keyof ThemeOverrides; label: string; hint: string }[] = [
    { key: 'primary', label: 'Primary', hint: 'Buttons, links and active states' },
    { key: 'secondary', label: 'Secondary', hint: 'Supporting accents' },
    { key: 'accent', label: 'Accent', hint: 'Highlights and gradients' },
    { key: 'sidebar', label: 'Sidebar', hint: 'Navigation background' },
    { key: 'header', label: 'Header', hint: 'Top bar background' },
    { key: 'surfaceElevated', label: 'Card background', hint: 'Cards, dialogs and menus' },
    { key: 'tableHeader', label: 'Table header', hint: 'Column header background' },
  ];

  /** Summary tiles describing the current configuration. */
  protected readonly summary = computed(() => {
    const settings = this.settings();
    return [
      {
        id: 'preset',
        label: 'Active preset',
        value: 0,
        formatted: this.theme.activePreset().name,
        icon: 'palette',
        tone: 'primary' as const,
      },
      {
        id: 'mode',
        label: 'Colour mode',
        value: 0,
        formatted: `${settings.mode} (${this.theme.resolvedMode()})`,
        icon: this.theme.isDark() ? 'dark_mode' : 'light_mode',
        tone: 'info' as const,
      },
      {
        id: 'density',
        label: 'Density',
        value: 0,
        formatted: settings.density,
        icon: 'density_medium',
        tone: 'neutral' as const,
      },
      {
        id: 'font',
        label: 'Typeface',
        value: 0,
        formatted: `${settings.typography.fontFamily} · ${settings.typography.fontSize}px`,
        icon: 'text_fields',
        tone: 'success' as const,
      },
    ];
  });

  protected readonly overrideCount = computed(() => Object.keys(this.settings().overrides).length);

  // ------------------------------------------------------------------ actions

  protected setPreset(id: ThemePresetId): void {
    this.theme.setPreset(id);
    this.toast.success('Theme applied', this.theme.activePreset().name);
  }

  protected setMode(mode: ThemeMode): void {
    this.theme.setMode(mode);
  }

  protected setDirection(direction: TextDirection): void {
    this.theme.setDirection(direction);
  }

  protected overrideValue(key: string): string {
    const overrides = this.settings().overrides as Record<string, string | undefined>;
    const palette = this.theme.palette() as unknown as Record<string, string>;
    return overrides[key] ?? palette[key] ?? '#000000';
  }

  protected setOverride(key: string, value: string): void {
    this.theme.setOverride(key as never, value);
  }

  protected clearOverride(key: string): void {
    this.theme.setOverride(key as never, undefined);
  }

  protected clearAllOverrides(): void {
    for (const field of this.overrideFields) {
      this.theme.setOverride(field.key as never, undefined);
    }
    this.toast.info('Colour overrides cleared');
  }

  protected toggleTableStyle(style: TableStyle): void {
    const current = this.settings().tableStyle;
    const next = current.includes(style) ? current.filter((item) => item !== style) : [...current, style];
    this.theme.setTableStyle(next);
  }

  protected isTableStyleOn(style: TableStyle): boolean {
    return this.settings().tableStyle.includes(style);
  }

  protected reset(): void {
    this.confirm
      .ask({
        title: 'Reset appearance to defaults?',
        message:
          'Preset, colours, typography, density, layout and accessibility settings all return to the shipped defaults.',
        confirmLabel: 'Reset appearance',
        tone: 'warning',
        icon: 'restart_alt',
      })
      .subscribe((confirmed) => {
        if (confirmed) {
          this.theme.resetTheme();
          this.toast.success('Appearance reset to defaults');
        }
      });
  }

  /** Exports the appearance configuration for reuse on another deployment. */
  protected exportConfiguration(): void {
    const json = this.theme.exportConfiguration();
    triggerDownload(
      new Blob([json], { type: 'application/json;charset=utf-8;' }),
      'lao-lottery-appearance.json',
    );
    this.toast.success('Configuration exported');
  }

  protected importConfiguration(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    void file.text().then((text) => {
      if (this.theme.importConfiguration(text)) {
        this.toast.success('Configuration imported', 'Appearance updated from the uploaded file.');
      } else {
        this.toast.error('Import failed', 'That file is not a valid appearance configuration.');
      }
      input.value = '';
    });
  }
}
