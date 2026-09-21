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
      setError(event.error === "not-allowed" ? "Microphone access was denied." : "Couldn't hear that — try again.")
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
