// Checks a notebook target against the rules in data/notebook-rules.json.
// A target lists what the writer knows about the person, e.g. { name: true, face: false }.
import notebook from '../../data/notebook-rules.json';

export const rules = notebook.rules;

/**
 * Returns { canWrite, works, rule } where `rule` is the first rule that was not satisfied.
 * canWrite = false: a "before" rule failed (e.g. no name to write).
 * works = false: the name was written but the death does not happen (e.g. no face).
 */
export function judge(facts) {
  for (const rule of rules) {
    if (!rule.requires || facts[rule.requires]) continue;
    return { canWrite: rule.check !== 'before', works: false, rule };
  }
  return { canWrite: true, works: true, rule: null };
}
