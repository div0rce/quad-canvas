// @quad/config — color palette. Generic + tenant-configurable.
// A canvas pixel stores a ColorIndex (see @quad/core domain) into the tenant's active palette, or
// an encoded custom RGB color value for the canvas color-picker flow.
// Palettes are config, not code: a tenant references one by key (TenantConfig.palette).

/** A single palette entry: a stable index, a hex value, and a human-readable name. */
export interface PaletteColor {
  readonly index: number;
  readonly hex: string;
  readonly name: string;
}

/** An ordered, tenant-configurable set of colors. */
export interface Palette {
  readonly key: string;
  readonly colors: readonly PaletteColor[];
}

/** Custom colors are encoded above the palette index range without requiring a DB schema change. */
export const CUSTOM_COLOR_OFFSET = 1_000_000;
export const CUSTOM_COLOR_LIMIT = CUSTOM_COLOR_OFFSET + 0xffffff;

/**
 * Baseline 32-color palette from the campus design-system handoff. The first six indices are
 * intentionally preserved from the original production palette so existing pixels do not visually
 * shift when the richer picker ships.
 */
export const DEFAULT_PALETTE: Palette = {
  key: 'default',
  colors: [
    { index: 0, hex: '#FFFFFF', name: 'White' },
    { index: 1, hex: '#000000', name: 'Black' },
    { index: 2, hex: '#CC0033', name: 'Red' },
    { index: 3, hex: '#1D70B8', name: 'Blue' },
    { index: 4, hex: '#2E8B57', name: 'Green' },
    { index: 5, hex: '#F4C20D', name: 'Yellow' },
    { index: 6, hex: '#C9CDD4', name: 'Silver' },
    { index: 7, hex: '#8B939E', name: 'Gray' },
    { index: 8, hex: '#4C515A', name: 'Slate' },
    { index: 9, hex: '#23262B', name: 'Charcoal' },
    { index: 10, hex: '#FF6B6B', name: 'Coral' },
    { index: 11, hex: '#A11212', name: 'Crimson' },
    { index: 12, hex: '#5A1A1A', name: 'Maroon' },
    { index: 13, hex: '#FF9F45', name: 'Orange' },
    { index: 14, hex: '#E0670A', name: 'Pumpkin' },
    { index: 15, hex: '#FFD43B', name: 'Gold' },
    { index: 16, hex: '#FFF1A8', name: 'Cream' },
    { index: 17, hex: '#BFE05A', name: 'Lime' },
    { index: 18, hex: '#0E6B45', name: 'Pine' },
    { index: 19, hex: '#5BE0C8', name: 'Aqua' },
    { index: 20, hex: '#19B3C9', name: 'Cyan' },
    { index: 21, hex: '#2E9BE6', name: 'Sky' },
    { index: 22, hex: '#1A3FA0', name: 'Cobalt' },
    { index: 23, hex: '#122A66', name: 'Navy' },
    { index: 24, hex: '#B79BFF', name: 'Lilac' },
    { index: 25, hex: '#8A5CF5', name: 'Violet' },
    { index: 26, hex: '#6B3FD4', name: 'Purple' },
    { index: 27, hex: '#46217A', name: 'Grape' },
    { index: 28, hex: '#FF8FC8', name: 'Pink' },
    { index: 29, hex: '#E0459E', name: 'Magenta' },
    { index: 30, hex: '#9C5A2A', name: 'Brown' },
    { index: 31, hex: '#F4C7A1', name: 'Sand' },
  ],
};

/** Registry of available palettes by key. */
export const PALETTES: readonly Palette[] = [DEFAULT_PALETTE];

/** Look up a palette by key; `undefined` if not found. */
export function getPaletteByKey(key: string): Palette | undefined {
  return PALETTES.find((p) => p.key === key);
}

/** Look up a palette color by value. */
export function getPaletteColor(paletteKey: string, value: number): PaletteColor | undefined {
  return getPaletteByKey(paletteKey)?.colors.find((color) => color.index === value);
}

const HEX_COLOR_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGB_COLOR_PATTERN = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i;

function byteToHex(value: number): string {
  return value.toString(16).padStart(2, '0').toUpperCase();
}

/**
 * Normalize a user-entered hex or CSS rgb() color to #RRGGBB. Returns null for values that cannot
 * be represented as an opaque RGB canvas pixel.
 */
export function normalizeColorInput(input: string): string | null {
  const trimmed = input.trim();
  const hex = HEX_COLOR_PATTERN.exec(trimmed);
  if (hex?.[1]) {
    const body = hex[1].length === 3 ? hex[1].split('').map((part) => `${part}${part}`).join('') : hex[1];
    return `#${body.toUpperCase()}`;
  }

  const rgb = RGB_COLOR_PATTERN.exec(trimmed);
  if (rgb) {
    const parts = rgb.slice(1).map((part) => Number(part));
    if (parts.length === 3 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
      return `#${parts.map(byteToHex).join('')}`;
    }
  }

  return null;
}

/** Encode a custom RGB color as an integer that can flow through existing pixel storage. */
export function encodeCustomColor(input: string): number | null {
  const hex = normalizeColorInput(input);
  if (!hex) return null;
  return CUSTOM_COLOR_OFFSET + Number.parseInt(hex.slice(1), 16);
}

/** Decode an encoded custom color back to #RRGGBB. */
export function decodeCustomColor(value: number): string | null {
  if (!Number.isInteger(value) || value < CUSTOM_COLOR_OFFSET || value > CUSTOM_COLOR_LIMIT) return null;
  const rgb = value - CUSTOM_COLOR_OFFSET;
  return `#${byteToHex((rgb >> 16) & 0xff)}${byteToHex((rgb >> 8) & 0xff)}${byteToHex(rgb & 0xff)}`;
}

/** True when the value is an encoded custom RGB color. */
export function isCustomColorValue(value: number): boolean {
  return decodeCustomColor(value) !== null;
}

/** True when the value is a color from the tenant palette. */
export function isPaletteColorValue(paletteKey: string, value: number): boolean {
  return getPaletteColor(paletteKey, value) !== undefined;
}

/** True when the value can be persisted as either a palette color or an encoded custom color. */
export function isAllowedColorValue(paletteKey: string, value: number): boolean {
  return isPaletteColorValue(paletteKey, value) || isCustomColorValue(value);
}

/** Hex for a palette/custom color value, or the provided fallback. */
export function colorHexForValue(paletteKey: string, value: number, fallback = '#cccccc'): string {
  return getPaletteColor(paletteKey, value)?.hex ?? decodeCustomColor(value) ?? fallback;
}

/** Human color name for palette/custom values. */
export function colorNameForValue(paletteKey: string, value: number): string {
  const paletteColor = getPaletteColor(paletteKey, value);
  if (paletteColor) return paletteColor.name;
  const customHex = decodeCustomColor(value);
  return customHex ? `Custom ${customHex}` : `color ${value}`;
}
