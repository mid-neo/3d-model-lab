import { Box3, PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { axesFrom, boxCorners, fitDistance, viewDirection } from '../src/viewer/framing';

/** True when every box corner projects inside the camera's view frustum. */
function boxFits(box: Box3, direction: Vector3, distance: number, fov: number, aspect: number): boolean {
  const camera = new PerspectiveCamera(fov, aspect, 0.01, 1000);
  const center = box.getCenter(new Vector3());
  camera.position.copy(center).addScaledVector(direction, distance);
  camera.lookAt(center);
  camera.updateMatrixWorld();
  for (let i = 0; i < 8; i++) {
    const p = new Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
    p.project(camera);
    if (Math.abs(p.x) > 1 || Math.abs(p.y) > 1) return false;
  }
  return true;
}

describe('axesFrom', () => {
  it('builds a right-handed basis for a -Z forward, +Y up model', () => {
    const { forward, up, right } = axesFrom([0, 0, -1], [0, 1, 0]);
    expect(forward.toArray()).toEqual([0, 0, -1]);
    expect(up.toArray()).toEqual([0, 1, 0]);
    expect(right.x).toBeCloseTo(1);
  });

  it('handles Z-up models', () => {
    const { right } = axesFrom([1, 0, 0], [0, 0, 1]);
    expect(right.y).toBeCloseTo(-1);
  });
});

describe('fitDistance', () => {
  // F-35A bounding box from the supplied GLB (meters).
  const f35 = new Box3(new Vector3(-5.36, -1.73, -7.84), new Vector3(5.36, 1.73, 7.84));
  const axes = axesFrom([0, 0, -1], [0, 1, 0]);

  for (const view of ['front', 'side', 'top', 'perspective'] as const) {
    for (const aspect of [0.5, 1, 16 / 9]) {
      it(`keeps the whole model in frame for the ${view} view at aspect ${aspect.toFixed(2)}`, () => {
        const direction = viewDirection(view, axes);
        const distance = fitDistance(boxCorners(f35), f35.getCenter(new Vector3()), direction, 35, aspect);
        expect(boxFits(f35, direction, distance, 35, aspect)).toBe(true);
        // ...without leaving it tiny: shrinking the distance by 30% must clip it.
        expect(boxFits(f35, direction, distance * 0.7, 35, aspect)).toBe(false);
      });
    }
  }

  it('scales with the model instead of using fixed dimensions', () => {
    const small = new Box3(new Vector3(-0.1, -0.1, -0.1), new Vector3(0.1, 0.1, 0.1));
    const big = new Box3(new Vector3(-100, -100, -100), new Vector3(100, 100, 100));
    const dir = new Vector3(0, 0, 1);
    const origin = new Vector3();
    expect(fitDistance(boxCorners(big), origin, dir, 35, 1) / fitDistance(boxCorners(small), origin, dir, 35, 1)).toBeCloseTo(1000);
  });
});
