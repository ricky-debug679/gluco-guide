import { useTranslation } from "react-i18next"
import { chooseLanguage, supportedLanguages } from "../lib/i18n"

/** First screen on a new device, before sign-in: every label is in its own language. */
export function LanguagePicker({ onChosen }: { onChosen: () => void }) {
  const { i18n } = useTranslation()
  const guessed = i18n.resolvedLanguage

  return (
    <div className="flex h-screen w-full justify-center bg-[color:var(--color-bg)]">
      <div className="flex w-full max-w-md flex-col justify-center gap-6 px-6">
        <div className="flex flex-col gap-1">
          <div className="text-[0.78rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
            GlucoGuide
          </div>
          {supportedLanguages.map((l) => (
            <div key={l.code} lang={l.code} className="text-[1.15rem] font-semibold leading-snug">
              {l.choose}
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {supportedLanguages.map((l) => (
            <button
              key={l.code}
              lang={l.code}
              onClick={() => {
                chooseLanguage(l.code)
                onChosen()
              }}
              className={`min-h-14 rounded-2xl border-[1.5px] px-5 py-4 text-left text-[1.2rem] font-bold ${
                guessed === l.code
                  ? "border-[color:var(--color-sage)] bg-[color:var(--color-sage-bg)] text-[color:var(--color-sage)]"
                  : "border-[color:var(--color-line)] bg-[color:var(--color-surface)]"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
