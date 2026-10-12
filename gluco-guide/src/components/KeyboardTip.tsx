import { useState } from "react"
import { useTranslation } from "react-i18next"

const SEEN_KEY_PREFIX = "glucoguide_keyboard_tip_seen_"

function hasSeen(language: string) {
  try {
    return localStorage.getItem(SEEN_KEY_PREFIX + language) === "1"
  } catch {
    return false
  }
}

function markSeen(language: string) {
  try {
    localStorage.setItem(SEEN_KEY_PREFIX + language, "1")
  } catch {
    // storage unavailable: the tip just shows again next time
  }
}

/**
 * For boxes whose text gets saved: the app can't switch the phone's keyboard,
 * so the first time someone using a non-English language taps one, explain
 * how to add that keyboard. Shown once per language, until dismissed.
 */
export function useKeyboardTip() {
  const { t, i18n } = useTranslation()
  const language = i18n.language
  const [visible, setVisible] = useState(false)

  const inputProps = {
    lang: language,
    onFocus: () => {
      if (language !== "en" && !hasSeen(language)) setVisible(true)
    },
  }

  const tip = visible ? (
    <div role="note" className="flex flex-col gap-1.5 rounded-xl bg-[color:var(--color-sage-bg)] p-3 text-[0.78rem] leading-relaxed text-[color:var(--color-ink)]">
      <div className="font-bold">{t("keyboardTip.title")}</div>
      <div>{t("keyboardTip.body")}</div>
      <div className="text-[color:var(--color-ink-soft)]">{t("keyboardTip.iphone")}</div>
      <div className="text-[color:var(--color-ink-soft)]">{t("keyboardTip.android")}</div>
      <button
        type="button"
        onClick={() => {
          markSeen(language)
          setVisible(false)
        }}
        className="self-start font-bold text-[color:var(--color-sage)]"
      >
        {t("keyboardTip.dismiss")}
      </button>
    </div>
  ) : null

  return { inputProps, tip }
}
