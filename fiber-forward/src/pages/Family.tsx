import { Card, Eyebrow, Screen } from "../components/Screen"
import { useAppStore } from "../store/useAppStore"
import type { AvatarColor } from "../lib/types"

const avatarBg: Record<AvatarColor, string> = {
  sage: "var(--color-sage-bg)",
  honey: "var(--color-honey-bg)",
  berry: "var(--color-berry-bg)",
}
const avatarFg: Record<AvatarColor, string> = {
  sage: "var(--color-sage)",
  honey: "var(--color-honey)",
  berry: "var(--color-berry)",
}

export function Family() {
  const household = useAppStore((s) => s.household)

  return (
    <Screen>
      <div>
        <Eyebrow>Household</Eyebrow>
        <h1 className="mt-1.5 text-[1.4rem] font-semibold">Your family circle</h1>
      </div>

      {household.map((member) => (
        <Card key={member.id} className="flex items-center gap-3.5">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-serif text-[1.1rem] font-semibold"
            style={{ background: avatarBg[member.avatarColor], color: avatarFg[member.avatarColor] }}
          >
            {member.name[0]}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 text-[0.9rem] font-bold">
              {member.name}
              {member.relationship === "self" && (
                <span className="rounded-full bg-[color:var(--color-surface-2)] px-1.5 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-[0.05em] text-[color:var(--color-ink-faint)]">
                  You
                </span>
              )}
            </div>
            <div className="mt-0.5 text-[0.76rem] text-[color:var(--color-ink-faint)]">
              {member.relationship === "self" ? member.goal : `${member.goal} · ${member.statusNote}`}
            </div>
          </div>
        </Card>
      ))}

      <button className="min-h-11 w-full rounded-xl bg-[color:var(--color-surface-2)] py-3 text-[0.85rem] font-bold text-[color:var(--color-ink-soft)]">
        + Invite a family member
      </button>

      <div className="text-[0.72rem] leading-relaxed text-[color:var(--color-ink-faint)]">
        Each person's health data stays private to them unless they choose to share it.
      </div>
    </Screen>
  )
}
