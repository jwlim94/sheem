import { createTreeWind } from './treeWind';
import type { WindField } from './windField';
import { varyTreeGeometry } from '../title/treeVariation';
import type { TreeVariation } from '../title/treeVariation';
import { useFrame } from '@react-three/fiber';
import type { RefObject } from 'react';
import type { GrassContactBody } from './grassContact';
import { createFoliageContact } from './foliageContact';
import { PINE_TREE_LAYOUT } from './pineTreeLayout';
import { useEffect, useMemo, useRef } from 'react';
import { Html, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { windTestHeight } from './windTestGround';

const MODEL = '/models/trees/pine-tree.glb';
/** Keep the loader's cached source untouched; own only study materials/geometries. */
export function Pine({
  styled,
  x,
  z,
  contacts,
  isolated = false,
  treeHeight = 5,
  width = 1,
  terrainHeight = windTestHeight,
  yaw = 0,
  label = true,
  variation,
  field,
  reducedMotion = false,
}: {
  isolated?: boolean;
  styled: boolean;
  x: number;
  z: number;
  contacts?: RefObject<GrassContactBody[]>;
  treeHeight?: number;
  width?: number;
  terrainHeight?: (x: number, z: number) => number;
  yaw?: number;
  label?: boolean;
  variation?: TreeVariation;
  field?: WindField;
  reducedMotion?: boolean;
}) {
  const { scene } = useGLTF(MODEL);
  const windEnabled = !!field;
  const brushMarker = useRef<THREE.Group>(null);
  const assets = useMemo(() => {
    const root = scene.clone(true);
    const materials: THREE.Material[] = [];
    const geometries: THREE.BufferGeometry[] = [];
    const foliage: ReturnType<typeof createFoliageContact>[] = [];
    root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(root);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const scale = treeHeight / size.y;
    root.scale.multiply(new THREE.Vector3(scale * width, scale, scale * width));
    root.position.add(
      new THREE.Vector3(
        -center.x * scale * width,
        -bounds.min.y * scale,
        -center.z * scale * width
      )
    );
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      if (
        isolated &&
        !(
          Array.isArray(object.material) ? object.material : [object.material]
        ).some((m) => m.name === 'Leavs')
      )
        object.visible = false;
      object.castShadow = true;
      object.receiveShadow = true;
      const convert = (original: THREE.Material) => {
        const material = original.clone() as THREE.MeshStandardMaterial;
        materials.push(material);
        if (!styled) return material;
        const leaves = original.name === 'Leavs';
        material.roughness = 1;
        material.metalness = 0;
        material.envMapIntensity = 0.15;
        if (leaves) {
          // Cutout leaves avoid blended-layer sorting and retain their silhouettes.
          material.transparent = false;
          material.opacity = 1;
          material.alphaTest = 0.35;
          material.depthWrite = true;
          material.color.set('#e5edcb');
          material.onBeforeCompile = (shader) => {
            shader.vertexShader = `attribute vec2 canopyTone;
              varying vec2 vCanopyTone;\n${shader.vertexShader}`.replace(
              '#include <begin_vertex>',
              '#include <begin_vertex>\nvCanopyTone = canopyTone;'
            );
            shader.fragmentShader = `varying vec2 vCanopyTone;\n${shader.fragmentShader}`;
            shader.fragmentShader = shader.fragmentShader
              .replace(
                '#include <color_fragment>',
                `#include <color_fragment>
              float leafTone = clamp(dot(diffuseColor.rgb, vec3(.2126,.7152,.0722))*4.,0.,1.);
              vec3 lowerLeaf = mix(vec3(.16,.23,.075),vec3(.43,.56,.21),sqrt(leafTone));
              // Retain the approved lower canopy, with richer greens in exposed upper tiers.
              vec3 upperLeaf = mix(vec3(.095,.185,.045),vec3(.255,.405,.12),pow(leafTone,.8));
              float upperWeight = smoothstep(.35,.85,vCanopyTone.x);
              float innerShade = mix(.89,1.,smoothstep(.12,.8,vCanopyTone.y));
              diffuseColor.rgb = mix(lowerLeaf,upperLeaf,upperWeight) * mix(1.,innerShade,upperWeight);
              float tipWeight = smoothstep(.86,.98,vCanopyTone.x);
              diffuseColor.rgb *= mix(1.,mix(.78,1.06,smoothstep(.015,.38,leafTone)),tipWeight);`
              )
              .replace(
                '#include <alphatest_fragment>',
                `#include <alphatest_fragment>
                // Thin the overlapping tip-card fringes without changing lower branches.
                if (diffuseColor.a < mix(.35,.50,smoothstep(.86,.98,vCanopyTone.x))) discard;`
              )
              .replace(
                '#include <normal_fragment_begin>',
                `#include <normal_fragment_begin>
              #ifdef DOUBLE_SIDED
                normal *= faceDirection;
              #endif`
              );
          };
          material.customProgramCacheKey = () => 'sheem-pine-leaves-v5';
        } else {
          material.color.set('#ead7b6');
          material.normalScale.multiplyScalar(0.45);
        }
        return material;
      };
      const sourceMaterials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      const converted = sourceMaterials.map(convert);
      object.material = Array.isArray(object.material)
        ? converted
        : converted[0];
      if (styled && sourceMaterials.some((m) => m.name === 'Leavs')) {
        const geometry = object.geometry.clone();
        geometries.push(geometry);
        geometry.computeBoundingBox();
        const box = geometry.boundingBox!;
        const c = box.getCenter(new THREE.Vector3()),
          extent = box.getSize(new THREE.Vector3());
        const position = geometry.attributes.position,
          normals = geometry.attributes.normal;
        const tones = new THREE.Float32BufferAttribute(
          new Float32Array(position.count * 2),
          2
        );
        const world = new THREE.Vector3();
        const v = new THREE.Vector3(),
          normal = new THREE.Vector3();
        // Broader canopy normals soften individual leaf-card shading while retaining texture detail.
        for (let i = 0; i < position.count; i++) {
          // Cached source world matrices and source bounds share the same space.
          world
            .fromBufferAttribute(position, i)
            .applyMatrix4(object.matrixWorld);
          const height = THREE.MathUtils.clamp(
            (world.y - bounds.min.y) / size.y,
            0,
            1
          );
          const radius = Math.hypot(
            (world.x - center.x) / (size.x * 0.5),
            (world.z - center.z) / (size.z * 0.5)
          );
          tones.setXY(
            i,
            height,
            Math.min(1, radius / Math.max(0.2, 1 - height * 0.8))
          );
          v.fromBufferAttribute(position, i).sub(c);
          v.set(
            v.x / Math.max(extent.x, 0.001),
            v.y / Math.max(extent.y, 0.001),
            v.z / Math.max(extent.z, 0.001)
          ).normalize();
          // Preserve more card direction at the tip so its overlapping needles
          // do not all receive the same broad-canopy lighting.
          const tipWeight = THREE.MathUtils.smoothstep(height, 0.86, 0.98);
          normal
            .fromBufferAttribute(normals, i)
            .lerp(v, 0.6 - 0.35 * tipWeight)
            .normalize();
          normals.setXYZ(i, normal.x, normal.y, normal.z);
        }
        normals.needsUpdate = true;
        geometry.setAttribute('canopyTone', tones);
        object.geometry = geometry;
        if (variation) varyTreeGeometry(object, bounds, variation, true);
        if (contacts)
          foliage.push(createFoliageContact(object, x, z, isolated));
      } else if (variation || windEnabled) {
        object.geometry = object.geometry.clone();
        geometries.push(object.geometry);
        if (variation) varyTreeGeometry(object, bounds, variation, false);
      }
    });
    return {
      root,
      materials,
      geometries,
      foliage,
      wind: windEnabled
        ? createTreeWind(root, 'pine', x, terrainHeight(x, z), z, treeHeight)
        : undefined,
    };
  }, [
    scene,
    styled,
    x,
    z,
    isolated,
    treeHeight,
    width,
    variation,
    contacts,
    windEnabled,
    terrainHeight,
  ]);
  useFrame((state, delta) => {
    if (field)
      assets.wind?.update(field, state.clock.elapsedTime, delta, reducedMotion);
    if (contacts)
      for (const foliage of assets.foliage)
        foliage.update(contacts.current, delta);
    if (brushMarker.current && assets.foliage[0]) {
      brushMarker.current.position.copy(assets.foliage[0].anchor);
      brushMarker.current.position.x -= x;
      brushMarker.current.position.y -= windTestHeight(x, z);
      brushMarker.current.position.z -= z;
      brushMarker.current.position.y += 0.35;
    }
  });
  useEffect(
    () => () => {
      assets.wind?.dispose();
      assets.materials.forEach((m) => m.dispose());
      assets.geometries.forEach((g) => g.dispose());
    },
    [assets]
  );
  return (
    <group
      position={[x, terrainHeight(x, z) - (variation ? 0.035 : 0), z]}
      rotation-y={yaw}
      name={
        isolated ? 'PineBranchTest' : styled ? 'PineStyled' : 'PineReference'
      }
    >
      <primitive object={assets.root} dispose={null} />
      {isolated && (
        <group ref={brushMarker}>
          <Html
            center
            style={{
              fontSize: 11,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              background: '#f7f5e8',
              color: '#40533f',
              padding: '3px 7px',
              borderRadius: 6,
            }}
          >
            Brush test · one branch
          </Html>
        </group>
      )}
      {!isolated && label && (
        <Html
          position={[0, 0.2, 0]}
          center
          distanceFactor={8}
          style={{
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            background: '#f7f5e8',
            color: '#40533f',
            padding: '5px 10px',
            borderRadius: 8,
          }}
        >
          {styled ? 'Sheem pine' : 'Pine · Original'}
        </Html>
      )}
    </group>
  );
}

export function PineTreeStudy({
  contacts,
  field,
  reducedMotion,
}: {
  contacts: RefObject<GrassContactBody[]>;
  field?: WindField;
  reducedMotion?: boolean;
}) {
  return (
    <group name="PineTreeStudy">
      {PINE_TREE_LAYOUT.map((pine) => (
        <Pine
          key={pine.x}
          {...pine}
          contacts={contacts}
          field={field}
          reducedMotion={reducedMotion}
        />
      ))}
    </group>
  );
}
