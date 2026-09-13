import { Card, Screen } from "../components/Screen"

const rows = ["Reminders", "Household", "Units (mg/dL)", "Privacy & sharing"]

export function You() {
  return (
    <Screen>
      <div className="flex items-center gap-3.5">
        <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[color:var(--color-sage-bg)] font-serif text-[1.3rem] font-semibold text-[color:var(--color-sage)]">
          A
        </div>
        <div>
          <h1 className="text-[1.25rem] font-semibold">Asha</h1>
          <div className="mt-0.5 text-[0.78rem] text-[color:var(--color-ink-faint)]">
            Goal: General wellness
          </div>
        </div>
      </div>

      <Card className="p-1">
        {rows.map((row, i) => (
          <button
            key={row}
            className={`flex min-h-11 w-full items-center justify-between px-3 py-3.5 text-left text-[0.88rem] font-bold ${
              i < rows.length - 1 ? "border-b border-[color:var(--color-line)]" : ""
            }`}
          >
            <span>{row}</span>
            <svg width={16} height={16} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-[color:var(--color-ink-faint)]">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        ))}
      </Card>

      <button className="min-h-11 w-full rounded-xl bg-[color:var(--color-surface-2)] py-3 text-[0.85rem] font-bold text-[color:var(--color-ink-soft)]">
        Sign out
      </button>
    </Screen>
  )
}
