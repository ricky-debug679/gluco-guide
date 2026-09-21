import { useEffect, useRef } from "react"
import { useVoiceInput } from "../hooks/useVoiceInput"

interface MicButtonProps {
  onResult: (transcript: string) => void
  className?: string
}

export function MicButton({ onResult, className = "" }: MicButtonProps) {
  const { supported, listening, transcript, error, start, stop } = useVoiceInput()
  const wasListening = useRef(false)

  useEffect(() => {
    if (wasListening.current && !listening && transcript.trim()) {
      onResult(transcript.trim())
    }
    wasListening.current = listening
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening])

  if (!supported) return null

  return (
    <button
      type="button"
      onClick={() => (listening ? stop() : start())}
      aria-label={listening ? "Stop voice input" : "Start voice input"}
      title={error ?? undefined}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
        listening
          ? "animate-pulse border-[color:var(--color-berry)] bg-[color:var(--color-berry-bg)] text-[color:var(--color-berry)]"
          : "border-[color:var(--color-line)] bg-[color:var(--color-surface)] text-[color:var(--color-ink-soft)]"
      } ${className}`}
    >
      <svg width={18} height={18} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      </svg>
    </button>
  )
}
