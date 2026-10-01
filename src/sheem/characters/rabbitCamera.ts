import { Camera, Spherical, Vector3 } from 'three';

export const WALK_CAMERA_MAX_POLAR = Math.PI / 2 - 0.12;

/** Terrain-only orbit clearance. Keep the user's zoom and azimuth, lifting the
 * viewing angle when a hill obstructs the target, then releasing that lift. */
export function createRabbitCameraClearance() {
  const offset = new Vector3();
  const orbit = new Spherical();
  let lift = 0;
  return {
    reset() {
      lift = 0;
    },
    // Run before OrbitControls, so temporary clearance does not overwrite the
    // user's requested pitch. Spherical restoration also preserves wheel zoom.
    restore(camera: Camera, target: Vector3) {
      if (!lift) return;
      orbit.setFromVector3(offset.copy(camera.position).sub(target));
      orbit.phi = Math.min(WALK_CAMERA_MAX_POLAR, orbit.phi + lift);
      camera.position.copy(target).add(offset.setFromSpherical(orbit));
    },
    update(
      camera: Camera,
      target: Vector3,
      height: (x: number, z: number) => number,
      dt: number
    ) {
      orbit.setFromVector3(offset.copy(camera.position).sub(target));
      const desired = orbit.phi;
      const steps = Math.max(12, Math.ceil(orbit.radius / 0.15));
      const clear = (phi: number) => {
        orbit.phi = phi;
        offset.setFromSpherical(orbit);
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const margin = i === steps ? 0.4 : 0.2;
          if (
            target.y + offset.y * t <
            height(target.x + offset.x * t, target.z + offset.z * t) + margin
          )
            return false;
        }
        return true;
      };
      let safe = desired;
      if (!clear(desired)) {
        // Scan first: arbitrary terrain is not globally monotonic with pitch.
        let blocked = desired;
        safe = 0.05;
        for (let i = 1; i <= 20; i++) {
          const candidate = desired * (1 - i / 20);
          if (clear(candidate)) {
            safe = candidate;
            for (let j = 0; j < 8; j++) {
              const middle = (safe + blocked) / 2;
              if (clear(middle)) safe = middle;
              else blocked = middle;
            }
            break;
          }
          blocked = candidate;
        }
      }
      // Immediate clearance, gentle return; no gait-driven camera movement.
      lift = Math.max(desired - safe, lift * Math.exp(-6 * Math.min(dt, 0.05)));
      orbit.phi = Math.max(0.001, desired - lift);
      // On irregular terrain the returning arc needs its own clearance check.
      if (!clear(orbit.phi)) orbit.phi = safe;
      lift = desired - orbit.phi;
      camera.position.copy(target).add(offset.setFromSpherical(orbit));
      camera.lookAt(target);
    },
  };
}
