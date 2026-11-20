import type { Object3D } from 'three';

/** Whether an object is drawn: it and every group above it visible. (Each
 *  place is a group RoomScene shows only there; a part's own parent stays
 *  visible, so checking it alone let hidden places' frame work run.) */
export function shown(o: Object3D | null | undefined): boolean {
  if (!o) return false;
  for (let p: Object3D | null = o; p; p = p.parent)
    if (!p.visible) return false;
  return true;
}
