import { createTreeDetail } from './treeDetail';
import { createTreeWind } from './treeWind';
import type { WindField, Point3 } from './windField';
import { varyTreeGeometry } from '../title/treeVariation';
import type { TreeVariation } from '../title/treeVariation';
import { useFrame, useLoader } from '@react-three/fiber';
import type { RefObject } from 'react';
import type { GrassContactBody } from './grassContact';
import { createFoliageContact } from './foliageContact';
import { BROADLEAF_TREE_LAYOUT } from './broadleafTreeLayout';
import { fitCrownLobes, crownNormalAttribute } from './broadleafNormals';
import { useEffect, useMemo } from 'react';
import { Html, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { windTestHeight } from './windTestGround';

const MODEL = '/models/trees/stylized-tree.glb';
// Source-space shading is identical for every instance, regardless of placement.
const crownCache = new WeakMap<
  THREE.Object3D,
  ReturnType<typeof fitCrownLobes>
>();
const shadingCache = new WeakMap<
  THREE.BufferGeometry,
  {
    coordinates: THREE.BufferAttribute;
    crown?: THREE.BufferAttribute;
  }
>();
export function Broadleaf({
  styled,
  x,
  z,
  width,
  contacts,
  treeHeight = 5,
  terrainHeight = windTestHeight,
  yaw = 0,
  label = true,
  variation,
  field,
  reducedMotion = false,
  onWind,
}: {
  styled: boolean;
  x: number;
  z: number;
  width: number;
  contacts?: RefObject<GrassContactBody[]>;
  treeHeight?: number;
  terrainHeight?: (x: number, z: number) => number;
  yaw?: number;
  label?: boolean;
  variation?: TreeVariation;
  field?: WindField;
  reducedMotion?: boolean;
  onWind?: (id: string, position: Readonly<Point3>, speed: number) => void;
}) {
  const { scene } = useGLTF(MODEL);
  const lodData = useLoader(
    THREE.FileLoader,
    '/models/trees/broadleaf-lod.bin',
    (loader) => {
      loader.setResponseType('arraybuffer');
    }
  ) as ArrayBuffer;
  const windEnabled = !!field;
  const owned = useMemo(() => {
    const root = scene.clone(true);
    root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(root);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const leafMeshes: THREE.Mesh[] = [];
    root.traverse((object) => {
      if (
        object instanceof THREE.Mesh &&
        (Array.isArray(object.material)
          ? object.material
          : [object.material]
        ).some((m) => m.name.startsWith('leafes'))
      )
        leafMeshes.push(object);
    });
    let lobes = crownCache.get(scene);
    if (styled && !lobes) {
      lobes = fitCrownLobes(leafMeshes);
      crownCache.set(scene, lobes);
    }
    const scale = treeHeight / size.y;
    root.scale.multiply(new THREE.Vector3(scale * width, scale, scale * width));
    root.position.add(
      new THREE.Vector3(
        -center.x * scale * width,
        -bounds.min.y * scale,
        -center.z * scale * width
      )
    );
    const foliage: ReturnType<typeof createFoliageContact>[] = [];
    const materials: THREE.Material[] = [];
    const geometries: THREE.BufferGeometry[] = [];
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
      if (styled) {
        const geometry = object.geometry.clone();
        let shading = shadingCache.get(object.geometry);
        if (!shading) {
          const positions = geometry.getAttribute('position');
          const coordinates = new THREE.Float32BufferAttribute(
            positions.count * 3,
            3
          );
          const point = new THREE.Vector3();
          for (let i = 0; i < positions.count; i++) {
            point
              .fromBufferAttribute(positions, i)
              .applyMatrix4(object.matrixWorld);
            coordinates.setXYZ(
              i,
              (point.x - center.x) / size.y,
              (point.y - bounds.min.y) / size.y,
              (point.z - center.z) / size.y
            );
          }
          shading = {
            coordinates,
            crown: leafMeshes.includes(object)
              ? crownNormalAttribute(object, lobes!)
              : undefined,
          };
          shadingCache.set(object.geometry, shading);
        }
        geometry.setAttribute('treeCoordinate', shading.coordinates);
        if (shading.crown) geometry.setAttribute('crownNormal', shading.crown);
        object.geometry = geometry;
        geometries.push(geometry);
        if (variation)
          varyTreeGeometry(
            object,
            bounds,
            variation,
            leafMeshes.includes(object)
          );
        if (contacts && leafMeshes.includes(object))
          foliage.push(
            createFoliageContact(
              object,
              x +
                (treeHeight / 5) *
                  width *
                  (0.044 * Math.cos(yaw) + 0.018 * Math.sin(yaw)),
              z +
                (treeHeight / 5) *
                  width *
                  (-0.044 * Math.sin(yaw) + 0.018 * Math.cos(yaw)),
              false,
              true
            )
          );
      }
      const convert = (source: THREE.Material) => {
        const material = source.clone() as THREE.MeshStandardMaterial;
        materials.push(material);
        if (!styled) return material;
        material.roughness = 1;
        material.metalness = 0;
        material.envMapIntensity = 0.15;
        if (source.name.startsWith('leafes')) {
          material.transparent = false;
          material.opacity = 1;
          material.alphaTest = 0.4;
          material.depthWrite = true;
          // Compress fine texture contrast while preserving green hues and scene shadows.
          material.onBeforeCompile = (shader) => {
            shader.vertexShader =
              'attribute vec3 crownNormal;\nattribute vec3 treeCoordinate;\nvarying vec3 vTreeCoordinate;\nvarying vec3 vCrownNormal;\n' +
              shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace(
              '#include <defaultnormal_vertex>',
              '#include <defaultnormal_vertex>\nvCrownNormal = normalize(normalMatrix * crownNormal);\nvTreeCoordinate = treeCoordinate;'
            );
            shader.fragmentShader =
              'varying vec3 vCrownNormal;\nvarying vec3 vTreeCoordinate;\n' +
              shader.fragmentShader;
            // Preserve fine leaf lighting, with a stronger shared rounded volume.
            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <normal_fragment_begin>',
              '#include <normal_fragment_begin>\nnormal = normalize(mix(normal, normalize(vCrownNormal), .48));'
            );
            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <color_fragment>',
              `#include <color_fragment>
              float leafTone = clamp(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))*3.0,0.,1.);
              float leafValue = .1 + .8 * pow(leafTone,.8);
              vec3 shadedLeaf = vec3(.085,.195,.04);
              vec3 freshLeaf = vec3(.135,.32,.055);
              vec3 sunlitLeaf = vec3(.22,.435,.085);
              vec3 leafColor = mix(shadedLeaf,freshLeaf,smoothstep(0.,.55,leafValue));
              diffuseColor.rgb = mix(leafColor,sunlitLeaf,smoothstep(.4,1.,leafValue));
              // Broad, subtle tonal variation rather than noisy per-leaf random colour.
              float pocket = .5 + .5 * sin(vTreeCoordinate.x*27. + vTreeCoordinate.y*13.)
                * sin(vTreeCoordinate.z*23. - vTreeCoordinate.y*17.);
              float upperCrown = smoothstep(.55,.85,vTreeCoordinate.y);
              diffuseColor.rgb *= 1. - .13 * upperCrown * pocket;
            `
            );
          };
          material.customProgramCacheKey = () => 'sheem-broadleaf-v5';
        } else {
          material.color.set('#796146');
          material.onBeforeCompile = (shader) => {
            shader.vertexShader =
              'attribute vec3 treeCoordinate;\nvarying float vBranchHeight;\n' +
              shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace(
              '#include <begin_vertex>',
              '#include <begin_vertex>\nvBranchHeight = treeCoordinate.y;'
            );
            shader.fragmentShader =
              'varying float vBranchHeight;\n' + shader.fragmentShader;
            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <color_fragment>',
              `#include <color_fragment>
              // Recede canopy branches into the foliage, retaining the warm exposed trunk.
              float canopyBranch = smoothstep(.28,.53,vBranchHeight);
              diffuseColor.rgb = mix(diffuseColor.rgb,vec3(.16,.175,.085),canopyBranch*.65);`
            );
          };
          material.customProgramCacheKey = () => 'sheem-broadleaf-bark-v2';
        }
        return material;
      };
      object.material = Array.isArray(object.material)
        ? object.material.map(convert)
        : convert(object.material);
    });
    return {
      root,
      detail: styled ? createTreeDetail(root, treeHeight, lodData) : undefined,
      materials,
      geometries,
      foliage,
      wind: windEnabled
        ? createTreeWind(
            root,
            'broadleaf',
            x,
            terrainHeight(x, z),
            z,
            treeHeight
          )
        : undefined,
    };
  }, [
    scene,
    lodData,
    styled,
    width,
    x,
    z,
    treeHeight,
    variation,
    contacts,
    yaw,
    windEnabled,
    terrainHeight,
  ]);
  useFrame((state, delta) => {
    if (field)
      owned.wind?.update(
        field,
        state.clock.elapsedTime,
        delta,
        reducedMotion,
        owned.detail?.level === 2 ? 0.5 : owned.detail?.level === 1 ? 0.2 : 0.1
      );
    if (owned.wind)
      onWind?.(`tree:${x}:${z}`, owned.wind.position, owned.wind.speed);
    if (contacts)
      for (const foliage of owned.foliage)
        foliage.update(contacts.current, delta, owned.wind);
    owned.detail?.update(state.camera, delta, contacts?.current);
  });
  useEffect(
    () => () => {
      owned.wind?.dispose();
      owned.detail?.dispose();
      owned.materials.forEach((m) => m.dispose());
      owned.geometries.forEach((g) => g.dispose());
    },
    [owned]
  );
  return (
    <group
      name={styled ? 'BroadleafStyled' : 'BroadleafReference'}
      position={[x, terrainHeight(x, z) - (variation ? 0.035 : 0), z]}
      rotation-y={yaw}
    >
      <primitive object={owned.root} dispose={null} />
      {label && (
        <Html
          position={[0, 0.25, 0]}
          center
          style={{
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            fontSize: 13,
            background: '#f7f5e8',
            color: '#40533f',
            padding: '5px 10px',
            borderRadius: 8,
          }}
        >
          {styled ? 'Sheem broadleaf' : 'Broadleaf · Original'}
        </Html>
      )}
    </group>
  );
}
/** Styled wind-course tree with local character contact. */
export function BroadleafTreeStudy({
  contacts,
  field,
  reducedMotion,
  onWind,
}: {
  contacts: RefObject<GrassContactBody[]>;
  field?: WindField;
  reducedMotion?: boolean;
  onWind?: (id: string, position: Readonly<Point3>, speed: number) => void;
}) {
  return (
    <group name="BroadleafTreeStudy">
      {BROADLEAF_TREE_LAYOUT.map((tree) => (
        <Broadleaf
          key={tree.x}
          {...tree}
          contacts={contacts}
          field={field}
          reducedMotion={reducedMotion}
          onWind={onWind}
        />
      ))}
    </group>
  );
}
