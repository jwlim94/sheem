/**
 * The soundbar's measures (his bookcase's, build_room.py), unscaled, and
 * where to put a Soundbar's centre (Soundbar.tsx) to hang it on a wall or
 * stand it on a surface.
 */
export const BAR = { w: 0.56, h: 0.13, d: 0.13 };
/** The feet under it, and the wall bracket behind it. */
export const BAR_FOOT = 0.008,
  BAR_BRACKET = 0.012;

/** How far a wall-hung bar's centre stands off the wall (bracket behind). */
export const barOffWall = (scale: number) => (BAR.d / 2 + BAR_BRACKET) * scale;
/** The height of a bar's centre, standing on its feet on a surface at y0. */
export const barOnSurface = (y0: number, scale: number) =>
  y0 + (BAR_FOOT + BAR.h / 2) * scale;
