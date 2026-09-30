import { Mesh, MeshStandardMaterial, Object3D, ShaderChunk } from 'three';

/** Independent blink clock; gait switches don't restart the interval. */
export function createBlinkClock(random = Math.random) {
  let wait = 1.5 + random() * 1.5;
  let phase = -1;
  const ease = (t: number) => t * t * (3 - 2 * t);
  return (delta: number) => {
    const dt = Math.min(Math.max(delta, 0), 0.05);
    if (phase < 0) {
      wait -= dt;
      if (wait > 0) return 0;
      phase = Math.max(0, -wait);
    } else phase += dt;
    if (phase < 0.075) return ease(phase / 0.075);
    if (phase < 0.11) return 1;
    if (phase < 0.23) return 1 - ease((phase - 0.11) / 0.12);
    phase = -1;
    wait = 3 + random() * 3;
    return 0;
  };
}

/** Compress only the painted eyes in UV space: no raised eyelid geometry.
 * Coordinates match the front-projected face atlas authored in build_rabbit.py.
 * Materials are owned per avatar; cached maps and geometry remain shared.
 */
export function createRabbitBlink(root: Object3D) {
  const uniform = { value: 0 };
  const clock = createBlinkClock();
  const owned: MeshStandardMaterial[] = [];
  const restore: (() => void)[] = [];
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const original = object.material;
    const source = Array.isArray(original) ? original : [original];
    const materials = source.map((material) => {
      if (!(material instanceof MeshStandardMaterial) || !material.map)
        return material;
      const copy = material.clone();
      copy.onBeforeCompile = (shader) => {
        shader.uniforms.rabbitBlink = uniform;
        shader.fragmentShader =
          'uniform float rabbitBlink;\n' + shader.fragmentShader;
        const map = ShaderChunk.map_fragment.replace(
          'vec4 sampledDiffuseColor = texture2D( map, vMapUv );',
          `vec2 faceUv = vMapUv;
          float eyeX = faceUv.x < 0.5 ? 0.33369231 : 0.66630769;
          float eyeY = 0.46296296;
          if (abs(faceUv.x - eyeX) < 0.058 && abs(faceUv.y - eyeY) < 0.110) {
            float opening = max(0.045, 1.0 - rabbitBlink);
            faceUv.y = eyeY + clamp((faceUv.y - eyeY) / opening, -0.110, 0.110);
          }
          vec4 sampledDiffuseColor = textureGrad(map, faceUv, dFdx(vMapUv), dFdy(vMapUv));
          float eyeOffset = (vMapUv.x - eyeX) / 0.046;
          float lidY = eyeY + 0.004 * (1.0 - eyeOffset * eyeOffset);
          float aa = max(fwidth(vMapUv.y), 0.0005);
          float lid = (1.0 - smoothstep(0.003, 0.003 + aa, abs(vMapUv.y - lidY)))
            * (1.0 - smoothstep(0.92, 1.0, abs(eyeOffset)))
            * smoothstep(0.75, 0.98, rabbitBlink);
          sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, vec3(0.065, 0.042, 0.027), lid);`
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <map_fragment>',
          map
        );
      };
      copy.customProgramCacheKey = () => 'sheem-rabbit-blink-v3';
      owned.push(copy);
      return copy;
    });
    object.material = Array.isArray(original) ? materials : materials[0];
    restore.push(() => {
      object.material = original;
    });
  });
  return {
    update(delta: number) {
      uniform.value = clock(delta);
    },
    dispose() {
      restore.forEach((reset) => reset());
      owned.forEach((material) => material.dispose());
    },
  };
}
