import type { HistoryDay } from "../lib/history"

interface HistoryChartProps {
  days: HistoryDay[]
  goal: number
  unit: string
  colorVar: string
  locale: string
  selectedDate: string | null
  onSelectDate: (date: string) => void
  noEntryLabel: string
  metGoalLabel: string
  belowGoalLabel: string
  axisNoteLabel: string
  /** Builds the "23g ▲ above by 3g" style sentence shown above the chart for the selected day. */
  dayStatusText: (day: HistoryDay) => string
}

// "YYYY-MM-DD" parses as UTC midnight per spec, which can display as the
// wrong calendar day once converted to local time — build the Date from its
// parts instead so it's unambiguously local.
function dateFromKey(key: string) {
  const [y, m, d] = key.split("-").map(Number)
  return new Date(y, m - 1, d)
}

// Rounds a chart's max value up to a readable step (nearest 2/5/10/50) so the
// top gridline reads as a clean number instead of an arbitrary one like "23".
function niceCeil(n: number) {
  if (n <= 10) return Math.ceil(n / 2) * 2
  if (n <= 50) return Math.ceil(n / 5) * 5
  if (n <= 200) return Math.ceil(n / 10) * 10
  return Math.ceil(n / 50) * 50
}

const CHART_WIDTH = 310
const CHART_HEIGHT = 130
const AXIS_WIDTH = 34
const MARKER_ROW_H = 12
const LABEL_ROW_H = 16
const SVG_HEIGHT = MARKER_ROW_H + CHART_HEIGHT + LABEL_ROW_H

export function HistoryChart({
  days,
  goal,
  unit,
  colorVar,
  locale,
  selectedDate,
  onSelectDate,
  noEntryLabel,
  metGoalLabel,
  belowGoalLabel,
  axisNoteLabel,
  dayStatusText,
}: HistoryChartProps) {
  const axisMax = niceCeil(Math.max(1, goal, ...days.map((d) => d.value)))
  const plotWidth = CHART_WIDTH - AXIS_WIDTH
  const gap = 4
  const barWidth = (plotWidth - gap * (days.length - 1)) / days.length
  const bars = days.map((d, i) => {
    const h = Math.max(2, (d.value / axisMax) * CHART_HEIGHT)
    return {
      ...d,
      x: AXIS_WIDTH + i * (barWidth + gap),
      y: MARKER_ROW_H + (CHART_HEIGHT - h),
      h,
      w: barWidth,
      label: dateFromKey(d.date).toLocaleDateString(locale, { weekday: "narrow" }),
      metGoal: d.value >= goal,
    }
  })
  const goalY = MARKER_ROW_H + CHART_HEIGHT - (Math.min(goal, axisMax) / axisMax) * CHART_HEIGHT

  const activeDate = selectedDate ?? [...days].reverse().find((d) => d.hasEntry)?.date ?? null
  const selectedDay = days.find((d) => d.date === activeDate) ?? null

  return (
    <>
      {selectedDay && (
        <div className="mt-2.5 flex items-baseline justify-between rounded-lg bg-[color:var(--color-surface-2)] px-3 py-2">
          <div className="text-[0.8rem] font-bold">
            {dateFromKey(selectedDay.date).toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" })}
          </div>
          <div className="text-[0.8rem] font-bold" style={{ color: `var(${colorVar})` }}>
            {selectedDay.hasEntry ? dayStatusText(selectedDay) : noEntryLabel}
          </div>
        </div>
      )}

      <svg width="100%" viewBox={`0 0 ${CHART_WIDTH} ${SVG_HEIGHT}`} className="mt-2">
        <line x1={AXIS_WIDTH} y1={MARKER_ROW_H} x2={CHART_WIDTH} y2={MARKER_ROW_H} stroke="var(--color-line)" strokeWidth={1} />
        <line
          x1={AXIS_WIDTH}
          y1={MARKER_ROW_H + CHART_HEIGHT}
          x2={CHART_WIDTH}
          y2={MARKER_ROW_H + CHART_HEIGHT}
          stroke="var(--color-line)"
          strokeWidth={1}
        />
        <text x={AXIS_WIDTH - 4} y={MARKER_ROW_H + 3} textAnchor="end" fontSize={8} fill="var(--color-ink-faint)">
          {axisMax}
        </text>
        <text x={AXIS_WIDTH - 4} y={MARKER_ROW_H + CHART_HEIGHT} textAnchor="end" fontSize={8} fill="var(--color-ink-faint)">
          0
        </text>

        <line
          x1={AXIS_WIDTH}
          y1={goalY}
          x2={CHART_WIDTH}
          y2={goalY}
          stroke="var(--color-ink-faint)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />

        {bars.map((b, i) => {
          const isSelected = b.date === activeDate
          const dayLabel = dateFromKey(b.date).toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" })
          const barDetail = b.hasEntry ? `${b.value}${unit}` : noEntryLabel
          return (
            <g
              key={i}
              onClick={() => onSelectDate(b.date)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onSelectDate(b.date)
              }}
              role="button"
              tabIndex={0}
              aria-label={`${dayLabel}: ${barDetail}`}
              className="fl-history-bar"
              style={{ cursor: "pointer" }}
            >
              <title>{`${dayLabel}: ${barDetail}`}</title>
              <rect
                x={b.x - 1}
                y={0}
                width={b.w + 2}
                height={SVG_HEIGHT}
                rx={4}
                fill={isSelected ? "var(--color-surface-2)" : "transparent"}
              />
              {b.hasEntry && (
                <text
                  x={b.x + b.w / 2}
                  y={MARKER_ROW_H - 2}
                  textAnchor="middle"
                  fontSize={9}
                  fill={`var(${colorVar})`}
                  opacity={b.metGoal ? 1 : 0.45}
                >
                  {b.metGoal ? "▲" : "▼"}
                </text>
              )}
              <rect
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                rx={3}
                fill={`var(${colorVar})`}
                opacity={!b.hasEntry ? 0.22 : b.metGoal ? 1 : 0.45}
                stroke={isSelected ? `var(${colorVar})` : "none"}
                strokeWidth={isSelected ? 1.5 : 0}
              />
              <text
                x={b.x + b.w / 2}
                y={MARKER_ROW_H + CHART_HEIGHT + 14}
                textAnchor="middle"
                fontSize={8}
                fontWeight={isSelected ? 700 : 400}
                fill={isSelected ? "var(--color-ink)" : "var(--color-ink-faint)"}
              >
                {b.label}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="mt-1 flex items-center justify-center gap-4 text-[0.66rem] font-bold text-[color:var(--color-ink-faint)]">
        <span className="flex items-center gap-1">
          <span style={{ color: `var(${colorVar})` }}>▲</span> {metGoalLabel}
        </span>
        <span className="flex items-center gap-1 opacity-70">
          <span style={{ color: `var(${colorVar})` }}>▼</span> {belowGoalLabel}
        </span>
      </div>
      <div className="mt-1 text-center text-[0.64rem] text-[color:var(--color-ink-faint)]">{axisNoteLabel}</div>
    </>
  )
}
