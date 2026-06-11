/**
 * Collision detection. v0 treats every entity as a circle of radius `size`
 * (squares are close enough at this fidelity) and reports overlapping pairs
 * whose types match a collision rule. O(n^2) is fine for the small entity
 * counts a prototype produces; swap in a grid later if needed.
 */

import type { Entity } from "./entity";

export interface Contact {
  a: Entity;
  b: Entity;
}

function overlaps(a: Entity, b: Entity): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const r = a.size + b.size;
  return dx * dx + dy * dy <= r * r;
}

/**
 * Find all overlapping pairs among living entities. The caller matches pairs
 * against rules; we don't filter by type here so a single pass serves every
 * collision rule.
 */
export function findContacts(entities: Entity[]): Contact[] {
  const contacts: Contact[] = [];
  const live = entities.filter((e) => e.alive);
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i]!;
      const b = live[j]!;
      if (overlaps(a, b)) contacts.push({ a, b });
    }
  }
  return contacts;
}
