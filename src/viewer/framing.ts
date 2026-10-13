import { Box3, MathUtils, Vector3 } from 'three';
import type { Vec3 } from '../catalog/types';

export type ViewName = 'front' | 'side' | 'top' | 'perspective';

/** Orthonormal basis of a model: forward (nose), up, and right-hand side. */
export interface ModelAxes {
  forward: Vector3;
  up: Vector3;
  right: Vector3;
}

export function axesFrom(forward: Vec3, up: Vec3): ModelAxes {
  const f = new Vector3(...forward).normalize();
  // Re-orthogonalize "up" in case the catalog entry is slightly off.
  const u = new Vector3(...up).sub(f.clone().multiplyScalar(new Vector3(...up).dot(f))).normalize();
  const r = new Vector3().crossVectors(f, u).normalize();
  return { forward: f, up: u, right: r };
}

/**
 * Unit vector pointing from the model's center toward the camera for a named
 * view. "Front" looks at the nose, "side" at the left flank, "top" from above
 * with the nose pointing up the screen.
 */
export function viewDirection(view: ViewName, axes: ModelAxes): Vector3 {
  const { forward, up, right } = axes;
  switch (view) {
    case 'front':
      return forward.clone().addScaledVector(up, 0.0001).normalize();
    case 'side':
      return right.clone().negate().addScaledVector(up, 0.0001).normalize();
    case 'top':
      // A tiny backward tilt keeps OrbitControls away from its pole singularity
      // and leaves the nose at the top of the screen.
      return up.clone().addScaledVector(forward, -0.001).normalize();
    case 'perspective':
      return forward
        .clone()
        .multiplyScalar(0.62)
        .addScaledVector(right, -0.62)
        .addScaledVector(up, 0.48)
        .normalize();
  }
}

/** The eight corners of a box, for framing when no vertex sample is available. */
export function boxCorners(box: Box3): Vector3[] {
  const corners: Vector3[] = [];
  for (let i = 0; i < 8; i++) {
    corners.push(
      new Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z),
    );
  }
  return corners;
}

/**
 * Distance from `center` at which a perspective camera looking along
 * -direction sees every point, with `margin` extra room (1.12 = 12%).
 * Works on the model's own vertices, so the framing follows its silhouette
 * from each view instead of its bounding box or sphere.
 */
export function fitDistance(
  points: readonly Vector3[],
  center: Vector3,
  direction: Vector3,
  verticalFovDeg: number,
  aspect: number,
  margin = 1.12,
): number {
  const dir = direction.clone().normalize();
  // Camera basis: any "up" not parallel to dir works for extents.
  const worldUp = Math.abs(dir.y) > 0.999 ? new Vector3(0, 0, 1) : new Vector3(0, 1, 0);
  const camRight = new Vector3().crossVectors(worldUp, dir).normalize();
  const camUp = new Vector3().crossVectors(dir, camRight).normalize();

  const tanV = Math.tan(MathUtils.degToRad(verticalFovDeg) / 2) / margin;
  const tanH = Math.tan(Math.atan(Math.tan(MathUtils.degToRad(verticalFovDeg) / 2) * aspect)) / margin;
  let distance = 0;
  const offset = new Vector3();
  for (const point of points) {
    offset.subVectors(point, center);
    const depth = offset.dot(dir); // toward the camera is positive
    const needX = Math.abs(offset.dot(camRight)) / tanH;
    const needY = Math.abs(offset.dot(camUp)) / tanV;
    distance = Math.max(distance, depth + Math.max(needX, needY));
  }
  return distance;
}
