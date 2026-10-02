// Browser-only voice (free): Web Speech API for STT, speechSynthesis for TTS. iOS home-screen PWAs may lack recognition -> UI hides mic.
const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
export const canListen = !!SR
export const canSpeak = 'speechSynthesis' in window
const locale = (lang: string) => (lang === 'he' ? 'he-IL' : 'en-US')

export function listen(lang: string, onText: (t: string) => void, onEnd: () => void) {
  const r = new SR()
  r.lang = locale(lang); r.interimResults = false; r.maxAlternatives = 1
  r.onresult = (e: any) => onText(e.results[0][0].transcript)
  r.onend = onEnd; r.onerror = onEnd
  r.start()
  return () => r.stop()
}
export function speak(text: string, lang: string) {
  if (!canSpeak) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text.replace(/[*_#`•\-]{1,3}\s?/g, ''))
  u.lang = locale(lang)
  speechSynthesis.speak(u)
}
export const stopSpeaking = () => canSpeak && speechSynthesis.cancel()
