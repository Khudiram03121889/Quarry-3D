import * as THREE from 'three';

export interface KutchaRoadSpec {
  id: 'lower' | 'upper';
  curve: THREE.CatmullRomCurve3;
  /** Full drivable flat width (two wide lanes + center unpaved crown) */
  width: number;
  /** Lateral distance from centerline to each lane's center */
  laneOffset: number;
  /** Number of longitudinal mesh segments */
  segments: number;
  /** Pre-sampled centerline points for fast terrain clearance queries */
  samples: THREE.Vector3[];
}

export interface QuarryHaulRoadNetwork {
  lower: KutchaRoadSpec;
  upper: KutchaRoadSpec;
  all: KutchaRoadSpec[];
}

const _up = new THREE.Vector3(0, 1, 0);
const _tan = new THREE.Vector3();
const _right = new THREE.Vector3();

/**
 * Evaluates a point and horizontal right-normal on a kutcha road at normalized u in [0, 1],
 * offset laterally by `lateralOffset` meters (+ = right of travel direction +u, - = left).
 */
export function sampleKutchaRoadFrame(
  curve: THREE.CatmullRomCurve3,
  u: number,
  lateralOffset: number,
  outPos: THREE.Vector3,
  outTangent?: THREE.Vector3,
  outRight?: THREE.Vector3,
): void {
  const clamped = THREE.MathUtils.clamp(u, 0, 1);
  curve.getPointAt(clamped, outPos);
  curve.getTangentAt(clamped, _tan).normalize();

  // Keep road deck laterally level (no roll) using world-up cross product
  _right.crossVectors(_tan, _up);
  if (_right.lengthSq() < 1e-6) {
    _right.set(1, 0, 0);
  } else {
    _right.normalize();
  }

  outPos.addScaledVector(_right, lateralOffset);
  if (outTangent) outTangent.copy(_tan);
  if (outRight) outRight.copy(_right);
}

let cachedNetwork: QuarryHaulRoadNetwork | null = null;

/**
 * Shared two-lane Kutcha (unpaved quarry dirt & gravel) haul road network used by both
 * terrain construction and moving dump-truck kinematics so wheels stay 100% flush and
 * opposing lanes pass cleanly side-by-side without clipping.
 */
export function getQuarryHaulRoads(): QuarryHaulRoadNetwork {
  if (cachedNetwork) return cachedNetwork;

  // Lower sweeping two-lane kutcha haul road ascending gently behind the arena (Panels A & D)
  // Wide curvature radius guarantees opposing lanes never pinch or fold.
  const lowerCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(-66, 0.9, -25.5),
      new THREE.Vector3(-42, 1.4, -24.2),
      new THREE.Vector3(-18, 2.4, -22.8),
      new THREE.Vector3(4, 4.1, -25.6),
      new THREE.Vector3(24, 6.0, -31.5),
      new THREE.Vector3(46, 7.8, -36.5),
      new THREE.Vector3(70, 9.4, -40.0),
    ],
    false,
    'catmullrom',
    0.45,
  );

  // Upper cliff-terrace two-lane kutcha haul road along the high quarry bench (Panels A & C)
  const upperCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(-72, 14.6, -56.5),
      new THREE.Vector3(-36, 14.6, -54.8),
      new THREE.Vector3(0, 14.6, -54.0),
      new THREE.Vector3(36, 14.6, -54.8),
      new THREE.Vector3(72, 14.6, -56.5),
    ],
    false,
    'catmullrom',
    0.4,
  );

  const lower: KutchaRoadSpec = {
    id: 'lower',
    curve: lowerCurve,
    width: 9.4, // 2 lanes x 4.0m + 1.4m unpaved dusty median crown
    laneOffset: 2.35, // 4.70m center-to-center -> ~1.35m clean gap between passing haul trucks
    segments: 84,
    samples: lowerCurve.getSpacedPoints(120),
  };

  const upper: KutchaRoadSpec = {
    id: 'upper',
    curve: upperCurve,
    width: 9.4,
    laneOffset: 2.35,
    segments: 72,
    samples: upperCurve.getSpacedPoints(120),
  };

  cachedNetwork = {
    lower,
    upper,
    all: [lower, upper],
  };

  return cachedNetwork;
}

/**
 * Checks whether an (x, z) point lies within any kutcha road corridor and returns
 * the road elevation + normalized blend weight so terrain cliffs cleanly clear the road deck.
 */
export function queryRoadCorridorClearance(
  x: number,
  z: number,
  corridorHalfWidth = 6.4,
): { inside: boolean; roadY: number; blend: number } {
  const network = getQuarryHaulRoads();
  let bestDistSq = Infinity;
  let bestY = 0;

  for (let r = 0; r < network.all.length; r++) {
    const samples = network.all[r].samples;
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const dx = x - s.x;
      const dz = z - s.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestY = s.y;
      }
    }
  }

  const dist = Math.sqrt(bestDistSq);
  if (dist >= corridorHalfWidth + 4.0) {
    return { inside: false, roadY: bestY, blend: 0 };
  }
  const blend = 1 - THREE.MathUtils.smoothstep(dist, corridorHalfWidth * 0.72, corridorHalfWidth + 4.0);
  return { inside: dist < corridorHalfWidth, roadY: bestY, blend };
}
