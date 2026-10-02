// Cheap client-side guard: if the user's note suggests extreme dieting or distress, skip the critique and respond kindly.
const RX = /(starv|anorex|bulimi|purg|not eating|stop eating|hate my (body|self)|kill myself|suicid|self[- ]?harm|want to die|רעב|אנורקס|בולימיה|להקיא|שונא את הגוף|להתאבד|פגיעה עצמית|לא אוכל)/i
export const isSensitive = (note: string) => RX.test(note)
