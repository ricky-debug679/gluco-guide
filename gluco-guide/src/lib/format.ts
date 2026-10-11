/** Rounds to one decimal place, so float sums like 12.299999999999997 show as 12.3. */
export function round1(n: number): number {
  return Math.round(n * 10) / 10
}
