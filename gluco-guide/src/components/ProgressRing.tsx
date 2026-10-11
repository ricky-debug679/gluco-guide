import { useTranslation } from "react-i18next"
import { round1 } from "../lib/format"

interface ProgressRingProps {
  value: number
  target: number
  label: string
  unit?: string
  colorVar:
    | "--color-sage"
    | "--color-honey"
    | "--color-berry"
    | "--color-water"
    | "--color-fat"
    | "--color-mind"
    | "--color-supp"
    | "--color-move"
  bgVar:
    | "--color-sage-bg"
    | "--color-honey-bg"
    | "--color-berry-bg"
    | "--color-water-bg"
    | "--color-fat-bg"
    | "--color-mind-bg"
    | "--color-supp-bg"
    | "--color-move-bg"
}

const RADIUS = 34
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function ProgressRing({ value, target, label, unit = "", colorVar, bgVar }: ProgressRingProps) {
  const { t } = useTranslation()
  const fraction = target > 0 ? Math.min(1, value / target) : 0
  const dashOffset = CIRCUMFERENCE * (1 - fraction)

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={78} height={78} viewBox="0 0 78 78">
        <circle cx={39} cy={39} r={RADIUS} fill="none" stroke={`var(${bgVar})`} strokeWidth={8} />
        <circle
          cx={39}
          cy={39}
          r={RADIUS}
          fill="none"
          stroke={`var(${colorVar})`}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 39 39)"
          style={{ transition: "stroke-dashoffset 0.35s ease" }}
        />
        <text x={39} y={35} textAnchor="middle" fontFamily="Lora, serif" fontSize={15} fill="var(--color-ink)">
          {round1(value)}
          {unit}
        </text>
        <text
          x={39}
          y={49}
          textAnchor="middle"
          fontFamily="Karla, sans-serif"
          fontSize={9}
          fill="var(--color-ink-faint)"
        >
          {t("units.ofTarget", { target: `${round1(target)}${unit}` })}
        </text>
      </svg>
      <div className="text-[0.76rem] font-bold text-[color:var(--color-ink-soft)]">{label}</div>
    </div>
  )
}
