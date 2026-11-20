import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { waves } from './oceanSurface';
import {
  Color,
  MathUtils,
  Matrix4,
  Mesh,
  NoToneMapping,
  OrthographicCamera,
  Plane,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
  WebGLRenderTarget,
} from 'three';

const vertexShader = /* glsl */ `
  uniform float time;
  uniform mat4 reflectionMatrix;
  varying vec2 surface;
  varying vec4 reflectedPosition;
  ${waves}
  void main() {
    surface = position.xy;
    vec3 displaced = position;
    float elevation = swell(surface, time);
    displaced.z += elevation;
    // Small horizontal crest travel adds volume without folding the surface.
    displaced.xy += vec2(.48, .22) * cos(dot(surface, vec2(.48, .22)) - time * .72) * .14 * shoreDamping(surface);
    vec4 world = modelMatrix * vec4(displaced, 1.);
    reflectedPosition = reflectionMatrix * world;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
const fragmentShader = /* glsl */ `
  uniform float time;
  uniform float detail;
  uniform float surfaceClarity;
  uniform float reflectionReady;
  uniform sampler2D reflectionMap;
  varying vec2 surface;
  varying vec4 reflectedPosition;
  ${waves}
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 cell = floor(p), f = fract(p);
    vec2 u = f * f * (3. - 2. * f);
    return mix(mix(hash(cell), hash(cell + vec2(1., 0.)), u.x),
      mix(hash(cell + vec2(0., 1.)), hash(cell + vec2(1., 1.)), u.x), u.y);
  }
  float height(vec2 p, float fine) {
    vec2 warp = p + vec2(noise(p * .38 + time * .035), noise(p * .29 - time * .04)) * .7;
    return swell(p, time)
      + sin(dot(warp, vec2(2.1, 1.3)) - time * 1.12) * .009 * fine
      + sin(dot(warp, vec2(-1.5, 2.4)) + time * .86) * .007 * fine;
  }
  void main() {
    vec2 p = surface;
    float shore = length(p) - 12.15;
    float shallow = 1. - smoothstep(.1, 9., islandDistance(p));
    float footprint = max(length(dFdx(p)), length(dFdy(p)));
    float fine = detail * (1. - smoothstep(.04, .13, footprint));
    float eps = .055;
    float dx = (height(p + vec2(eps, 0.), fine) - height(p - vec2(eps, 0.), fine)) / (2. * eps);
    float dy = (height(p + vec2(0., eps), fine) - height(p - vec2(0., eps), fine)) / (2. * eps);
    vec3 normal = normalize(vec3(-dx * surfaceClarity, 1., dy * surfaceClarity));
    vec3 eye = normalize(vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]));
    float facing = max(dot(normal, eye), 0.);
    float fresnel = .04 + .96 * pow(1. - facing, 4.);
    vec3 reflectedRay = reflect(-eye, normal);
    // A smooth sky avoids painting noise blobs onto the reflected water.
    // Broad swells distort scene reflections, but must not paint alternating
    // sky-colored bands across open water as their normals fade into view.
    float skyHeight = smoothstep(-.1, .8, mix(eye.y, reflectedRay.y, .18));
    vec3 sky = mix(vec3(.66, .79, .77), vec3(.19, .43, .57), skyHeight);

    vec3 deep = vec3(.014, .105, .16);
    vec3 lagoon = vec3(.075, .34, .29);
    vec3 water = mix(deep, lagoon, shallow);
    float diffuse = dot(normal, normalize(vec3(-.4, .85, .3)));
    water *= .97 + .06 * diffuse;
    // Height displaces geometry; it must not tint the water into repeating patches.
    float flatFresnel = .04 + .96 * pow(1. - max(eye.y, 0.), 4.);
    float waterFresnel = mix(flatFresnel, fresnel, .18);
    vec3 color = mix(water * .9, sky, clamp(waterFresnel * 1.2 + .2, 0., .75));

    vec2 uv = reflectedPosition.xy / reflectedPosition.w;
    vec2 distortedUV = uv + vec2(normal.x, normal.z) * .018;
    float border = min(min(distortedUV.x, distortedUV.y), min(1. - distortedUV.x, 1. - distortedUV.y));
    float inFrame = smoothstep(.005, .055, border);
    vec2 sampleUV = clamp(distortedUV, .003, .997);
    vec4 reflection = texture2D(reflectionMap, sampleUV) * .4;
    reflection += texture2D(reflectionMap, sampleUV + vec2(.002, 0.)) * .15;
    reflection += texture2D(reflectionMap, sampleUV - vec2(.002, 0.)) * .15;
    reflection += texture2D(reflectionMap, sampleUV + vec2(0., .002)) * .15;
    reflection += texture2D(reflectionMap, sampleUV - vec2(0., .002)) * .15;
    color = mix(color, reflection.rgb, reflectionReady * inFrame * reflection.a * (.17 + fresnel * .48));

    // A broad, restrained highlight avoids the old grid of sharp specular points.
    vec3 halfSun = normalize(normalize(vec3(-.45, .82, -.70)) + eye);
    float sunlight = pow(max(dot(normal, halfSun), 0.), 42.);
    color += vec3(.94, .84, .61) * sunlight * .11;

    // Low-contrast refracted light lives only in the shallows and fades in the overview.
    vec2 warp = p * 1.3 + vec2(noise(p * .4 + time * .025), time * .06);
    float caustic = abs(sin(warp.x + sin(warp.y)) * sin(warp.y - sin(warp.x - time * .13)));
    float lines = 1. - smoothstep(.045, .045 + max(fwidth(caustic) * 2., .035), caustic);
    color += vec3(.05, .1, .06) * lines * shallow * fine * .28;

    // Swash is confined to the beach, rather than concentric rings across the sea.
    float breakup = noise(p * 2.3 + vec2(time * -.1, time * .06));
    float front = shore + sin(time * .62 + noise(p * .24) * 2.) * .26;
    float edge = 1. - smoothstep(.07, .30, abs(front));
    float incoming = 1. - smoothstep(.03, .19, abs(shore - .8 + sin(time * .62 + noise(p * .2)) * .55));
    float foam = (edge * .62 + incoming * .22) * smoothstep(.18, .75, breakup);
    color = mix(color, vec3(.79, .85, .73), foam);
    gl_FragColor = vec4(color, 1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// Spend vertices near the island rather than uniformly across distant water.
function shapeOcean(geometry: PlaneGeometry) {
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const coordinate = (v: number) => {
    const u = v * 2 - 1;
    return Math.sign(u) * (24 * Math.abs(u) + 296 * Math.abs(u) ** 3);
  };
  for (let i = 0; i < position.count; i++)
    position.setXYZ(i, coordinate(uv.getX(i)), coordinate(uv.getY(i)), 0);
  position.needsUpdate = true;
  geometry.computeBoundingSphere();
}

export function Ocean({ reducedMotion }: { reducedMotion: boolean }) {
  const mesh = useRef<Mesh>(null);
  const material = useRef<ShaderMaterial>(null);
  const reflection = useRef<{
    target: WebGLRenderTarget;
    camera: OrthographicCamera;
    direction: Vector3;
    lookAt: Vector3;
    clip: Plane[];
    clearColor: Color;
  } | null>(null);
  const uniforms = useMemo(
    () => ({
      time: { value: 0 },
      detail: { value: 0 },
      surfaceClarity: { value: 0 },
      reflectionMap: { value: null as WebGLRenderTarget['texture'] | null },
      reflectionMatrix: { value: new Matrix4() },
      reflectionReady: { value: 0 },
    }),
    []
  );
  useEffect(() => {
    const target = new WebGLRenderTarget(768, 768);
    reflection.current = {
      target,
      camera: new OrthographicCamera(),
      direction: new Vector3(),
      lookAt: new Vector3(),
      clip: [new Plane(new Vector3(0, 1, 0), 0.59)],
      clearColor: new Color(),
    };
    uniforms.reflectionMap.value = target.texture;
    return () => {
      reflection.current = null;
      uniforms.reflectionMap.value = null;
      uniforms.reflectionReady.value = 0;
      target.dispose();
    };
  }, [uniforms]);
  useFrame(({ camera, gl, scene }, delta) => {
    const owned = reflection.current;
    if (
      !material.current ||
      !mesh.current ||
      !(camera instanceof OrthographicCamera)
    )
      return;
    const span =
      Math.min(camera.right - camera.left, camera.top - camera.bottom) /
      camera.zoom;
    uniforms.detail.value = 1 - MathUtils.smoothstep(span, 12, 26);
    uniforms.surfaceClarity.value = 1 - MathUtils.smoothstep(span, 24, 54);
    if (!reducedMotion) uniforms.time.value += Math.min(delta, 0.05);
    if (!owned) return;

    // Reflect the actual scene with the same orthographic framing. The water is
    // hidden for this pass; clipping removes the underwater side of the island.
    const mirror = owned.camera;
    mirror.copy(camera);
    mirror.position.y = -1.24 - camera.position.y;
    camera.getWorldDirection(owned.direction);
    owned.direction.y *= -1;
    mirror.up.copy(camera.up);
    mirror.up.y *= -1;
    owned.lookAt.copy(mirror.position).add(owned.direction);
    mirror.lookAt(owned.lookAt);
    mirror.updateMatrixWorld();
    uniforms.reflectionMatrix.value
      .set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
      .multiply(mirror.projectionMatrix)
      .multiply(mirror.matrixWorldInverse);
    const previousTarget = gl.getRenderTarget();
    const previousClip = gl.clippingPlanes;
    const previousBackground = scene.background;
    gl.getClearColor(owned.clearColor);
    const previousClearAlpha = gl.getClearAlpha();
    const previousToneMapping = gl.toneMapping;
    const previousShadowUpdate = gl.shadowMap.autoUpdate;
    const previousXr = gl.xr.enabled;
    try {
      mesh.current.visible = false;
      gl.xr.enabled = false;
      gl.shadowMap.autoUpdate = false;
      gl.clippingPlanes = owned.clip;
      gl.toneMapping = NoToneMapping;
      scene.background = null;
      gl.setClearColor(0x000000, 0);
      gl.setRenderTarget(owned.target);
      gl.clear();
      gl.render(scene, mirror);
      uniforms.reflectionReady.value = 1;
    } finally {
      mesh.current.visible = true;
      gl.setRenderTarget(previousTarget);
      gl.clippingPlanes = previousClip;
      scene.background = previousBackground;
      gl.setClearColor(owned.clearColor, previousClearAlpha);
      gl.toneMapping = previousToneMapping;
      gl.shadowMap.autoUpdate = previousShadowUpdate;
      gl.xr.enabled = previousXr;
    }
  });
  return (
    <mesh
      ref={mesh}
      name="portfolio-ocean"
      rotation-x={-Math.PI / 2}
      position={[0, -0.62, 0]}
    >
      <planeGeometry args={[2, 2, 240, 240]} onUpdate={shapeOcean} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
      />
    </mesh>
  );
}
