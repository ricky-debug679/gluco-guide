export function speechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window
}

export function speak(text: string) {
  if (!speechSynthesisSupported()) return
  window.speechSynthesis.cancel() // don't stack utterances if tapped repeatedly
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = 0.98
  window.speechSynthesis.speak(utterance)
}
