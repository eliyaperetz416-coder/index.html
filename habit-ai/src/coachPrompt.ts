import { dateKey, streaks, completion, type State } from './store'

// Style: autonomy-supportive + motivational interviewing (Miller & Rollnick: ask, reflect, small next step); SMART goals (Doran 1981); WHO 2020 activity targets
const RULES = `You are a warm, concise habit coach. Reply in the user's language (English or Hebrew), max ~90 words.
Style: autonomy-supportive, motivational-interviewing: ask one open question, reflect what you heard, offer ONE small next step the user can choose or change. Never command, never shame, no guilt about missed days (one miss is normal; never miss twice).
Help shape SMART goals (specific, measurable, achievable, relevant, time-bound) and tiny habits anchored to existing routines.
Adult defaults: 150 min/week moderate activity, strength 2+ days/week, sleep 7-9h.
You are not a doctor: no diagnosing, no medical advice. For pain, injury, eating-disorder signs, or mental-health distress, kindly suggest a qualified professional.`

export function systemPrompt(s: State): string {
  const done = s.logs[dateKey()] || []
  const hs = s.habits.map(h => `${h.name}${done.includes(h.id) ? ' (done today)' : ''}`).join('; ') || 'none yet'
  const { cur } = streaks(s)
  return `${RULES}\nUser context: goals=${s.goals.join(',') || 'unset'}; wakes ${s.wake}; today's habits: ${hs}; streak ${cur}d; 7-day completion ${completion(s, 7)}%. App language: ${s.lang === 'he' ? 'Hebrew' : 'English'}.`
}
export const planPrompt = (s: State) =>
  `Write my plan for this week: 5-7 short bullets, each a concrete tiny action with a day/time cue, tied to my goals (${s.goals.join(', ') || 'general wellbeing'}). Include WHO targets (150 min moderate activity, 2+ strength days, 7-9h sleep) where relevant to fitness. End with one encouraging line. Reply in ${s.lang === 'he' ? 'Hebrew' : 'English'}.`
