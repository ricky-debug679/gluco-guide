import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useVoiceInput } from "../hooks/useVoiceInput"
import { speak } from "../lib/speech"

const commands: { path: string; label: string; keywords: string[] }[] = [
  { path: "/", label: "Home", keywords: ["home", "dashboard"] },
  { path: "/log", label: "Log a Meal", keywords: ["log a meal", "log food", "log meal", "food log"] },
  { path: "/scan", label: "Scan Grocery", keywords: ["scan", "grocery"] },
  { path: "/trends", label: "Trends", keywords: ["trend", "lab"] },
  { path: "/hydration", label: "Water & Fiber", keywords: ["water", "hydration", "fiber"] },
  { path: "/exercise", label: "Exercise", keywords: ["exercise", "workout", "activity"] },
  { path: "/wellness", label: "Mind & Sleep", keywords: ["sleep", "mind", "stress"] },
  { path: "/supplements", label: "Supplements", keywords: ["supplement"] },
  { path: "/family", label: "Family", keywords: ["family"] },
  { path: "/you", label: "Profile", keywords: ["profile", "setting", "you"] },
]

function matchCommand(transcript: string) {
  const t = transcript.toLowerCase()
  return commands.find((c) => c.keywords.some((k) => t.includes(k)))
}

export function VoiceCommandButton() {
  const navigate = useNavigate()
  const { supported, listening, transcript, error, start, stop } = useVoiceInput()
  const [feedback, setFeedback] = useState<string | null>(null)
  const wasListening = useRef(false)
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (wasListening.current && !listening && transcript.trim()) {
      const match = matchCommand(transcript)
      if (match) {
        navigate(match.path)
        setFeedback(`Opening ${match.label}`)
        speak(`Opening ${match.label}`)
      } else {
        setFeedback(`Didn't recognize "${transcript.trim()}"`)
        speak("Sorry, I didn't recognize that command.")
      }
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
      feedbackTimer.current = setTimeout(() => setFeedback(null), 3000)
    }
    wasListening.current = listening
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening])

  if (!supported) return null

  return (
    <div className="pointer-events-none absolute bottom-[90px] right-4 z-10 flex flex-col items-end gap-2">
      {(feedback || error) && (
        <div className="pointer-events-auto max-w-[200px] rounded-xl bg-[color:var(--color-ink)] px-3 py-2 text-right text-[0.72rem] font-bold text-[color:var(--color-bg)] shadow-lg">
          {error ?? feedback}
        </div>
      )}
      <button
        type="button"
        onClick={() => (listening ? stop() : start())}
        aria-label={listening ? "Stop voice command" : "Say a command, e.g. 'log a meal'"}
        className={`pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full shadow-lg ${
          listening ? "animate-pulse bg-[color:var(--color-berry)]" : "bg-[color:var(--color-sage)]"
        }`}
      >
        <svg width={18} height={18} viewBox="0 0 24 24" stroke="white" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
      </button>
    </div>
  )
}
