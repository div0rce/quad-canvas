// apps/web — fixed-window contribution heatmap. Empty profiles still render the full neutral grid;
// activity climbs from gray into the tenant accent instead of a single placement becoming full color.
import type { dto } from '@quad/core';
import { heatLevel } from './content-client';

const DAY_MS = 86_400_000;
const WEEKS = 17;
const DAYS_PER_WEEK = 7;
const TOTAL_DAYS = WEEKS * DAYS_PER_WEEK;

const LEVEL_COLORS = [
  '#D9D8D2',
  'color-mix(in srgb, var(--qa) 24%, #D9D8D2)',
  'color-mix(in srgb, var(--qa) 42%, #D9D8D2)',
  'color-mix(in srgb, var(--qa) 64%, #D9D8D2)',
  'var(--qa)',
] as const;

const WEEKDAY_LABELS = ['', 'M', '', 'W', '', 'F', 'S'] as const;

interface HeatmapDay {
  readonly date: Date;
  readonly key: string;
}

function startOfUtcDay(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function monthLabel(date: Date): string {
  return date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase();
}

function recentDays(): HeatmapDay[] {
  const today = startOfUtcDay();
  const end = new Date(today.getTime() + (DAYS_PER_WEEK - 1 - today.getUTCDay()) * DAY_MS);
  const start = new Date(end.getTime() - (TOTAL_DAYS - 1) * DAY_MS);
  return Array.from({ length: TOTAL_DAYS }, (_, i) => {
    const date = new Date(start.getTime() + i * DAY_MS);
    return { date, key: dateKey(date) };
  });
}

function labelsForWeeks(days: readonly HeatmapDay[]): string[] {
  return Array.from({ length: WEEKS }, (_, week) => {
    const weekDays = days.slice(week * DAYS_PER_WEEK, (week + 1) * DAYS_PER_WEEK);
    const firstOfMonth = weekDays.find((day) => day.date.getUTCDate() === 1);
    if (firstOfMonth) return monthLabel(firstOfMonth.date);
    return week === 0 && weekDays[0] ? monthLabel(weekDays[0].date) : '';
  });
}

export function ContributionHeatmap({ contributions }: { contributions: dto.ContributionDay[] }): React.ReactElement {
  const days = recentDays();
  const counts = new Map(contributions.map((c) => [c.date, c.count]));
  const windowCounts = days.map((day) => counts.get(day.key) ?? 0);
  const max = windowCounts.reduce((m, count) => Math.max(m, count), 0);
  const activeDays = windowCounts.filter((count) => count > 0).length;
  const monthLabels = labelsForWeeks(days);

  return (
    <div className="quad-heatmap" role="img" aria-label={`Contribution heatmap: ${activeDays} active day(s)`}>
      <div className="quad-heatmap__months" aria-hidden="true">
        {monthLabels.map((label, index) => (
          <span key={`${label}-${index}`}>{label}</span>
        ))}
      </div>
      <div className="quad-heatmap__body">
        <div className="quad-heatmap__days" aria-hidden="true">
          {WEEKDAY_LABELS.map((label, index) => (
            <span key={`${label}-${index}`}>{label}</span>
          ))}
        </div>
        <div className="quad-heatmap__grid">
          {days.map((day, index) => {
            const count = windowCounts[index] ?? 0;
            const level = heatLevel(count, max);
            return (
              <span
                key={day.key}
                className="quad-heatmap__cell"
                title={`${day.key}: ${count}`}
                style={{ background: LEVEL_COLORS[level] }}
              />
            );
          })}
        </div>
      </div>
      <div className="quad-heatmap__legend" aria-hidden="true">
        <span>Less</span>
        {LEVEL_COLORS.map((background) => (
          <i key={background} style={{ background }} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
