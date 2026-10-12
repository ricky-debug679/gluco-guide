import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Card, Eyebrow, Screen } from "../components/Screen"
import { useOptionalHousehold } from "../context/HouseholdContext"
import { useClearWeightGoal, useCompleteProfile, useSetWeightGoal } from "../hooks/useHousehold"
import { useDeleteAccount } from "../hooks/useDeleteAccount"
import { supabase } from "../lib/supabase"
import {
  activityLevelKeys,
  bmiCategory,
  buildCaloriePlan,
  calculateBmi,
  cmToFeetInches,
  feetInchesToCm,
  kgToLbs,
  lbsToKg,
  type ActivityLevel,
  type BiologicalSex,
} from "../lib/caloriePlan"
import { goalKeys } from "../lib/goals"
import { round1 } from "../lib/format"

const MS_PER_DAY = 86_400_000

export function Profile() {
  const { t, i18n } = useTranslation()
  const householdCtx = useOptionalHousehold()
  const isLive = !!householdCtx
  const selfMember = householdCtx?.household.selfMember
  const completeProfile = useCompleteProfile(selfMember?.id)
  const setWeightGoal = useSetWeightGoal(selfMember?.id)
  const clearWeightGoal = useClearWeightGoal(selfMember?.id)
  const { deleteAccount, isDeleting } = useDeleteAccount()

  const initialHeight = selfMember?.height_cm ? cmToFeetInches(selfMember.height_cm) : { feet: 5, inches: 4 }
  const [name, setName] = useState(selfMember?.display_name ?? "")
  const [goalIndex, setGoalIndex] = useState<number | null>(
    selfMember?.goal ? goalKeys.findIndex((g) => g === selfMember.goal) : null,
  )
  const [heightFeet, setHeightFeet] = useState(String(initialHeight.feet))
  const [heightInches, setHeightInches] = useState(String(initialHeight.inches))
  const [weightLbs, setWeightLbs] = useState(selfMember?.weight_kg ? String(Math.round(kgToLbs(selfMember.weight_kg))) : "")
  const [age, setAge] = useState(selfMember?.age ? String(selfMember.age) : "")
  const [sex, setSex] = useState<BiologicalSex | null>(selfMember?.biological_sex ?? null)
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(selfMember?.activity_level ?? null)
  const [saving, setSaving] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileSaved, setProfileSaved] = useState(false)

  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSaved, setPasswordSaved] = useState(false)

  const [targetWeightLbs, setTargetWeightLbs] = useState("")
  const [goalSaving, setGoalSaving] = useState(false)
  const [goalError, setGoalError] = useState<string | null>(null)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const heightCmDraft = Number(heightFeet) ? feetInchesToCm(Number(heightFeet), Number(heightInches) || 0) : null
  const weightKgDraft = Number(weightLbs) ? lbsToKg(Number(weightLbs)) : null
  const bmi = heightCmDraft && weightKgDraft ? calculateBmi(heightCmDraft, weightKgDraft) : null
  const bmiCat = bmi ? bmiCategory(bmi) : null

  const hasGoal = !!selfMember?.target_weight_kg
  const goalStartKg = selfMember?.goal_start_weight_kg ?? selfMember?.weight_kg ?? 0
  const goalCurrentKg = selfMember?.weight_kg ?? goalStartKg
  const goalTargetKg = selfMember?.target_weight_kg ?? 0
  const goalTotalDeltaKg = goalStartKg - goalTargetKg
  const goalProgressKg = goalStartKg - goalCurrentKg
  const goalFraction =
    goalTotalDeltaKg !== 0
      ? Math.min(1, Math.max(0, goalProgressKg / goalTotalDeltaKg))
      : goalCurrentKg === goalTargetKg
        ? 1
        : 0
  const goalReached = goalTotalDeltaKg > 0 ? goalCurrentKg <= goalTargetKg : goalTotalDeltaKg < 0 ? goalCurrentKg >= goalTargetKg : true
  // The finish date comes from the same calorie plan the rings use, so it
  // always matches the pace the app is actually planning for.
  const goalEstimate = (() => {
    const m = selfMember
    if (!hasGoal || goalReached || !m?.height_cm || !m.weight_kg || !m.age || !m.biological_sex || !m.activity_level) return null
    if (goalTargetKg >= goalCurrentKg) return { kind: "gain" as const }
    const plan = buildCaloriePlan({
      heightCm: m.height_cm,
      weightKg: m.weight_kg,
      age: m.age,
      sex: m.biological_sex,
      activityLevel: m.activity_level,
      targetWeightKg: goalTargetKg,
    })
    if (plan.weeklyChangeKg >= 0) {
      return { kind: goalTargetKg < plan.healthyWeightLowKg ? ("belowHealthy" as const) : ("noDeficit" as const) }
    }
    const weeks = (goalCurrentKg - goalTargetKg) / -plan.weeklyChangeKg
    return {
      kind: "eta" as const,
      rateLb: round1(kgToLbs(-plan.weeklyChangeKg)),
      date: new Date(Date.now() + weeks * 7 * MS_PER_DAY),
    }
  })()
  const goalStatus = goalReached
    ? t("profile.goalReached")
    : goalEstimate?.kind === "eta"
      ? t("profile.goalEta", {
          rate: goalEstimate.rateLb,
          target: Math.round(kgToLbs(goalTargetKg)),
          unit: t("profile.lb"),
          date: goalEstimate.date.toLocaleDateString(i18n.language, {
            month: "short",
            day: "numeric",
            ...(goalEstimate.date.getFullYear() !== new Date().getFullYear() && { year: "numeric" }),
          }),
        })
      : goalEstimate?.kind === "belowHealthy"
        ? t("profile.goalBelowHealthy")
        : goalEstimate?.kind === "gain"
          ? t("profile.goalGain")
          : goalEstimate?.kind === "noDeficit"
            ? t("profile.goalNoDeficit")
            : null

  async function handleSave() {
    if (!selfMember || !sex || !activityLevel) return
    setSaving(true)
    setProfileError(null)
    setProfileSaved(false)
    try {
      await completeProfile.mutateAsync({
        displayName: name.trim() || selfMember.display_name,
        goal: goalIndex !== null ? goalKeys[goalIndex] : selfMember.goal ?? "generalWellness",
        heightCm: feetInchesToCm(Number(heightFeet), Number(heightInches) || 0),
        weightKg: lbsToKg(Number(weightLbs)),
        age: Number(age),
        sex,
        activityLevel,
      })
      setProfileSaved(true)
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : t("onboarding.genericError"))
    } finally {
      setSaving(false)
    }
  }

  async function handleChangePassword() {
    setPasswordError(null)
    setPasswordSaved(false)
    if (newPassword.length < 6) {
      setPasswordError(t("profile.passwordTooShort"))
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t("profile.passwordMismatch"))
      return
    }
    setPasswordSaving(true)
    try {
      if (!supabase) throw new Error("Supabase is not configured")
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setPasswordSaved(true)
      setNewPassword("")
      setConfirmPassword("")
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : t("onboarding.genericError"))
    } finally {
      setPasswordSaving(false)
    }
  }

  async function handleSignOut() {
    if (supabase) await supabase.auth.signOut()
  }

  async function handleSetGoal() {
    if (!selfMember?.weight_kg || !targetWeightLbs) return
    setGoalSaving(true)
    setGoalError(null)
    try {
      await setWeightGoal.mutateAsync({
        targetWeightKg: lbsToKg(Number(targetWeightLbs)),
        startWeightKg: selfMember.weight_kg,
      })
      setTargetWeightLbs("")
    } catch (err) {
      setGoalError(err instanceof Error ? err.message : t("onboarding.genericError"))
    } finally {
      setGoalSaving(false)
    }
  }

  async function handleClearGoal() {
    setGoalSaving(true)
    setGoalError(null)
    try {
      await clearWeightGoal.mutateAsync()
    } catch (err) {
      setGoalError(err instanceof Error ? err.message : t("onboarding.genericError"))
    } finally {
      setGoalSaving(false)
    }
  }

  async function handleDeleteAccount() {
    setDeleteError(null)
    try {
      await deleteAccount()
      // No navigation needed — App.tsx's useSession picks up the now-null
      // session and renders the Auth screen on its own.
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : t("onboarding.genericError"))
    }
  }

  return (
    <Screen>
      <div>
        <Eyebrow>{t("profile.eyebrow")}</Eyebrow>
        <h1 className="mt-1.5 text-[1.4rem] font-semibold">{t("profile.title")}</h1>
      </div>

      {!isLive ? (
        <Card>
          <div className="text-[0.9rem] text-[color:var(--color-ink-soft)]">{t("profile.setupAccount")}</div>
        </Card>
      ) : (
        <>
          <Card className="flex flex-col gap-3">
            <div className="text-[0.8rem] font-bold uppercase tracking-[0.05em] text-[color:var(--color-ink-faint)]">
              {t("profile.accountSection")}
            </div>
            <div>
              <div className="text-[0.72rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                {t("profile.emailLabel")}
              </div>
              <div className="mt-1 text-[0.92rem]">{householdCtx.user.email}</div>
            </div>

            <div className="mt-1 border-t border-[color:var(--color-line)] pt-3">
              <div className="text-[0.8rem] font-bold">{t("profile.changePassword")}</div>
              <div className="mt-2 flex flex-col gap-2.5">
                <input
                  type="password"
                  className="min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3.5 text-[0.95rem]"
                  placeholder={t("profile.newPasswordLabel")}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <input
                  type="password"
                  className="min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3.5 text-[0.95rem]"
                  placeholder={t("profile.confirmPasswordLabel")}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                {passwordError && (
                  <div className="rounded-xl bg-[color:var(--color-berry-bg)] p-3 text-[0.82rem]">{passwordError}</div>
                )}
                <button
                  onClick={handleChangePassword}
                  disabled={passwordSaving || !newPassword || !confirmPassword}
                  className="min-h-11 rounded-xl bg-[color:var(--color-sage)] px-4 py-3 text-[0.88rem] font-bold text-white disabled:opacity-60"
                >
                  {passwordSaving
                    ? t("profile.passwordUpdating")
                    : passwordSaved
                      ? t("profile.passwordUpdated")
                      : t("profile.changePasswordButton")}
                </button>
              </div>
            </div>
          </Card>

          {bmi && bmiCat && (
            <Card>
              <div className="flex items-baseline justify-between">
                <div className="text-[0.8rem] font-bold uppercase tracking-[0.05em] text-[color:var(--color-ink-faint)]">
                  {t("onboarding.yourBmi")}
                </div>
                <div className="font-serif text-[1.6rem]">{bmi.toFixed(1)}</div>
              </div>
              <div className="mt-1 text-[0.85rem] capitalize text-[color:var(--color-ink-soft)]">
                {bmiCat === "healthy"
                  ? t("onboarding.categoryHealthy")
                  : t("onboarding.categoryOther", { category: t(`onboarding.categories.${bmiCat}`) })}
              </div>
            </Card>
          )}

          <Card className="flex flex-col gap-3">
            <div className="text-[0.8rem] font-bold uppercase tracking-[0.05em] text-[color:var(--color-ink-faint)]">
              {t("profile.goalSection")}
            </div>

            {!selfMember?.weight_kg ? (
              <div className="text-[0.85rem] text-[color:var(--color-ink-soft)]">{t("profile.needWeightFirst")}</div>
            ) : hasGoal ? (
              <>
                <div className="flex items-end justify-between text-[0.82rem] text-[color:var(--color-ink-soft)]">
                  <div>
                    <div className="text-[0.68rem] font-bold uppercase tracking-[0.05em] text-[color:var(--color-ink-faint)]">
                      {t("profile.goalStart")}
                    </div>
                    {Math.round(kgToLbs(goalStartKg))} {t("profile.lb")}
                  </div>
                  <div className="text-center">
                    <div className="text-[0.68rem] font-bold uppercase tracking-[0.05em] text-[color:var(--color-ink-faint)]">
                      {t("profile.goalCurrent")}
                    </div>
                    <span className="font-bold text-[color:var(--color-ink)]">
                      {Math.round(kgToLbs(goalCurrentKg))} {t("profile.lb")}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-[0.68rem] font-bold uppercase tracking-[0.05em] text-[color:var(--color-ink-faint)]">
                      {t("profile.goalTarget")}
                    </div>
                    {Math.round(kgToLbs(goalTargetKg))} {t("profile.lb")}
                  </div>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-2)]">
                  <div
                    className="h-full rounded-full bg-[color:var(--color-sage)] transition-all"
                    style={{ width: `${Math.round(goalFraction * 100)}%` }}
                  />
                </div>
                {goalStatus && <div className="text-[0.82rem] leading-relaxed text-[color:var(--color-ink-soft)]">{goalStatus}</div>}
                {goalError && (
                  <div className="rounded-xl bg-[color:var(--color-berry-bg)] p-3 text-[0.82rem]">{goalError}</div>
                )}
                <button
                  onClick={handleClearGoal}
                  disabled={goalSaving}
                  className="min-h-10 self-start rounded-xl bg-transparent text-[0.82rem] font-semibold text-[color:var(--color-ink-faint)] disabled:opacity-60"
                >
                  {t("profile.clearGoal")}
                </button>
              </>
            ) : (
              <>
                <div className="text-[0.82rem] text-[color:var(--color-ink-soft)]">{t("profile.goalIntro")}</div>
                <div>
                  <label className="text-[0.76rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                    {t("profile.targetWeightLabel")}
                  </label>
                  <input
                    type="number"
                    value={targetWeightLbs}
                    onChange={(e) => setTargetWeightLbs(e.target.value)}
                    className="mt-2 min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3.5 text-[0.95rem]"
                  />
                </div>
                {goalError && (
                  <div className="rounded-xl bg-[color:var(--color-berry-bg)] p-3 text-[0.82rem]">{goalError}</div>
                )}
                <button
                  onClick={handleSetGoal}
                  disabled={goalSaving || !targetWeightLbs}
                  className="min-h-11 rounded-xl bg-[color:var(--color-sage)] px-4 py-3 text-[0.88rem] font-bold text-white disabled:opacity-60"
                >
                  {goalSaving ? t("onboarding.saving") : t("profile.setGoalButton")}
                </button>
              </>
            )}
          </Card>

          <Card className="flex flex-col gap-3">
            <div className="text-[0.8rem] font-bold uppercase tracking-[0.05em] text-[color:var(--color-ink-faint)]">
              {t("profile.aboutYouSection")}
            </div>

            <div>
              <label className="text-[0.76rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                {t("onboarding.nameLabel")}
              </label>
              <input
                className="mt-2 min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3.5 text-[0.95rem]"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label className="text-[0.76rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                {t("onboarding.heightLabel")}
              </label>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div className="relative">
                  <input
                    type="number"
                    value={heightFeet}
                    onChange={(e) => setHeightFeet(e.target.value)}
                    className="min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3.5 text-[0.95rem]"
                  />
                  <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[0.78rem] text-[color:var(--color-ink-faint)]">
                    {t("onboarding.ft")}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    value={heightInches}
                    onChange={(e) => setHeightInches(e.target.value)}
                    className="min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3.5 text-[0.95rem]"
                  />
                  <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[0.78rem] text-[color:var(--color-ink-faint)]">
                    {t("onboarding.in")}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[0.76rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                  {t("onboarding.weightLabel")}
                </label>
                <input
                  type="number"
                  value={weightLbs}
                  onChange={(e) => setWeightLbs(e.target.value)}
                  className="mt-2 min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3.5 text-[0.95rem]"
                />
              </div>
              <div>
                <label className="text-[0.76rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                  {t("onboarding.ageLabel")}
                </label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="mt-2 min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3.5 text-[0.95rem]"
                />
              </div>
            </div>

            <div>
              <label className="text-[0.76rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                {t("onboarding.sexLabel")}
              </label>
              <div className="mt-2 flex gap-2.5">
                {(["female", "male"] as BiologicalSex[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSex(s)}
                    className={`min-h-11 flex-1 rounded-xl text-[0.88rem] font-bold capitalize ${
                      sex === s
                        ? "bg-[color:var(--color-sage)] text-white"
                        : "bg-[color:var(--color-surface-2)] text-[color:var(--color-ink-faint)]"
                    }`}
                  >
                    {t(s === "female" ? "onboarding.sexFemale" : "onboarding.sexMale")}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[0.76rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                {t("onboarding.activityLabel")}
              </label>
              <div className="mt-2 flex flex-col gap-2">
                {activityLevelKeys.map((key) => (
                  <button
                    key={key}
                    onClick={() => setActivityLevel(key)}
                    className={`min-h-11 rounded-xl border-[1.5px] px-3.5 py-2.5 text-left ${
                      activityLevel === key
                        ? "border-[color:var(--color-sage)] bg-[color:var(--color-sage-bg)]"
                        : "border-[color:var(--color-line)] bg-[color:var(--color-surface)]"
                    }`}
                  >
                    <div className="text-[0.86rem] font-bold">{t(`onboarding.activity.${key}.label`)}</div>
                    <div className="text-[0.72rem] text-[color:var(--color-ink-faint)]">
                      {t(`onboarding.activity.${key}.hint`)}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[0.76rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                {t("onboarding.goalsTitle")}
              </label>
              <div className="mt-2 flex flex-col gap-2">
                {goalKeys.map((key, i) => (
                  <button
                    key={key}
                    onClick={() => setGoalIndex(i)}
                    className={`min-h-11 rounded-xl border-[1.5px] px-3.5 py-2.5 text-left text-[0.86rem] font-bold ${
                      goalIndex === i
                        ? "border-[color:var(--color-sage)] bg-[color:var(--color-sage-bg)] text-[color:var(--color-sage)]"
                        : "border-[color:var(--color-line)] bg-[color:var(--color-surface)] text-[color:var(--color-ink-soft)]"
                    }`}
                  >
                    {t(`onboarding.goals.${key}`)}
                  </button>
                ))}
              </div>
            </div>

            {profileError && (
              <div className="rounded-xl bg-[color:var(--color-berry-bg)] p-3 text-[0.82rem]">{profileError}</div>
            )}

            <button
              onClick={handleSave}
              disabled={saving || !sex || !activityLevel}
              className="min-h-11 rounded-xl bg-[color:var(--color-sage)] px-4 py-3.5 text-[0.92rem] font-bold text-white disabled:opacity-60"
            >
              {saving ? t("onboarding.saving") : profileSaved ? t("profile.changesSaved") : t("profile.saveChanges")}
            </button>
          </Card>

          <button
            onClick={handleSignOut}
            className="min-h-11 rounded-xl bg-transparent px-4 py-3 text-[0.88rem] font-semibold text-[color:var(--color-ink-faint)]"
          >
            {t("nav.signOut")}
          </button>

          <Card className="flex flex-col gap-2.5 border-[color:var(--color-berry)]">
            <div className="text-[0.8rem] font-bold uppercase tracking-[0.05em] text-[color:var(--color-berry)]">
              {t("profile.dangerZone")}
            </div>
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="min-h-11 self-start text-[0.85rem] font-bold text-[color:var(--color-berry)]"
              >
                {t("profile.deleteAccount")}
              </button>
            ) : (
              <>
                <div className="text-[0.84rem] leading-relaxed text-[color:var(--color-ink-soft)]">
                  {t("profile.deleteAccountWarning")}
                </div>
                {deleteError && (
                  <div className="rounded-xl bg-[color:var(--color-berry-bg)] p-3 text-[0.82rem]">{deleteError}</div>
                )}
                <div className="flex gap-2.5">
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(false)
                      setDeleteError(null)
                    }}
                    disabled={isDeleting}
                    className="min-h-11 flex-1 rounded-xl bg-[color:var(--color-surface-2)] text-[0.85rem] font-bold text-[color:var(--color-ink-soft)] disabled:opacity-60"
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    onClick={() => void handleDeleteAccount()}
                    disabled={isDeleting}
                    className="min-h-11 flex-1 rounded-xl bg-[color:var(--color-berry)] text-[0.85rem] font-bold text-white disabled:opacity-60"
                  >
                    {isDeleting ? t("profile.deleting") : t("profile.confirmDeleteAccount")}
                  </button>
                </div>
              </>
            )}
          </Card>
        </>
      )}
    </Screen>
  )
}
