import { useState } from "react"
import { Card, Eyebrow, Screen } from "../components/Screen"
import { useAppStore } from "../store/useAppStore"
import { mockLabMetrics } from "../lib/mockData"
import { useOptionalHousehold } from "../context/HouseholdContext"
import { useLabReadings } from "../hooks/useLabReadings"
import { buildChart, describeTrend } from "../lib/labTrend"

export function LabTrends() {
  const mockActiveKey = useAppStore((s) => s.activeLabKey)
  const setMockActiveKey = useAppStore((s) => s.setActiveLabKey)

  const householdCtx = useOptionalHousehold()
  const isLive = !!householdCtx
  const selfMemberId = householdCtx?.household.selfMember.id
  const labs = useLabReadings(selfMemberId)

  const [localActiveKey, setLocalActiveKey] = useState(mockActiveKey)
  const activeKey = isLive ? localActiveKey : mockActiveKey
  const setActiveKey = isLive ? setLocalActiveKey : setMockActiveKey

  const metricDef = mockLabMetrics.find((m) => m.key === activeKey)!
  const realReadings = labs.readingsByMetric[activeKey] ?? []
  const readings = isLive ? realReadings : metricDef.readings
  const chart = buildChart(readings, metricDef.targetLow, metricDef.targetHigh)
  const summary = isLive ? describeTrend(metricDef.shortLabel, readings, metricDef.targetHigh) : metricDef.summary

  const [showForm, setShowForm] = useState(false)
  const [value, setValue] = useState("")
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)

  async function handleAddReading() {
    const numeric = Number(value)
    if (!numeric || numeric <= 0) return
    setSaving(true)
    try {
      await labs.addReading(activeKey, numeric, date)
      setValue("")
      setShowForm(false)
    } finally {
      setSaving(false)
    }
  }

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

      {chart.points.length > 0 && (
        <Card>
          <div className="text-[0.78rem] font-bold text-[color:var(--color-ink-faint)]">{metricDef.label}</div>
          <svg width="100%" viewBox="0 0 310 150" className="mt-2">
            <rect x={0} y={chart.bandTop} width={310} height={chart.bandHeight} fill="var(--color-sage-bg)" rx={4} />
            {chart.points.length > 1 && (
              <polyline
                points={chart.pointsAttr}
                fill="none"
                stroke="var(--color-berry)"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {chart.points.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={4.5} fill="var(--color-surface)" stroke="var(--color-berry)" strokeWidth={2.5} />
            ))}
          </svg>
          <div className="mt-0.5 flex justify-between px-1 text-[0.66rem] font-semibold text-[color:var(--color-ink-faint)]">
            {readings.map((r, i) => (
              <span key={i}>{new Date(r.date).toLocaleDateString(undefined, { month: "short" })}</span>
            ))}
          </div>
        </Card>
      )}

      <Card className="border-transparent bg-[color:var(--color-sage-bg)]">
        <div className="text-[0.85rem] leading-relaxed">{summary}</div>
      </Card>

      {isLive && (
        <>
          {showForm ? (
            <Card className="flex flex-col gap-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[0.72rem] font-bold uppercase tracking-[0.05em] text-[color:var(--color-ink-faint)]">
                    {metricDef.shortLabel} value
                  </label>
                  <input
                    autoFocus
                    type="number"
                    inputMode="decimal"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="mt-1.5 min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3 text-[0.9rem]"
                  />
                </div>
                <div>
                  <label className="text-[0.72rem] font-bold uppercase tracking-[0.05em] text-[color:var(--color-ink-faint)]">
                    Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="mt-1.5 min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3 text-[0.9rem]"
                  />
                </div>
              </div>
              <div className="flex gap-2.5">
                <button
                  onClick={() => setShowForm(false)}
                  className="min-h-11 flex-1 rounded-xl bg-[color:var(--color-surface-2)] text-[0.85rem] font-bold text-[color:var(--color-ink-soft)]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddReading}
                  disabled={!value || saving}
                  className="min-h-11 flex-1 rounded-xl bg-[color:var(--color-sage)] text-[0.85rem] font-bold text-white disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save reading"}
                </button>
              </div>
            </Card>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="min-h-11 w-full rounded-xl bg-[color:var(--color-surface-2)] py-3 text-[0.85rem] font-bold text-[color:var(--color-ink-soft)]"
            >
              + Add a {metricDef.shortLabel.toLowerCase()} reading
            </button>
          )}
        </>
      )}

      <div className="text-[0.72rem] leading-relaxed text-[color:var(--color-ink-faint)]">
        Target range reflects CDC National Diabetes Prevention Program benchmarks — not a diagnosis. Always
        confirm changes with your doctor.
      </div>
    </Screen>
  )
}
