// Service duct: a recessed channel along the north wall of the Vault, with a
// grate hatch at each end. Inside the duct the thief is unseen — the walls
// hide them from every watcher — but they crawl at half walk speed and
// cannot pick up loot while inside. The floor route stays faster but
// riskier: that is the patience trade-off. The duct is enclosed by real
// walls (its north wall, its south wall, and caps at both ends), so the only
// way in or out is through a grate — the collision code enforces it, no
// special-case movement is needed. A thief who walks north into the south
// wall anywhere else just stops at the wall face.
import { pointInRect } from './vision.js';

export function createDuct(def, index) {
  return {
    index,
    rect: { x: def.x, y: def.y, w: def.w, h: def.h }, // the duct, in px
    entry: { x: def.entry.x, y: def.entry.y }, // west grate centre, px
    exit: { x: def.exit.x, y: def.exit.y }, // east grate centre, px
    crawl: def.crawl ?? 0.5, // speed inside the duct, as a fraction of walk
  };
}

// Is this point inside the duct? The world asks this once per step, before
// the thief moves, so the crawl speed applies from the first step inside.
export function inDuct(duct, x, y) {
  return pointInRect(x, y, duct.rect);
}

export function ductAt(ducts, x, y) {
  for (const v of ducts) if (inDuct(v, x, y)) return v;
  return null;
}
