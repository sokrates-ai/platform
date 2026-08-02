type TimestampedAnalyticsItem = {
  creation_date?: string | null
  completed_date?: string | null
  verified_date?: string | null
}

/**
 * Parse a backend timestamp. The API stores naive datetimes as
 * `str(datetime.now())`, e.g. "2026-07-06 14:30:00.123456" (space-separated, no
 * timezone). Both timestamps in a delta share the same interpretation, so the
 * difference is correct regardless of the local timezone offset.
 */
function parseTimestamp(value?: string | null): number | null {
  if (!value) return null
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const ms = new Date(normalized).getTime()
  return Number.isNaN(ms) ? null : ms
}

/**
 * Average positive delta (in milliseconds) between two timestamp fields across
 * the given steps. Steps missing either timestamp, or with a non-positive delta
 * (clock skew / bad data), are ignored. Returns null when there's no sample.
 */
function averageDeltaMs(
  steps: TimestampedAnalyticsItem[],
  fromField: keyof TimestampedAnalyticsItem,
  toField: keyof TimestampedAnalyticsItem
): number | null {
  let sum = 0
  let count = 0
  for (const step of steps) {
    const from = parseTimestamp(step[fromField] as string | null | undefined)
    const to = parseTimestamp(step[toField] as string | null | undefined)
    if (from === null || to === null) continue
    const delta = to - from
    if (delta < 0) continue
    sum += delta
    count += 1
  }
  return count > 0 ? sum / count : null
}

/** Avg time from first view (creation) to marking complete. */
export function avgTaskDurationMs(steps: TimestampedAnalyticsItem[]): number | null {
  return averageDeltaMs(steps, 'creation_date', 'completed_date')
}

/** Avg time from student completion to first tutor verification. */
export function avgTutorResponseMs(steps: TimestampedAnalyticsItem[]): number | null {
  return averageDeltaMs(steps, 'completed_date', 'verified_date')
}

/**
 * Human-readable compact duration, e.g. "45s", "12m", "3.5h", "2.1d".
 * Returns "—" for a null/absent value so cards render cleanly before data
 * (or the backend columns) exist.
 */
export function formatDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return '—'
  const seconds = ms / 1000
  if (seconds < 60) return `${Math.round(seconds)}s`
  const minutes = seconds / 60
  if (minutes < 60) return `${Math.round(minutes)}m`
  const hours = minutes / 60
  if (hours < 24) return `${hours.toFixed(hours < 10 ? 1 : 0)}h`
  const days = hours / 24
  return `${days.toFixed(days < 10 ? 1 : 0)}d`
}
