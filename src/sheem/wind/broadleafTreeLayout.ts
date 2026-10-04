/** Shared placement for the 5 m Sheem broadleaf. The source trunk is slightly
 * off the canopy centre; account for that when building its solid footprint. */
export const BROADLEAF_TREE_LAYOUT = [
  { x: -3, z: -5, styled: true, width: 1.18 },
] as const;

export const BROADLEAF_TRUNKS = BROADLEAF_TREE_LAYOUT.map((tree) => ({
  x: tree.x + 0.044 * tree.width,
  z: tree.z + 0.018 * tree.width,
  radius: 0.145 * tree.width,
}));
