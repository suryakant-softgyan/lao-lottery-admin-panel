/** Colour maths used by the theme engine (tints, shades, contrast, alpha). */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): Rgb {
  const normalised = hex.replace('#', '');
  const full =
    normalised.length === 3
      ? normalised
          .split('')
          .map((character) => character + character)
          .join('')
      : normalised;
  const value = Number.parseInt(full.slice(0, 6), 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const clamp = (channel: number): number => Math.max(0, Math.min(255, Math.round(channel)));
  return `#${((1 << 24) + (clamp(r) << 16) + (clamp(g) << 8) + clamp(b)).toString(16).slice(1)}`;
}

/** `rgba()` string, for translucent overlays and glass surfaces. */
export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

/** Mixes `hex` towards white by `amount` (0–1). */
export function lighten(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex({
    r: r + (255 - r) * amount,
    g: g + (255 - g) * amount,
    b: b + (255 - b) * amount,
  });
}

/** Mixes `hex` towards black by `amount` (0–1). */
export function darken(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex({ r: r * (1 - amount), g: g * (1 - amount), b: b * (1 - amount) });
}

/** Relative luminance per WCAG 2.1. */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const channel = (value: number): number => {
    const scaled = value / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two colours (1–21). */
export function contrastRatio(a: string, b: string): number {
  const lumA = luminance(a);
  const lumB = luminance(b);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Picks black or white text for the supplied background. */
export function readableTextOn(background: string): string {
  return contrastRatio(background, '#ffffff') >= 4.5 ? '#ffffff' : '#111827';
}

/** Builds a 50–900 tonal ramp from a single seed colour. */
export function tonalRamp(hex: string): Record<string, string> {
  return {
    50: lighten(hex, 0.92),
    100: lighten(hex, 0.84),
    200: lighten(hex, 0.68),
    300: lighten(hex, 0.5),
    400: lighten(hex, 0.28),
    500: hex,
    600: darken(hex, 0.14),
    700: darken(hex, 0.28),
    800: darken(hex, 0.42),
    900: darken(hex, 0.56),
  };
}

/**
 * Categorical chart palette derived from the active theme colours, with a
 * colour-blind-safe alternative (Okabe–Ito) when accessibility mode is on.
 */
export const COLOUR_BLIND_SAFE_PALETTE: readonly string[] = [
  '#0072b2',
  '#e69f00',
  '#009e73',
  '#cc79a7',
  '#56b4e9',
  '#d55e00',
  '#f0e442',
  '#7f7f7f',
];

export function chartPalette(seed: string[], colourBlindSafe: boolean): string[] {
  if (colourBlindSafe) {
    return [...COLOUR_BLIND_SAFE_PALETTE];
  }
  const base = seed.filter(Boolean);
  if (base.length === 0) {
    return [...COLOUR_BLIND_SAFE_PALETTE];
  }
  const output: string[] = [...base];
  // Extend the palette with tints/shades so charts never repeat a colour.
  for (let step = 1; output.length < 12; step++) {
    for (const colour of base) {
      if (output.length >= 12) {
        break;
      }
      output.push(step % 2 === 0 ? darken(colour, 0.12 * step) : lighten(colour, 0.16 * step));
    }
  }
  return output;
}
