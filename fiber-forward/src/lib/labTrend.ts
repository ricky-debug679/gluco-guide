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

/** Lower is better for every metric this app tracks (glucose, HbA1c, LDL). */
export function describeTrend(label: string, readings: LabReading[], targetHigh: number): string {
  if (readings.length === 0) {
    return `No ${label.toLowerCase()} readings yet — add your first one below to start tracking.`
  }
  if (readings.length === 1) {
    const v = readings[0].value
    const inRange = v <= targetHigh
    return inRange
      ? `Your first ${label.toLowerCase()} reading is already inside your target range. Log another over time to see the trend.`
      : `Your first ${label.toLowerCase()} reading is logged. Add another down the road to start seeing a trend.`
  }
  const first = readings[0].value
  const last = readings[readings.length - 1].value
  const delta = Math.round((first - last) * 10) / 10
  const inRange = last <= targetHigh
  if (delta > 0) {
    return `Your ${label.toLowerCase()} has dropped ${delta} since your first reading — ${
      inRange ? "inside your target range." : "trending in the right direction."
    }`
  }
  if (delta < 0) {
    return `Your ${label.toLowerCase()} has risen ${Math.abs(delta)} since your first reading — worth a conversation with your doctor.`
  }
  return `Your ${label.toLowerCase()} has held steady since your first reading${inRange ? ", inside your target range." : "."}`
}
