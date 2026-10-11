import { useTranslation } from "react-i18next"
import { supportedLanguages } from "../lib/i18n"

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { t, i18n } = useTranslation()
  return (
    <select
      value={i18n.language}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
      aria-label={t("language.label")}
      className={`min-h-9 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-2 text-[0.74rem] font-bold text-[color:var(--color-ink-soft)] ${className}`}
    >
      {supportedLanguages.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  )
}
