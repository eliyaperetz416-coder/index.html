// Score, combo and multiplier for one run.
import { SCORE } from './config.js';

export class Scoring {
  constructor(comboStat = 1) { this.comboStat = comboStat; this.reset(); }
  reset() {
    this.score = 0; this.combo = 0; this.comboTimer = 0; this.closeCalls = 0; this.tightCalls = 0; this.bestCombo = 0; this.lightHits = 0;
  }
  get mult() { return 1 + Math.min(this.combo, SCORE.comboMaxSteps) * SCORE.comboStep * this.comboStat; }

  update(dt, kmh) {
    this.score += kmh * dt * SCORE.distancePerKmhSec * this.mult;
    if (this.combo > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) { this.combo = 0; return 'expired'; }
    }
    return null;
  }

  /** returns points awarded */
  closeCall(tight) {
    this.combo++; this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.comboTimer = SCORE.comboWindow;
    this.closeCalls++; if (tight) this.tightCalls++;
    const pts = Math.round((tight ? SCORE.tightCall : SCORE.closeCall) * this.mult);
    this.score += pts; return pts;
  }

  /** breaks the combo; returns true if there was one */
  breakCombo() { const had = this.combo > 0; this.combo = 0; this.comboTimer = 0; return had; }
}
