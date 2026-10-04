import { Suspense } from 'react';
import type { RefObject } from 'react';
import type { GrassContactBody } from '../wind/grassContact';
import { Pine } from '../wind/PineTreeStudy';
import { Broadleaf } from '../wind/BroadleafTreeStudy';
import { surfaceHeight } from './landscape';
import { MEADOW_TREES } from './meadowTreeLayout';

export function MeadowTrees({
  contacts,
}: {
  contacts?: RefObject<GrassContactBody[]>;
}) {
  return (
    <group name="StyledMeadowTrees">
      {MEADOW_TREES.map((tree) => {
        const Component = tree.kind === 'pine' ? Pine : Broadleaf;
        // Only trees beside the current walking clearing need mutable contact meshes.
        const reachable = Math.hypot(tree.x + 9, tree.z + 25) < 10;
        return (
          <Suspense key={tree.seed} fallback={null}>
            <Component
              styled
              x={tree.x}
              z={tree.z}
              treeHeight={tree.height}
              width={tree.width}
              yaw={tree.yaw}
              variation={tree}
              terrainHeight={surfaceHeight}
              label={false}
              contacts={reachable ? contacts : undefined}
            />
          </Suspense>
        );
      })}
    </group>
  );
}
