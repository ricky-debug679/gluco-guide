import { useTranslation } from "react-i18next"
import { chooseLanguage, supportedLanguages } from "../lib/i18n"

/** All four languages as visible buttons, each written in its own language. */
export function LanguageButtons() {
  const { t, i18n } = useTranslation()
  return (
    <div role="group" aria-label={t("language.label")} className="grid grid-cols-4 gap-1.5">
      {supportedLanguages.map((l) => {
        const active = i18n.resolvedLanguage === l.code
        return (
          <button
            key={l.code}
            lang={l.code}
            type="button"
            aria-pressed={active}
            onClick={() => chooseLanguage(l.code)}
            className={`min-h-11 rounded-xl border px-1 text-[0.8rem] font-bold ${
              active
                ? "border-[color:var(--color-sage)] bg-[color:var(--color-sage-bg)] text-[color:var(--color-sage)]"
                : "border-[color:var(--color-line)] bg-[color:var(--color-surface)] text-[color:var(--color-ink-soft)]"
            }`}
          >
            {l.label}
          </button>
        )
      })}
    </div>
  )
}
