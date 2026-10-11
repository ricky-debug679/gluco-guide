import type { LabReading } from "./types"

const CHART_W = 310
const CHART_H = 150

export function buildChart(readings: LabReading[], targetLow: number, targetHigh: number) {
  if (readings.length === 0) {
    return { points: [] as { x: number; y: number }[], pointsAttr: "", bandTop: 0, bandHeight: 0 }
  }
  const values = readings.map((r) => r.value)
  const spread = Math.max(...values) - Math.min(...values)
  const min = Math.min(...values, targetLow) - spread * 0.15 - 2
  const max = Math.max(...values, targetHigh) + 2
  const range = max - min || 1
  const yOf = (v: number) => CHART_H - 20 - ((v - min) * (CHART_H - 30)) / range

  const points = readings.map((r, i) => ({
    x: readings.length === 1 ? CHART_W / 2 : 10 + ((CHART_W - 20) * i) / (readings.length - 1),
    y: yOf(r.value),
  }))

  return {
    points,
    pointsAttr: points.map((p) => `${p.x},${p.y}`).join(" "),
    bandTop: yOf(targetHigh),
    bandHeight: yOf(targetLow) - yOf(targetHigh),
  }
}

/** Lower is better for every metric this app tracks (fasting glucose, 2-hour glucose, HbA1c).
 *  Structured rather than an English sentence so the UI can localize it via translation keys. */
export type TrendDescription =
  | { kind: "none" }
  | { kind: "firstInRange" }
  | { kind: "firstLogged" }
  | { kind: "dropped"; delta: number; inRange: boolean }
  | { kind: "risen"; delta: number }
  | { kind: "steady"; inRange: boolean }

export function describeTrend(readings: LabReading[], targetHigh: number): TrendDescription {
  if (readings.length === 0) return { kind: "none" }
  if (readings.length === 1) {
    const inRange = readings[0].value <= targetHigh
    return inRange ? { kind: "firstInRange" } : { kind: "firstLogged" }
  }
  const first = readings[0].value
  const last = readings[readings.length - 1].value
  const delta = Math.round((first - last) * 10) / 10
  const inRange = last <= targetHigh
  if (delta > 0) return { kind: "dropped", delta, inRange }
  if (delta < 0) return { kind: "risen", delta: Math.abs(delta) }
  return { kind: "steady", inRange }
}
