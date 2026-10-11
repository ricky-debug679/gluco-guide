export interface HistoryDay {
  date: string
  value: number
  hasEntry: boolean
}

export const HISTORY_DAYS = 14

export function startOfDaysAgo(daysAgo: number) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - daysAgo)
  return d
}

// Local calendar date as "YYYY-MM-DD". Never use toISOString() for this: it
// converts to UTC first, so in the US evening it already returns tomorrow.
export function localDateKey(d: Date = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

// new Date("YYYY-MM-DD") means UTC midnight, which is the previous evening in
// the US; build the date from its parts so it stays on the local calendar day.
export function parseLocalDate(key: string) {
  const [y, m, d] = key.split("-").map(Number)
  return new Date(y, m - 1, d)
}

// A fixed run of HISTORY_DAYS calendar days (oldest to today), including
// days with no entries, so every history chart shows a consistent, honest
// timeline rather than just the days that happen to have rows. `getDate`
// pulls each row's local calendar date; `reduceDay` folds that day's rows
// into one number (a sum, a count, whatever the caller's metric needs).
export function buildHistoryDays<T>(
  rows: T[],
  getDate: (row: T) => Date,
  reduceDay: (dayRows: T[]) => number,
): HistoryDay[] {
  const byDate = new Map<string, T[]>()
  for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
    byDate.set(localDateKey(startOfDaysAgo(i)), [])
  }
  for (const row of rows) {
    const key = localDateKey(getDate(row))
    const bucket = byDate.get(key)
    if (bucket) bucket.push(row)
  }
  return Array.from(byDate.entries()).map(([date, dayRows]) => ({
    date,
    value: reduceDay(dayRows),
    hasEntry: dayRows.length > 0,
  }))
}
