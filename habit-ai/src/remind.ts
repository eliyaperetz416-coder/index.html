import { dateKey, type State } from './store'

// Local reminders only: PWAs can't schedule notifications while closed without a push server (iOS 16.4+, installed app only).
// So we notify when the app is open/foregrounded after the chosen time, once per day, if nothing is checked off yet.
const FIRED = 'habitai:reminded'
export const canNotify = 'Notification' in window
export async function askPermission() { return canNotify ? Notification.requestPermission() : 'denied' }

export async function maybeRemind(s: State, title: string, body: string) {
  if (!canNotify || !s.remind.on || Notification.permission !== 'granted') return
  const now = new Date(), [h, m] = s.remind.time.split(':').map(Number)
  if (now.getHours() * 60 + now.getMinutes() < h * 60 + m) return
  try {
    if (localStorage.getItem(FIRED) === dateKey()) return
    if ((s.logs[dateKey()] || []).length) return
    localStorage.setItem(FIRED, dateKey())
  } catch { return }
  const reg = await navigator.serviceWorker?.getRegistration()
  reg ? reg.showNotification(title, { body, icon: '/icon-192.png' }) : new Notification(title, { body })
}
