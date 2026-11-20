import {
  BoxGeometry,
  BufferAttribute,
  Color,
  DataTexture,
  InstancedMesh,
  Matrix4,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CAR } from './lehi';
import type { lehiCars } from './lehi';
import { ceilUniforms, SHADE_AT } from './valleyBuildings';
import type { Area } from './valleyBuildings';
import { LIGHT, SKY } from './valleyLight';

/**
 * Lehi's parked cars (2026-11-20, the user's call: painted on the lots
 * they were flat): one instanced mesh, each car a body and a cabin
 * narrowing to its roof, painted its colour, its windows dark glass with
 * the sky in them, its sills dark (its wheels, its shadow under it); lit
 * by the low sun as the buildings are, in their shadows where they fall.
 * Their own long shadows are painted on the lots (valleyGround.ts) and
 * drawn on the garages' decks (valleyBuildings.ts deckCar).
 */

/** A car, its length along z, its front toward +z, standing on y = 0. */
function carGeometry() {
  const body = new BoxGeometry(CAR.w, CAR.h * 0.52, CAR.l).translate(
    0,
    CAR.h * 0.08 + CAR.h * 0.26,
    0
  );
  const cabin = new BoxGeometry(CAR.w * 0.88, CAR.h * 0.4, CAR.l * 0.52);
  // Narrowing to its roof: windscreen and rear window raked.
  const cp = cabin.attributes.position as BufferAttribute;
  for (let i = 0; i < cp.count; i++)
    if (cp.getY(i) > 0) {
      cp.setX(i, cp.getX(i) * 0.86);
      cp.setZ(i, cp.getZ(i) * 0.66);
    }
  cabin.translate(0, CAR.h * 0.6 + CAR.h * 0.2, -CAR.l * 0.06);
  cabin.computeVertexNormals();
  // Painted, or glass (the cabin's sides); low, the sills.
  const tag = (g: BoxGeometry, glassSides: boolean) => {
    const n = g.attributes.normal as BufferAttribute,
      p = g.attributes.position as BufferAttribute,
      paint = new Float32Array(n.count),
      low = new Float32Array(n.count);
    for (let i = 0; i < n.count; i++) {
      paint[i] = glassSides && n.getY(i) < 0.8 ? 0 : 1;
      low[i] = p.getY(i) < CAR.h * 0.2 ? 1 : 0;
    }
    g.setAttribute('aPaint', new BufferAttribute(paint, 1));
    g.setAttribute('aLow', new BufferAttribute(low, 1));
  };
  tag(body, false);
  tag(cabin, true);
  const g = mergeGeometries([body, cabin])!;
  body.dispose();
  cabin.dispose();
  return g;
}

const vertex = /* glsl */ `
attribute float aPaint, aLow;
varying vec3 vWorld, vP, vNormal, vColour;
varying float vPaint, vLow;
void main() {
  vColour = instanceColor;
  vPaint = aPaint;
  vLow = aLow;
  vec4 p = instanceMatrix * vec4(position, 1.0);
  vP = p.xyz;
  vNormal = normalize(mat3(modelMatrix) * (mat3(instanceMatrix) * normal));
  vec4 w = modelMatrix * p;
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const fragment = /* glsl */ `
uniform float uHaze;
${SKY}
${SHADE_AT}
varying vec3 vWorld, vP, vNormal, vColour;
varying float vPaint, vLow;
void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(cameraPosition - vWorld);
  float ndl = max(dot(n, uSun), 0.0);
  float shade = smoothstep(0.01, 0.03, ceilAt(vP.xz + n.xz * 0.05) - vP.y) * smoothstep(0.0, 0.08, ndl);
  vec3 r = reflect(-v, n);
  float fres = pow(1.0 - abs(dot(v, n)), 3.0);
  vec3 sky = r.y >= 0.0 ? skyAt(r) : skyAt(vec3(r.x, 0.0, r.z)) * 0.4;
  vec3 c;
  if (vPaint < 0.5) {
    // Its windows: dark glass, the sky in them.
    c = vec3(0.025, 0.03, 0.04) + sky * (0.12 + 0.6 * fres);
  } else {
    vec3 base = vColour * (1.0 - 0.75 * vLow);
    c = base * (uAmbient * 0.8 + uSunColor * (0.35 + 1.1 * ndl) * (1.0 - 0.7 * shade));
    // Its paint's sheen.
    c += sky * (0.03 + 0.3 * fres) * (1.0 - vLow) * (1.0 - 0.6 * shade);
  }
  float d = length(cameraPosition - vWorld);
  c = mix(c, skyAt(normalize(vec3(-v.x, 0.04, -v.z))), (1.0 - exp(-d * uHaze)) * 0.75);
  // (three's ACES curve lifts its input 1/0.6: these colours are the
  // valley's own, so they are taken back down first.)
  gl_FragColor = vec4(c * 0.62, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// Their colours, as cars in a lot run: white, silver, black, grey, red,
// blue, more white and silver, a dark grey.
const COLOURS = [
  '#e8e8e5',
  '#c2c4c7',
  '#2e3035',
  '#85898f',
  '#8f3029',
  '#34507e',
  '#e8e8e5',
  '#c2c4c7',
  '#59595c',
].map((c) => new Color(c));

/** The cars, one instanced mesh, in the place's shadows (`ceil` over
 *  `area`). */
export function parkedCarsMesh(
  cars: ReturnType<typeof lehiCars>,
  { ceil, area, haze }: { ceil: DataTexture; area: Area; haze: number }
) {
  const mesh = new InstancedMesh(
    carGeometry(),
    new ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: {
        ...LIGHT,
        ...ceilUniforms(ceil, area),
        uHaze: { value: haze },
      },
    }),
    cars.length
  );
  const up = new Vector3(0, 1, 0),
    q = new Quaternion(),
    m = new Matrix4(),
    one = new Vector3(1, 1, 1),
    at = new Vector3();
  cars.forEach((car, i) => {
    mesh.setMatrixAt(
      i,
      m.compose(
        at.set(car.x, car.y, car.z),
        q.setFromAxisAngle(up, car.rot),
        one
      )
    );
    mesh.setColorAt(
      i,
      COLOURS[
        Math.min(COLOURS.length - 1, Math.floor(car.colour * COLOURS.length))
      ]
    );
  });
  mesh.frustumCulled = false;
  return mesh;
}
