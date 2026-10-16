// Builds the views of a race's track items, one batched view per item type.

import { itemType } from '../hazards/index.js';

export class ItemsView {
  constructor(scene, race, quality) {
    this.scene = scene;
    this.views = [];
    const byType = new Map();
    for (const it of race.items) {
      if (!byType.has(it.type)) byType.set(it.type, []);
      byType.get(it.type).push(it);
    }
    const ctx = { path: race.path, quality, world: race.world };
    for (const [type, items] of byType) {
      const impl = itemType(type);
      if (!impl.view) continue;
      const v = impl.view(items, ctx);
      for (const o of v.objects) scene.add(o);
      this.views.push(v);
    }
  }

  update(dt, t, camera) {
    for (const v of this.views) v.update?.(dt, t, camera);
  }

  dispose() {
    for (const v of this.views) {
      for (const o of v.objects) this.scene.remove(o);
      v.dispose?.();
    }
    this.views = [];
  }
}
