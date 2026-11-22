import { EqualStencilFunc, KeepStencilOp } from 'three';

/** Drawn only where his room's window is (the portal Outside.tsx marks in
 *  the stencil): the view out of it, and the ending's snow past it. */
export const masked = {
  stencilWrite: true,
  stencilRef: 1,
  stencilFunc: EqualStencilFunc,
  stencilFail: KeepStencilOp,
  stencilZFail: KeepStencilOp,
  stencilZPass: KeepStencilOp,
  toneMapped: false,
  fog: false,
  depthWrite: false,
  transparent: true,
} as const;
