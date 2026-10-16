// Loads every item type so it registers itself. Import this once (race.js does).
import './boost.js';
import './coins.js';
import './barrier.js';

export { createItems, itemType, itemTypes } from './registry.js';
