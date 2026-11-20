import { Color, Vector3 } from 'three';

/** The valley flight's light (ValleyScene and its buildings): the low sun
 *  from the west over the lake, its colour and the sky's, in the shaders
 *  (no scene light). */

/** Deterministic pseudo-random in [0, 1). */
export function rand(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// The low sun, from the west over the lake; its light and the sky's.
export const SUN = new Vector3(-0.86, 0.2, 0.34).normalize();
export const LIGHT = {
  uSun: { value: SUN },
  uSunColor: { value: new Color('#ffd49a') },
  uAmbient: { value: new Color('#8e98b2') },
  uHorizon: { value: new Color('#f4c08e') },
  uZenith: { value: new Color('#3f64a0') },
  uGlow: { value: new Color('#ffe0aa') },
};
// Shared by the shaders: the sky's colour toward a direction, for the sky
// itself, the lake's reflection and the haze.
export const SKY = /* glsl */ `
uniform vec3 uSun, uSunColor, uAmbient, uHorizon, uZenith, uGlow;
vec3 skyAt(vec3 d) {
  float up = clamp(d.y, -0.2, 1.0);
  vec3 c = mix(uHorizon, uZenith, smoothstep(0.0, 0.55, up));
  float s = max(dot(normalize(d), uSun), 0.0);
  c += uGlow * (pow(s, 6.0) * 0.55 + pow(s, 60.0) * 0.6);
  return c;
}`;
