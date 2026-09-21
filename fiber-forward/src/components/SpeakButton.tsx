import { speak, speechSynthesisSupported } from "../lib/speech"

interface SpeakButtonProps {
  text: string
  className?: string
}

export function SpeakButton({ text, className = "" }: SpeakButtonProps) {
  if (!speechSynthesisSupported()) return null

  return (
    <button
      type="button"
      onClick={() => speak(text)}
      aria-label="Read aloud"
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[color:var(--color-ink-faint)] ${className}`}
    >
      <svg width={16} height={16} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 9v6h4l5 4V5L8 9H4z" />
        <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
      </svg>
    </button>
  )
}
