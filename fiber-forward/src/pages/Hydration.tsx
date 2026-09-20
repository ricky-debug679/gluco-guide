import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card, Eyebrow } from "../components/Screen"
import { useAppStore, useCurrentSupplementInfo } from "../store/useAppStore"
import { fiberSupplementOptions } from "../lib/mockData"
import { useOptionalHousehold } from "../context/HouseholdContext"
import { useWaterToday } from "../hooks/useWaterToday"
import { useFiberSupplement } from "../hooks/useFiberSupplement"

const WATER_TARGET = 8

export function Hydration() {
  const navigate = useNavigate()

  // Mock-data path (no backend configured / no session)
  const mockTotals = useAppStore((s) => s.totals)
  const mockTargets = useAppStore((s) => s.targets)
  const mockAddWaterCup = useAppStore((s) => s.addWaterCup)
  const mockRemoveWaterCup = useAppStore((s) => s.removeWaterCup)
  const mockReminder = useAppStore((s) => s.reminder)
  const mockMarkDoseTaken = useAppStore((s) => s.markDoseTaken)
  const mockSelectSupplement = useAppStore((s) => s.selectSupplement)
  const mockSetCustomSupplementName = useAppStore((s) => s.setCustomSupplementName)
  const mockSetCustomSupplementFiberG = useAppStore((s) => s.setCustomSupplementFiberG)
  const mockSupplementInfo = useCurrentSupplementInfo()

  // Real-data path
  const householdCtx = useOptionalHousehold()
  const selfMemberId = householdCtx?.household.selfMember.id
  const water = useWaterToday(selfMemberId)
  const supplement = useFiberSupplement(selfMemberId)
  const [customDraft, setCustomDraft] = useState(mockReminder.customName)
  const [customFiberDraft, setCustomFiberDraft] = useState(String(mockReminder.customFiberG))
  const [markError, setMarkError] = useState<string | null>(null)

  const isLive = !!householdCtx

  const waterCups = isLive ? water.cupsToday : mockTotals.waterCups
  const waterTarget = isLive ? WATER_TARGET : mockTargets.waterCups
  const addCup = isLive ? water.addCup : mockAddWaterCup
  const removeCup = isLive ? water.removeCup : mockRemoveWaterCup

  const selectedKind = isLive ? supplement.kind : mockReminder.selectedKind
  const supplementName = isLive ? supplement.name : mockSupplementInfo.name
  const supplementMechanism = isLive ? supplement.mechanism : mockSupplementInfo.mechanism
  const fiberPerDoseG = isLive ? supplement.fiberPerDoseG : mockSupplementInfo.fiberPerDoseG
  const takenToday = isLive ? supplement.takenToday : mockReminder.takenToday
  const nextDoseTime = mockReminder.nextDoseTime // mock time-of-day for both, for now

  function handleSelect(kind: typeof selectedKind) {
    if (isLive) supplement.select(kind, kind === "custom" ? customDraft : undefined, kind === "custom" ? Number(customFiberDraft) || 0 : undefined)
    else mockSelectSupplement(kind)
  }

  function handleCustomChange(value: string) {
    setCustomDraft(value)
    if (isLive) supplement.select("custom", value, Number(customFiberDraft) || 0)
    else mockSetCustomSupplementName(value)
  }

  function handleCustomFiberChange(value: string) {
    setCustomFiberDraft(value)
    if (isLive) supplement.select("custom", customDraft, Number(value) || 0)
    else mockSetCustomSupplementFiberG(Number(value) || 0)
  }

  async function handleMarkTaken() {
    setMarkError(null)
    try {
      if (isLive) await supplement.markTaken()
      else mockMarkDoseTaken()
    } catch (err) {
      setMarkError(err instanceof Error ? err.message : "Couldn't save that — try again.")
    }
  }

  return (
    <div className="flex h-screen w-full justify-center bg-[color:var(--color-bg)]">
      <div className="flex h-screen w-full max-w-md flex-col">
        <div className="flex items-center gap-2.5 px-5 pt-6">
          <button onClick={() => navigate(-1)} aria-label="Back" className="text-[color:var(--color-ink-faint)]">
            <svg width={20} height={20} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          <div>
            <Eyebrow>Water &amp; fiber</Eyebrow>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-5 pb-8 pt-3">
          <h1 className="text-[1.4rem] font-semibold">Staying on track today</h1>

          <Card>
            <div className="flex items-baseline justify-between">
              <div className="text-[0.92rem] font-bold">Water</div>
              <div className="text-[0.8rem] text-[color:var(--color-ink-soft)]">
                {waterCups} of {waterTarget} cups
              </div>
            </div>
            <div className="mt-3.5 flex gap-2">
              {Array.from({ length: waterTarget }, (_, i) => (
                <div
                  key={i}
                  className={`h-[34px] flex-1 rounded-lg border-[1.5px] border-[color:var(--color-sage)] ${
                    i < waterCups ? "bg-[color:var(--color-sage)]" : "bg-[color:var(--color-sage-bg)]"
                  }`}
                />
              ))}
            </div>
            <div className="mt-2.5 flex gap-2.5">
              <button
                onClick={removeCup}
                className="min-h-11 flex-1 rounded-xl bg-[color:var(--color-surface-2)] text-[0.86rem] font-bold text-[color:var(--color-ink-soft)]"
              >
                − Remove a cup
              </button>
              <button
                onClick={addCup}
                className="min-h-11 flex-1 rounded-xl bg-[color:var(--color-sage)] text-[0.86rem] font-bold text-white"
              >
                + Add a cup
              </button>
            </div>
          </Card>

          <Card>
            <Eyebrow>Next dose</Eyebrow>
            <div className="mt-2.5 flex items-center gap-3">
              <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[11px] bg-[color:var(--color-honey-bg)]">
                <svg width={22} height={22} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-[color:var(--color-honey)]">
                  <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-[0.9rem] font-bold">
                  {supplementName} — {nextDoseTime}
                </div>
                <div className="mt-0.5 text-[0.76rem] text-[color:var(--color-ink-faint)]">{supplementMechanism}</div>
              </div>
            </div>
            <div className="mt-3 rounded-xl bg-[color:var(--color-honey-bg)] p-3.5 text-[0.82rem] leading-relaxed">
              Take with a full 8 oz glass of water — fiber supplements need it to work safely and comfortably.
            </div>
            {fiberPerDoseG > 0 && (
              <div className="mt-2.5 text-[0.76rem] text-[color:var(--color-sage)]">
                Marking this taken adds {fiberPerDoseG}g to today's fiber total.
              </div>
            )}
            {markError && (
              <div className="mt-2.5 rounded-xl bg-[color:var(--color-berry-bg)] p-3 text-[0.8rem]">{markError}</div>
            )}
            <button
              onClick={handleMarkTaken}
              className={`mt-3 min-h-11 w-full rounded-xl text-[0.9rem] font-bold ${
                takenToday
                  ? "bg-[color:var(--color-surface-2)] text-[color:var(--color-ink-soft)]"
                  : "bg-[color:var(--color-sage)] text-white"
              }`}
            >
              {takenToday ? "Marked as taken — tap to undo" : "Mark as taken"}
            </button>
            <div className="mt-2.5 text-[0.76rem] leading-relaxed text-[color:var(--color-ink-faint)]">
              Taking other medication? Space fiber doses by 1–2 hours so it doesn't affect absorption.{" "}
              <a href="#" className="font-bold text-[color:var(--color-sage)]">
                Set up medication times
              </a>
            </div>
          </Card>

          <Card>
            <Eyebrow>Choose your fiber</Eyebrow>
            <div className="mt-1 text-[0.78rem] text-[color:var(--color-ink-soft)]">
              Different fiber types help in different ways — pick what fits you.
            </div>
            <div className="mt-3 flex flex-col gap-2.5">
              {fiberSupplementOptions.map((opt) => {
                const selected = selectedKind === opt.kind
                return (
                  <button
                    key={opt.kind}
                    onClick={() => handleSelect(opt.kind)}
                    className={`rounded-2xl border-[1.5px] p-3.5 text-left ${
                      selected
                        ? "border-[color:var(--color-sage)] bg-[color:var(--color-sage-bg)]"
                        : "border-[color:var(--color-line)] bg-[color:var(--color-surface)]"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-[0.86rem] font-bold">
                      {opt.name}
                      <span className="text-[0.68rem] font-semibold text-[color:var(--color-ink-faint)]">
                        ~{opt.fiberPerDoseG}g/dose
                      </span>
                      {selected && (
                        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[color:var(--color-sage)] px-1.5 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-[0.05em] text-white">
                          <svg width={9} height={9} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                          Tracking
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-[0.78rem] leading-relaxed text-[color:var(--color-ink-soft)]">
                      {opt.mechanism}
                    </div>
                  </button>
                )
              })}

              <button
                onClick={() => handleSelect("custom")}
                className={`rounded-2xl border-[1.5px] p-3.5 text-left ${
                  selectedKind === "custom"
                    ? "border-[color:var(--color-sage)] bg-[color:var(--color-sage-bg)]"
                    : "border-[color:var(--color-line)] bg-[color:var(--color-surface)]"
                }`}
              >
                <div className="flex items-center gap-2 text-[0.86rem] font-bold">
                  Something else
                  {selectedKind === "custom" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-sage)] px-1.5 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-[0.05em] text-white">
                      <svg width={9} height={9} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                      Tracking
                    </span>
                  )}
                </div>
                <div className="mt-1 text-[0.78rem] text-[color:var(--color-ink-soft)]">
                  Already using a specific brand? Enter it below.
                </div>
                {selectedKind === "custom" && (
                  <div className="mt-2.5 grid grid-cols-3 gap-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      autoFocus
                      value={customDraft}
                      onChange={(e) => handleCustomChange(e.target.value)}
                      placeholder="e.g. Metamucil, Benefiber"
                      className="col-span-2 min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3 text-[0.9rem]"
                    />
                    <input
                      type="number"
                      inputMode="decimal"
                      value={customFiberDraft}
                      onChange={(e) => handleCustomFiberChange(e.target.value)}
                      placeholder="g fiber"
                      className="min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3 text-[0.9rem]"
                    />
                  </div>
                )}
              </button>
            </div>
            <div className="mt-3 text-[0.76rem] leading-relaxed text-[color:var(--color-ink-faint)]">
              Ask your doctor before switching fiber supplements, especially if you take other medication.
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
