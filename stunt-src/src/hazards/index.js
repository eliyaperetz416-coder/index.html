// Loads every item type so it registers itself. Import this once (race.js does).
import './boost.js';
import './coins.js';
import './barrier.js';
import './sawblade.js';
import './wreckingBall.js';
import './pillar.js';
import './laser.js';
import './oil.js';

export { createItems, itemType, itemTypes } from './registry.js';
