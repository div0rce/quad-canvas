// @quad/config — color palette (T5 skeleton). Generic + tenant-configurable.
// A canvas pixel stores a ColorIndex (see @quad/core domain) into the tenant's active palette.
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

/**
 * Baseline palette (placeholder set). Tenants may define their own palettes without code
 * changes (product target: ~32 configurable colors — see docs/PRODUCT.md §7). This minimal
 * starter is intentionally small; the full default set is finalized with the UI spec.
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
  ],
};

/** Registry of available palettes by key. */
export const PALETTES: readonly Palette[] = [DEFAULT_PALETTE];

/** Look up a palette by key; `undefined` if not found. */
export function getPaletteByKey(key: string): Palette | undefined {
  return PALETTES.find((p) => p.key === key);
}
