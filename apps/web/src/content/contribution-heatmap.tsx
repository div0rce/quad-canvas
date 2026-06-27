// apps/web — contribution heatmap: a user's active placement days, coloured by relative intensity
// (GitHub-style buckets). Compact (active days only); the busiest day sets the top of the scale.
import type { dto } from '@quad/core';
import { heatLevel } from './content-client';

const LEVEL_COLORS = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39']; // buckets 0–4

export function ContributionHeatmap({ contributions }: { contributions: dto.ContributionDay[] }): React.ReactElement {
  if (contributions.length === 0) {
    return <p style={{ color: '#666' }}>No contributions yet.</p>;
  }
  const max = contributions.reduce((m, c) => Math.max(m, c.count), 0);
  return (
    <div
      role="img"
      aria-label={`Contribution heatmap: ${contributions.length} active day(s)`}
      style={{ display: 'flex', flexWrap: 'wrap', gap: 2, maxWidth: 340 }}
    >
      {contributions.map((c) => (
        <span
          key={c.date}
          title={`${c.date}: ${c.count}`}
          style={{ width: 12, height: 12, borderRadius: 2, background: LEVEL_COLORS[heatLevel(c.count, max)] }}
        />
      ))}
    </div>
  );
}
