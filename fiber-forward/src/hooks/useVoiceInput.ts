import { useCallback, useEffect, useRef, useState } from "react"

// Chrome/Edge/Safari expose this as webkitSpeechRecognition; Firefox has no
// implementation at all, so everything here must degrade gracefully rather
// than assume the API exists.
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

interface SpeechRecognitionLike extends EventTarget {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>
}

// The browser's error codes collapse a lot of very different failures
// (permissions, no mic, dropped connection to the recognition service,
// genuine silence) into one string — surfacing which one it actually was
// matters, since "couldn't hear you" and "this browser can't reach the
// speech service at all" call for completely different fixes.
function describeSpeechError(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access was denied — check this browser's site permissions."
    case "no-speech":
      return "Didn't hear anything — try again and speak right after tapping."
    case "audio-capture":
      return "No microphone found on this device."
    case "network":
      return "Voice recognition couldn't reach the speech service (needs an internet connection, and some embedded browsers don't support it)."
    default:
      return `Couldn't hear that (${code}) — try again.`
  }
}

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function useVoiceInput() {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const supported = getRecognitionCtor() !== null

  useEffect(() => {
    return () => recognitionRef.current?.stop()
  }, [])

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor()
    if (!Ctor) {
      setError("Voice input isn't supported in this browser.")
      return
    }
    setError(null)
    setTranscript("")
    const recognition = new Ctor()
    recognition.lang = "en-US"
    recognition.interimResults = true
    recognition.continuous = false
    recognition.onresult = (event) => {
      let text = ""
      for (let i = 0; i < event.results.length; i++) text += event.results[i][0].transcript
      setTranscript(text)
    }
    recognition.onerror = (event) => {
      setError(describeSpeechError(event.error))
      setListening(false)
    }
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    setListening(true)
    recognition.start()
  }, [])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  return { supported, listening, transcript, error, start, stop }
}
