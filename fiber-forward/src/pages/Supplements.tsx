import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card, Eyebrow } from "../components/Screen"
import { useOptionalHousehold } from "../context/HouseholdContext"
import { useSupplements } from "../hooks/useSupplements"
import { supplementRecommendations } from "../lib/mockData"
import type { SupplementRecommendationKey } from "../lib/types"

type VdChoice = "low" | "normal" | "unsure" | null

export function Supplements() {
  const navigate = useNavigate()
  const householdCtx = useOptionalHousehold()
  const isLive = !!householdCtx
  const selfMemberId = householdCtx?.household.selfMember.id
  const supplements = useSupplements(selfMemberId)

  const [expanded, setExpanded] = useState<SupplementRecommendationKey | null>(null)
  const [dosageDraft, setDosageDraft] = useState("")
  const [vdChoice, setVdChoice] = useState<VdChoice>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showCustom, setShowCustom] = useState(false)
  const [customName, setCustomName] = useState("")
  const [customDosage, setCustomDosage] = useState("")

  const trackedKeys = new Set(supplements.active.map((s) => s.recommendation_key).filter(Boolean))
  const untracked = supplementRecommendations.filter((r) => !trackedKeys.has(r.key))

  function openRecommendation(key: SupplementRecommendationKey, defaultDosage: string) {
    setExpanded(key)
    setDosageDraft(defaultDosage)
    setVdChoice(null)
    setError(null)
  }

  async function confirmTrack(key: SupplementRecommendationKey, name: string) {
    setSaving(true)
    setError(null)
    try {
      if (isLive) await supplements.addSupplement(name, dosageDraft, key)
      setExpanded(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that — try again.")
    } finally {
      setSaving(false)
    }
  }

  async function handleAddCustom() {
    if (!customName.trim()) return
    setSaving(true)
    setError(null)
    try {
      if (isLive) await supplements.addSupplement(customName.trim(), customDosage)
      setCustomName("")
      setCustomDosage("")
      setShowCustom(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that — try again.")
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(supplementId: string) {
    setError(null)
    try {
      if (isLive) await supplements.toggleTaken(supplementId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that — try again.")
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
          <Eyebrow>Supplements</Eyebrow>
        </div>

        <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-5 pb-8 pt-4">
          <h1 className="text-[1.4rem] font-semibold">Track what you take</h1>

          {isLive && supplements.active.length > 0 && (
            <Card className="flex flex-col gap-2.5">
              <Eyebrow>Tracking</Eyebrow>
              {supplements.active.map((s) => {
                const taken = supplements.takenIds.has(s.id)
                return (
                  <div key={s.id} className="flex items-center gap-3 rounded-xl border border-[color:var(--color-line)] p-3">
                    <div className="flex-1">
                      <div className="text-[0.86rem] font-bold">{s.name}</div>
                      {s.dosage && <div className="text-[0.72rem] text-[color:var(--color-ink-faint)]">{s.dosage}</div>}
                    </div>
                    <button
                      onClick={() => handleToggle(s.id)}
                      className={`min-h-9 rounded-lg px-3 text-[0.76rem] font-bold ${
                        taken
                          ? "bg-[color:var(--color-surface-2)] text-[color:var(--color-ink-soft)]"
                          : "bg-[color:var(--color-sage)] text-white"
                      }`}
                    >
                      {taken ? "Taken" : "Mark taken"}
                    </button>
                    <button
                      onClick={() => supplements.stopTracking(s.id)}
                      aria-label="Stop tracking"
                      className="text-[color:var(--color-ink-faint)]"
                    >
                      <svg width={16} height={16} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )
              })}
            </Card>
          )}

          {error && <div className="rounded-xl bg-[color:var(--color-berry-bg)] p-3 text-[0.8rem]">{error}</div>}

          {untracked.length > 0 && (
            <div>
              <Eyebrow>Worth considering</Eyebrow>
              <div className="mt-2.5 flex flex-col gap-2.5">
                {untracked.map((rec) => (
                  <Card key={rec.key}>
                    <div className="text-[0.9rem] font-bold">{rec.name}</div>
                    <div className="mt-1 text-[0.78rem] leading-relaxed text-[color:var(--color-ink-soft)]">
                      {rec.mechanism}
                    </div>

                    {expanded === rec.key ? (
                      <div className="mt-3 flex flex-col gap-2.5">
                        {rec.key === "vitamin_d" && vdChoice === null && (
                          <>
                            <div className="text-[0.8rem] font-semibold">Do you know your recent vitamin D level?</div>
                            <div className="flex flex-col gap-2">
                              <button
                                onClick={() => {
                                  setVdChoice("low")
                                  setDosageDraft("2,000 IU/day (as prescribed)")
                                }}
                                className="min-h-11 rounded-xl bg-[color:var(--color-surface-2)] text-[0.84rem] font-bold"
                              >
                                It's low
                              </button>
                              <button
                                onClick={() => {
                                  setVdChoice("normal")
                                  setDosageDraft(rec.typicalDosage)
                                }}
                                className="min-h-11 rounded-xl bg-[color:var(--color-surface-2)] text-[0.84rem] font-bold"
                              >
                                It's normal
                              </button>
                              <button
                                onClick={() => setVdChoice("unsure")}
                                className="min-h-11 rounded-xl bg-[color:var(--color-surface-2)] text-[0.84rem] font-bold"
                              >
                                I don't know
                              </button>
                            </div>
                          </>
                        )}

                        {rec.key === "vitamin_d" && vdChoice === "unsure" && (
                          <div className="rounded-xl bg-[color:var(--color-honey-bg)] p-3 text-[0.82rem] leading-relaxed">
                            Ask your doctor for a quick 25-hydroxyvitamin D blood test — it's simple and common, and
                            it'll tell you the right dose instead of guessing.
                            <button
                              onClick={() => {
                                setVdChoice("normal")
                                setDosageDraft(rec.typicalDosage)
                              }}
                              className="mt-2 block font-bold text-[color:var(--color-sage)]"
                            >
                              Track anyway without knowing my level →
                            </button>
                          </div>
                        )}

                        {(rec.key !== "vitamin_d" || (vdChoice === "low" || vdChoice === "normal")) && (
                          <>
                            {rec.key === "vitamin_d" && vdChoice === "low" && (
                              <div className="rounded-xl bg-[color:var(--color-honey-bg)] p-3 text-[0.8rem] leading-relaxed">
                                Use the dose your doctor prescribed for a low level, not the general maintenance
                                amount.
                              </div>
                            )}
                            <div>
                              <label className="text-[0.72rem] font-bold uppercase tracking-[0.05em] text-[color:var(--color-ink-faint)]">
                                Dosage
                              </label>
                              <input
                                value={dosageDraft}
                                onChange={(e) => setDosageDraft(e.target.value)}
                                className="mt-1.5 min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3 text-[0.9rem]"
                              />
                            </div>
                            <div className="flex gap-2.5">
                              <button
                                onClick={() => setExpanded(null)}
                                className="min-h-11 flex-1 rounded-xl bg-[color:var(--color-surface-2)] text-[0.85rem] font-bold text-[color:var(--color-ink-soft)]"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => confirmTrack(rec.key, rec.name)}
                                disabled={saving}
                                className="min-h-11 flex-1 rounded-xl bg-[color:var(--color-sage)] text-[0.85rem] font-bold text-white disabled:opacity-60"
                              >
                                {saving ? "Saving…" : "Start tracking"}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => openRecommendation(rec.key, rec.typicalDosage)}
                        className="mt-3 min-h-11 w-full rounded-xl bg-[color:var(--color-surface-2)] text-[0.84rem] font-bold text-[color:var(--color-sage)]"
                      >
                        + Track this
                      </button>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}

          {showCustom ? (
            <Card className="flex flex-col gap-2.5">
              <input
                autoFocus
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Supplement name"
                className="min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3 text-[0.9rem]"
              />
              <input
                value={customDosage}
                onChange={(e) => setCustomDosage(e.target.value)}
                placeholder="Dosage (optional)"
                className="min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3 text-[0.9rem]"
              />
              <div className="flex gap-2.5">
                <button
                  onClick={() => setShowCustom(false)}
                  className="min-h-11 flex-1 rounded-xl bg-[color:var(--color-surface-2)] text-[0.85rem] font-bold text-[color:var(--color-ink-soft)]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddCustom}
                  disabled={!customName.trim() || saving}
                  className="min-h-11 flex-1 rounded-xl bg-[color:var(--color-sage)] text-[0.85rem] font-bold text-white disabled:opacity-60"
                >
                  Add
                </button>
              </div>
            </Card>
          ) : (
            <button
              onClick={() => setShowCustom(true)}
              className="min-h-11 w-full rounded-xl bg-[color:var(--color-surface-2)] py-3 text-[0.85rem] font-bold text-[color:var(--color-ink-soft)]"
            >
              + Track something else
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
