import { useTranslation } from "react-i18next"
import { chooseLanguage, supportedLanguages } from "../lib/i18n"

// One accent per language so each card has its own color, drawn from the app palette.
const ACCENTS = [
  { fg: "--color-sage", bg: "--color-sage-bg" },
  { fg: "--color-honey", bg: "--color-honey-bg" },
  { fg: "--color-berry", bg: "--color-berry-bg" },
  { fg: "--color-water", bg: "--color-water-bg" },
] as const

/** First screen on a new device, before sign-in: every label is in its own language. */
export function LanguagePicker({ onChosen }: { onChosen: () => void }) {
  const { i18n } = useTranslation()
  const guessed = supportedLanguages.find((l) => l.code === i18n.resolvedLanguage) ?? supportedLanguages[0]
  const others = supportedLanguages.filter((l) => l.code !== guessed.code)

  return (
    <div className="relative flex min-h-screen w-full justify-center overflow-hidden bg-[color:var(--color-bg)]">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[color:var(--color-sage-bg)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-[color:var(--color-honey-bg)] opacity-70"
      />
      <div className="relative flex w-full max-w-md flex-col justify-center gap-7 px-6 py-10">
        <div className="flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="h-12 w-12" />
          <div className="font-serif text-[1.5rem] font-semibold">
            Gluco<span className="text-[color:var(--color-sage)]">Guide</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div lang={guessed.code} className="text-[0.8rem] font-bold uppercase tracking-[0.08em] text-[color:var(--color-sage)]">
            {guessed.welcome}
          </div>
          <h1 lang={guessed.code} className="font-serif text-[2rem] font-semibold leading-tight">
            {guessed.choose}
          </h1>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[0.9rem] text-[color:var(--color-ink-faint)]">
            {others.map((l) => (
              <span key={l.code} lang={l.code}>
                {l.choose}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {supportedLanguages.map((l, i) => {
            const accent = ACCENTS[i % ACCENTS.length]
            const isGuess = l.code === guessed.code
            return (
              <button
                key={l.code}
                lang={l.code}
                onClick={() => {
                  chooseLanguage(l.code)
                  onChosen()
                }}
                className={`flex min-h-16 items-center gap-4 rounded-2xl border-[1.5px] bg-[color:var(--color-surface)] px-4 py-3 text-left shadow-sm transition-transform active:scale-[0.99] ${
                  isGuess ? "border-[color:var(--color-sage)]" : "border-[color:var(--color-line)]"
                }`}
              >
                <span
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-[0.78rem] font-bold"
                  style={{ background: `var(${accent.bg})`, color: `var(${accent.fg})` }}
                >
                  {l.hello}
                </span>
                <span className="flex-1">
                  <span className="block text-[1.15rem] font-bold">{l.label}</span>
                  <span className="block text-[0.78rem] text-[color:var(--color-ink-faint)]">{l.englishName}</span>
                </span>
                {isGuess && (
                  <span className="rounded-full bg-[color:var(--color-sage-bg)] px-2.5 py-1 text-[0.7rem] font-bold text-[color:var(--color-sage)]">
                    {l.suggested}
                  </span>
                )}
                <svg width={18} height={18} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[color:var(--color-ink-faint)]">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
