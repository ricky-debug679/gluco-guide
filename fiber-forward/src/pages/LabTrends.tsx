import { Card, Eyebrow, Screen } from "../components/Screen"
import { useAppStore } from "../store/useAppStore"
import { mockLabMetrics } from "../lib/mockData"
import type { LabMetric } from "../lib/types"

const CHART_W = 310
const CHART_H = 150
const X0 = 10
const X1 = 300

function buildChart(metric: LabMetric) {
  const values = metric.readings.map((r) => r.value)
  const bandLo = metric.targetLow
  const bandHi = metric.targetHigh
  const min = Math.min(...values, bandLo) - (Math.max(...values) - Math.min(...values)) * 0.15 - 2
  const max = Math.max(...values, bandHi) + 2
  const yOf = (v: number) => CHART_H - 20 - ((v - min) * (CHART_H - 30)) / (max - min)

  const points = metric.readings.map((r, i) => {
    const x = X0 + ((X1 - X0) * i) / (metric.readings.length - 1)
    return { x, y: yOf(r.value) }
  })

  return {
    points,
    pointsAttr: points.map((p) => `${p.x},${p.y}`).join(" "),
    bandTop: yOf(bandHi),
    bandHeight: yOf(bandLo) - yOf(bandHi),
  }
}

export function LabTrends() {
  const activeKey = useAppStore((s) => s.activeLabKey)
  const setActiveKey = useAppStore((s) => s.setActiveLabKey)
  const metric = mockLabMetrics.find((m) => m.key === activeKey)!
  const chart = buildChart(metric)
  const monthLabels = metric.readings.map((r) =>
    new Date(r.date).toLocaleDateString(undefined, { month: "short" }),
  )

  return (
    <Screen>
      <div>
        <Eyebrow>Lab trends</Eyebrow>
        <h1 className="mt-1.5 text-[1.4rem] font-semibold">Your progress over time</h1>
      </div>

      <div className="flex gap-1.5">
        {mockLabMetrics.map((m) => (
          <button
            key={m.key}
            onClick={() => setActiveKey(m.key)}
            className={`min-h-10 flex-1 rounded-[11px] text-[0.78rem] font-bold ${
              m.key === activeKey
                ? "bg-[color:var(--color-sage)] text-white"
                : "bg-[color:var(--color-surface-2)] text-[color:var(--color-ink-faint)]"
            }`}
          >
            {m.shortLabel}
          </button>
        ))}
      </div>

      <Card>
        <div className="text-[0.78rem] font-bold text-[color:var(--color-ink-faint)]">{metric.label}</div>
        <svg width="100%" viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="mt-2">
          <rect x={0} y={chart.bandTop} width={CHART_W} height={chart.bandHeight} fill="var(--color-sage-bg)" rx={4} />
          <polyline
            points={chart.pointsAttr}
            fill="none"
            stroke="var(--color-berry)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {chart.points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={4.5} fill="var(--color-surface)" stroke="var(--color-berry)" strokeWidth={2.5} />
          ))}
        </svg>
        <div className="mt-0.5 flex justify-between px-1 text-[0.66rem] font-semibold text-[color:var(--color-ink-faint)]">
          {monthLabels.map((m, i) => (
            <span key={i}>{m}</span>
          ))}
        </div>
      </Card>

      <Card className="border-transparent bg-[color:var(--color-sage-bg)]">
        <div className="text-[0.85rem] leading-relaxed">{metric.summary}</div>
      </Card>

      <div className="text-[0.72rem] leading-relaxed text-[color:var(--color-ink-faint)]">
        Target range reflects CDC National Diabetes Prevention Program benchmarks — not a diagnosis. Always
        confirm changes with your doctor.
      </div>
    </Screen>
  )
}
