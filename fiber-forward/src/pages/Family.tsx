import { useState } from "react"
import { Card, Eyebrow, Screen } from "../components/Screen"
import { useAppStore } from "../store/useAppStore"
import { useOptionalHousehold } from "../context/HouseholdContext"
import { useAddFamilyMember } from "../hooks/useHousehold"
import type { AvatarColor } from "../lib/types"

const avatarBg: Record<string, string> = {
  sage: "var(--color-sage-bg)",
  honey: "var(--color-honey-bg)",
  berry: "var(--color-berry-bg)",
}
const avatarFg: Record<string, string> = {
  sage: "var(--color-sage)",
  honey: "var(--color-honey)",
  berry: "var(--color-berry)",
}

export function Family() {
  const mockHousehold = useAppStore((s) => s.household)
  const householdCtx = useOptionalHousehold()
  const addMember = useAddFamilyMember(householdCtx?.household.householdId)

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState("")
  const [goal, setGoal] = useState("")

  const members = householdCtx
    ? householdCtx.household.members.map((m) => ({
        id: m.id,
        name: m.display_name,
        relationship: m.relationship,
        goal: m.goal ?? "No goal set yet",
        statusNote: "",
        avatarColor: m.avatar_color as AvatarColor,
      }))
    : mockHousehold

  async function handleAdd() {
    if (!name.trim()) return
    await addMember.mutateAsync({ displayName: name.trim(), goal: goal.trim() || "General wellness" })
    setName("")
    setGoal("")
    setShowForm(false)
  }

  return (
    <Screen>
      <div>
        <Eyebrow>Household</Eyebrow>
        <h1 className="mt-1.5 text-[1.4rem] font-semibold">Your family circle</h1>
      </div>

      {members.map((member) => (
        <Card key={member.id} className="flex items-center gap-3.5">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-serif text-[1.1rem] font-semibold"
            style={{ background: avatarBg[member.avatarColor], color: avatarFg[member.avatarColor] }}
          >
            {member.name[0]?.toUpperCase()}
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
              {member.relationship === "self" || !member.statusNote
                ? member.goal
                : `${member.goal} · ${member.statusNote}`}
            </div>
          </div>
        </Card>
      ))}

      {showForm ? (
        <Card className="flex flex-col gap-2.5">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Their name"
            className="min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3 text-[0.9rem]"
          />
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Their wellness goal (optional)"
            className="min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3 text-[0.9rem]"
          />
          <div className="flex gap-2.5">
            <button
              onClick={() => setShowForm(false)}
              className="min-h-11 flex-1 rounded-xl bg-[color:var(--color-surface-2)] text-[0.85rem] font-bold text-[color:var(--color-ink-soft)]"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!name.trim() || addMember.isPending}
              className="min-h-11 flex-1 rounded-xl bg-[color:var(--color-sage)] text-[0.85rem] font-bold text-white disabled:opacity-60"
            >
              {addMember.isPending ? "Adding…" : "Add"}
            </button>
          </div>
        </Card>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="min-h-11 w-full rounded-xl bg-[color:var(--color-surface-2)] py-3 text-[0.85rem] font-bold text-[color:var(--color-ink-soft)]"
        >
          + Invite a family member
        </button>
      )}

      <div className="text-[0.72rem] leading-relaxed text-[color:var(--color-ink-faint)]">
        Each person's health data stays private to them unless they choose to share it.
      </div>
    </Screen>
  )
}
