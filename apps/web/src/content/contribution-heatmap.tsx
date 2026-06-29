// apps/web — contribution heatmap: a user's active placement days, coloured by relative intensity
// (bucketed). Compact (active days only); the busiest day sets the top of the scale. The ramp is
// derived from the tenant accent (--qa): empty → faint tint → full accent, never a fixed hue.
import type { dto } from '@quad/core';
import { heatLevel } from './content-client';

// Buckets 0–4: level 0 is the empty/neutral cell; levels 1–4 climb from a faint accent tint to the
// full tenant accent via color-mix, so the heatmap always tracks the active tenant colour.
const LEVEL_COLORS = [
  '#E6E5DF',
  'color-mix(in srgb, var(--qa) 30%, #fff)',
  'color-mix(in srgb, var(--qa) 50%, #fff)',
  'color-mix(in srgb, var(--qa) 72%, #fff)',
  'var(--qa)',
]; // buckets 0–4

const CELL = 14;

export function ContributionHeatmap({ contributions }: { contributions: dto.ContributionDay[] }): React.ReactElement {
  if (contributions.length === 0) {
    return <p style={{ color: 'var(--muted)', fontSize: 18 }}>No contributions yet.</p>;
  }
  const max = contributions.reduce((m, c) => Math.max(m, c.count), 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        role="img"
        aria-label={`Contribution heatmap: ${contributions.length} active day(s)`}
        style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}
      >
        {contributions.map((c) => (
          <span
            key={c.date}
            title={`${c.date}: ${c.count}`}
            style={{
              width: CELL,
              height: CELL,
              background: LEVEL_COLORS[heatLevel(c.count, max)],
              boxShadow: 'inset 0 0 0 1px #00000014',
            }}
          />
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          justifyContent: 'flex-end',
          fontSize: 15,
          textTransform: 'uppercase',
          color: 'var(--muted-faint)',
        }}
      >
        <span>Less</span>
        {LEVEL_COLORS.map((bg) => (
          <span
            key={bg}
            aria-hidden="true"
            style={{ width: CELL, height: CELL, background: bg, boxShadow: 'inset 0 0 0 1px #00000014' }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
