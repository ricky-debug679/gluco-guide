import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Card, Eyebrow } from "../components/Screen"
import { useAppStore, useCurrentSupplementInfo } from "../store/useAppStore"
import { fiberSupplementOptions } from "../lib/content"
import { useOptionalHousehold } from "../context/HouseholdContext"
import { useWaterToday } from "../hooks/useWaterToday"
import { useFiberSupplement } from "../hooks/useFiberSupplement"
import type { FiberSupplementKind } from "../lib/types"

const WATER_TARGET = 8

export function Hydration() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  // Demo-data path (no backend configured / no session)
  const demoTotals = useAppStore((s) => s.totals)
  const demoTargets = useAppStore((s) => s.targets)
  const demoAddWaterCup = useAppStore((s) => s.addWaterCup)
  const demoRemoveWaterCup = useAppStore((s) => s.removeWaterCup)
  const demoReminder = useAppStore((s) => s.reminder)
  const demoMarkDoseTaken = useAppStore((s) => s.markDoseTaken)
  const demoSelectSupplement = useAppStore((s) => s.selectSupplement)
  const demoSetCustomSupplementName = useAppStore((s) => s.setCustomSupplementName)
  const demoSetCustomSupplementFiberG = useAppStore((s) => s.setCustomSupplementFiberG)
  const demoSupplementInfo = useCurrentSupplementInfo()

  // Real-data path
  const householdCtx = useOptionalHousehold()
  const selfMemberId = householdCtx?.household.selfMember.id
  const water = useWaterToday(selfMemberId)
  const supplement = useFiberSupplement(selfMemberId)
  const [markError, setMarkError] = useState<string | null>(null)

  const [editingCustom, setEditingCustom] = useState(false)
  const [customNameDraft, setCustomNameDraft] = useState("")
  const [customFiberDraft, setCustomFiberDraft] = useState("")
  const [customError, setCustomError] = useState<string | null>(null)

  const isLive = !!householdCtx

  const waterCups = isLive ? water.cupsToday : demoTotals.waterCups
  const waterTarget = isLive ? WATER_TARGET : demoTargets.waterCups
  const addCup = isLive ? water.addCup : demoAddWaterCup
  const removeCup = isLive ? water.removeCup : demoRemoveWaterCup

  const selectedKind = isLive ? supplement.kind : demoReminder.selectedKind
  const supplementName = isLive ? supplement.name : demoSupplementInfo.name
  const supplementMechanism = isLive ? supplement.mechanism : demoSupplementInfo.mechanism
  const supplementTiming = isLive ? supplement.timingNote : demoSupplementInfo.timingNote
  const supplementUsage = isLive ? supplement.customUsage : ""
  const fiberPerDoseG = isLive ? supplement.fiberPerDoseG : demoSupplementInfo.fiberPerDoseG
  const takenToday = isLive ? supplement.takenToday : demoReminder.takenToday
  const hasPreference = isLive ? supplement.hasPreference : true
  const isSavingCustom = isLive && supplement.isSavingCustom
  const isRemoving = isLive && supplement.isRemoving

  function openCustomEditor() {
    setCustomNameDraft(isLive ? supplement.customName : demoReminder.customName)
    setCustomFiberDraft(isLive ? String(supplement.customFiberG ?? "") : String(demoReminder.customFiberG || ""))
    setCustomError(null)
    setEditingCustom(true)
  }

  async function handleSelectPreset(kind: Exclude<FiberSupplementKind, "custom">) {
    setEditingCustom(false)
    if (isLive) await supplement.select(kind)
    else demoSelectSupplement(kind)
  }

  async function handleSaveCustom() {
    const name = customNameDraft.trim()
    if (!name) return
    setCustomError(null)
    try {
      if (isLive) {
        await supplement.saveCustom(name, customFiberDraft ? Number(customFiberDraft) : null)
      } else {
        demoSetCustomSupplementName(name)
        demoSetCustomSupplementFiberG(Number(customFiberDraft) || 0)
        demoSelectSupplement("custom", name)
      }
      setEditingCustom(false)
    } catch (err) {
      setCustomError(err instanceof Error ? err.message : t("common.genericError"))
    }
  }

  async function handleRemovePreference() {
    setCustomError(null)
    try {
      if (isLive) await supplement.remove()
    } catch (err) {
      setCustomError(err instanceof Error ? err.message : t("common.genericError"))
    }
  }

  async function handleMarkTaken() {
    setMarkError(null)
    try {
      if (isLive) await supplement.markTaken()
      else demoMarkDoseTaken()
    } catch (err) {
      setMarkError(err instanceof Error ? err.message : t("common.genericError"))
    }
  }

  return (
    <div className="flex h-screen w-full justify-center bg-[color:var(--color-bg)]">
      <div className="flex h-screen w-full max-w-md flex-col">
        <div className="flex items-center gap-2.5 px-5 pt-6">
          <button onClick={() => navigate(-1)} aria-label={t("common.back")} className="text-[color:var(--color-ink-faint)]">
            <svg width={20} height={20} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          <div>
            <Eyebrow>{t("hydration.eyebrow")}</Eyebrow>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-5 pb-8 pt-3">
          <h1 className="text-[1.4rem] font-semibold">{t("hydration.title")}</h1>

          <Card>
            <div className="flex items-baseline justify-between">
              <div className="text-[0.92rem] font-bold">{t("hydration.water")}</div>
              <div className="text-[0.8rem] text-[color:var(--color-ink-soft)]">
                {t("hydration.cupsOf", { count: waterCups, target: waterTarget })}
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
                {t("hydration.removeCup")}
              </button>
              <button
                onClick={addCup}
                className="min-h-11 flex-1 rounded-xl bg-[color:var(--color-sage)] text-[0.86rem] font-bold text-white"
              >
                {t("hydration.addCup")}
              </button>
            </div>
          </Card>

          <Card>
            <div className="flex items-baseline justify-between">
              <Eyebrow>{t("hydration.nextDose")}</Eyebrow>
              {isLive && hasPreference && (
                <button
                  onClick={() => void handleRemovePreference()}
                  disabled={isRemoving}
                  className="text-[0.74rem] font-bold text-[color:var(--color-berry)] disabled:opacity-50"
                >
                  {isRemoving ? t("hydration.removing") : t("hydration.removePreference")}
                </button>
              )}
            </div>
            <div className="mt-2.5 flex items-center gap-3">
              <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[11px] bg-[color:var(--color-honey-bg)]">
                <svg width={22} height={22} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-[color:var(--color-honey)]">
                  <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-[0.9rem] font-bold">{supplementName}</div>
                <div className="mt-0.5 text-[0.76rem] text-[color:var(--color-ink-faint)]">{supplementMechanism}</div>
              </div>
            </div>
            {supplementUsage && (
              <div className="mt-2.5 text-[0.78rem] leading-relaxed text-[color:var(--color-ink-soft)]">{supplementUsage}</div>
            )}
            <div className="mt-3 rounded-xl bg-[color:var(--color-honey-bg)] p-3.5 text-[0.82rem] leading-relaxed">
              {supplementTiming}
            </div>
            {selectedKind === "custom" && supplementMechanism && (
              <div className="mt-2 text-[0.7rem] text-[color:var(--color-ink-faint)]">{t("common.aiEstimateDisclaimer")}</div>
            )}
            {fiberPerDoseG > 0 && (
              <div className="mt-2.5 text-[0.76rem] text-[color:var(--color-sage)]">
                {t("hydration.addsFiber", { grams: fiberPerDoseG })}
              </div>
            )}
            {markError && (
              <div className="mt-2.5 rounded-xl bg-[color:var(--color-berry-bg)] p-3 text-[0.8rem]">{markError}</div>
            )}
            <button
              onClick={() => void handleMarkTaken()}
              className={`mt-3 min-h-11 w-full rounded-xl text-[0.9rem] font-bold ${
                takenToday
                  ? "bg-[color:var(--color-surface-2)] text-[color:var(--color-ink-soft)]"
                  : "bg-[color:var(--color-sage)] text-white"
              }`}
            >
              {takenToday ? t("hydration.markedTaken") : t("hydration.markTaken")}
            </button>
            <div className="mt-2.5 text-[0.76rem] leading-relaxed text-[color:var(--color-ink-faint)]">
              {t("hydration.medicationNote")}
            </div>
          </Card>

          <Card>
            <Eyebrow>{t("hydration.chooseFiber")}</Eyebrow>
            <div className="mt-1 text-[0.78rem] text-[color:var(--color-ink-soft)]">
              {t("hydration.chooseFiberSubtitle")}
            </div>
            <div className="mt-3 flex flex-col gap-2.5">
              {fiberSupplementOptions.map((opt) => {
                // hasPreference gates this, not just a kind match — kind
                // still falls back to "psyllium" as a display suggestion
                // even with no real preference saved, and that fallback
                // must never look like an actual tracked choice.
                const selected = hasPreference && selectedKind === opt.kind
                return (
                  <button
                    key={opt.kind}
                    onClick={() => void handleSelectPreset(opt.kind as Exclude<FiberSupplementKind, "custom">)}
                    className={`rounded-2xl border-[1.5px] p-3.5 text-left ${
                      selected
                        ? "border-[color:var(--color-sage)] bg-[color:var(--color-sage-bg)]"
                        : "border-[color:var(--color-line)] bg-[color:var(--color-surface)]"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-[0.86rem] font-bold">
                      {opt.name}
                      <span className="text-[0.68rem] font-semibold text-[color:var(--color-ink-faint)]">
                        {t("hydration.perDose", { grams: opt.fiberPerDoseG })}
                      </span>
                      {selected && (
                        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[color:var(--color-sage)] px-1.5 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-[0.05em] text-white">
                          <svg width={9} height={9} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                          {t("hydration.tracking")}
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
                onClick={openCustomEditor}
                className={`rounded-2xl border-[1.5px] p-3.5 text-left ${
                  selectedKind === "custom"
                    ? "border-[color:var(--color-sage)] bg-[color:var(--color-sage-bg)]"
                    : "border-[color:var(--color-line)] bg-[color:var(--color-surface)]"
                }`}
              >
                <div className="flex items-center gap-2 text-[0.86rem] font-bold">
                  {selectedKind === "custom" && !editingCustom && supplementName
                    ? supplementName
                    : t("hydration.somethingElse")}
                  {selectedKind === "custom" && !editingCustom && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-sage)] px-1.5 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-[0.05em] text-white">
                      <svg width={9} height={9} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                      {t("hydration.tracking")}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-[0.78rem] text-[color:var(--color-ink-soft)]">
                  {selectedKind === "custom" && !editingCustom
                    ? t("hydration.tapToEdit")
                    : t("hydration.somethingElseSubtitle")}
                </div>
                {editingCustom && (
                  <div className="mt-2.5 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        autoFocus
                        value={customNameDraft}
                        onChange={(e) => setCustomNameDraft(e.target.value)}
                        placeholder={t("hydration.customNamePlaceholder")}
                        className="col-span-2 min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3 text-[0.9rem]"
                      />
                      <input
                        type="number"
                        inputMode="decimal"
                        value={customFiberDraft}
                        onChange={(e) => setCustomFiberDraft(e.target.value)}
                        placeholder={t("hydration.customFiberPlaceholder")}
                        className="min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3 text-[0.9rem]"
                      />
                    </div>
                    <div className="text-[0.72rem] text-[color:var(--color-ink-faint)]">
                      {t("hydration.customResearchNote")}
                    </div>
                    {customError && (
                      <div className="rounded-xl bg-[color:var(--color-berry-bg)] p-3 text-[0.8rem]">{customError}</div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingCustom(false)}
                        disabled={isSavingCustom}
                        className="min-h-10 flex-1 rounded-xl bg-[color:var(--color-surface-2)] text-[0.82rem] font-bold text-[color:var(--color-ink-soft)] disabled:opacity-60"
                      >
                        {t("common.cancel")}
                      </button>
                      <button
                        onClick={() => void handleSaveCustom()}
                        disabled={isSavingCustom || !customNameDraft.trim()}
                        className="min-h-10 flex-1 rounded-xl bg-[color:var(--color-sage)] text-[0.82rem] font-bold text-white disabled:opacity-60"
                      >
                        {isSavingCustom ? t("hydration.researching") : t("hydration.saveFiber")}
                      </button>
                    </div>
                  </div>
                )}
              </button>
            </div>
            <div className="mt-3 text-[0.76rem] leading-relaxed text-[color:var(--color-ink-faint)]">
              {t("hydration.switchNote")}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
