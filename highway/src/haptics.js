// Haptic feedback where available (Android/desktop Chrome; iOS Safari ignores navigator.vibrate).
import { save } from './storage.js';
export function haptic(pattern) {
  try { if (save.data.settings.haptics && navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* ignore */ }
}
