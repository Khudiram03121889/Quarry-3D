import * as THREE from 'three';
import type { QuarryMaterialLibrary } from './materials';

/**
 * Deterministic terrain height function for the entire KGF Quarry basin.
 * - Playable fighting arena floor: X in [-18, +18], Z in [-8.5, +8.5] is flat (y ~ 0)
 *   so fighters, crates, barrels, watchtowers, and sheds sit completely flush.
 * - Behind the arena (Z < -12): Dramatic multi-tiered stepped open-pit quarry cliffs
 *   with carved horizontal benches and a central sunset valley notch.
 * - Left & Right distant flanks: Rising quarry walls so there is never an empty void.
 */
export function groundHeightAt(x: number, z: number): number {
  // Playable arena floor + side structure pad: completely flat and grounded
  if (z >= -10 && z <= 14 && Math.abs(x) <= 23) {
    // Subtle micro-relief only outside the strict fighting center
    const edgeFactor = Math.max(0, (Math.abs(x) - 18) / 5);
    return edgeFactor * 0.25;
  }

  // Slight embankment behind foreground camera edge
  if (z > 14) {
    const t = Math.min(1, (z - 14) / 28);
    return t * 2.2 + Math.sin(x * 0.14) * 0.4 * t;
  }

  // Quarry pit & terraced amphitheater walls behind the arena (z < -10)
  // Smooth distance into the open-pit bowl
  const backDist = Math.max(0, -10 - z);

  // Carved lower pit drop / switchback basin from z = -10 to z = -34
  if (backDist < 22 && Math.abs(x) < 34) {
    // Gently sloped lower haul-road terrace & rubble basin
    const rampSlope = ((x + 28) / 56) * 4.5; // slopes upward left -> right
    const basinDip = Math.sin((backDist / 22) * Math.PI) * -1.4;
    const flankRise = Math.pow(Math.max(0, Math.abs(x) - 22) / 14, 2) * 8.0;
    return Math.max(-1.8, rampSlope * (backDist / 22) + basinDip + flankRise);
  }

  // Main stepped terraced quarry cliffs wrapping in a giant amphitheater arc
  const cx = x * 0.85;
  const cz = z + 8;
  const radial = Math.sqrt(cx * cx + cz * cz);

  // Central sunset notch right along x ~ +3, z < -45 so the golden sun shines between cliffs!
  const notchFactor = 1.0 - 0.42 * Math.exp(-Math.pow((x - 3.0) / 22.0, 2));

  // Base amphitheater elevation rising steeply from radial = 32m to 115m
  const wallT = Math.max(0, (radial - 30) / 72);
  const rawHeight = Math.pow(wallT, 1.28) * 52 * notchFactor;

  // Quantize into carved open-pit mining benches (terraces every ~5.8m)
  const stepSize = 5.6;
  const stepIndex = Math.floor(rawHeight / stepSize);
  const stepFrac = (rawHeight % stepSize) / stepSize;
  // Steep rock face (0..0.28), then wide flat mining bench (0.28..1.0)
  const terraceBlend = THREE.MathUtils.smoothstep(stepFrac, 0.0, 0.28);
  const terracedHeight = (stepIndex + terraceBlend) * stepSize;

  // Add stratified fractured rock noise
  const rockNoise =
    Math.sin(x * 0.17 + z * 0.11) * 1.15 +
    Math.cos(x * 0.37 - z * 0.29) * 0.55 +
    Math.sin(x * 0.09 - z * 0.07) * 1.8;

  // Side walls flanking far left/right (|x| > 23)
  const sideWall =
    Math.abs(x) > 23 ? Math.pow(Math.min(1, (Math.abs(x) - 23) / 48), 1.35) * 26 : 0;

  return Math.max(0, Math.max(terracedHeight, sideWall) + rockNoise * Math.min(1, wallT * 1.8));
}

export interface QuarryTerrainResult {
  group: THREE.Group;
  dispose: () => void;
}

export function createTerrainAndCliffs(
  materials: QuarryMaterialLibrary,
): QuarryTerrainResult {
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];

  // ---------------------------------------------------------------------------
  // 1. PLAYABLE FIGHTING GROUND (36m x 15m core + apron to 48m x 26m)
  // ---------------------------------------------------------------------------
  const floorGeo = new THREE.PlaneGeometry(52, 28, 36, 20);
  floorGeo.rotateX(-Math.PI / 2);
  const fPos = floorGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < fPos.count; i++) {
    const vx = fPos.getX(i);
    const vz = fPos.getZ(i);
    // Keep playable combat lane (|x|<=18, |z|<=7.5) very flat with subtle dusty micro-undulation
    const micro =
      (Math.sin(vx * 0.45) * Math.cos(vz * 0.52) + Math.sin(vx * 1.1 + vz * 0.9) * 0.35) * 0.03;
    const edgeLift = Math.max(0, (Math.abs(vx) - 20) / 6) * 0.35;
    fPos.setY(i, micro + edgeLift);
  }
  floorGeo.computeVertexNormals();
  geometries.push(floorGeo);

  const floorMesh = new THREE.Mesh(floorGeo, materials.arenaGround);
  floorMesh.position.set(0, 0, 1.5);
  floorMesh.receiveShadow = true;
  group.add(floorMesh);

  // Reflective muddy rainwater puddles matching Panel A foreground reflection
  const puddleSpecs = [
    { x: -3.8, z: 3.4, sx: 3.4, sz: 1.1, rot: 0.12 },
    { x: 2.6, z: 2.9, sx: 4.1, sz: 1.25, rot: -0.08 },
    { x: -9.5, z: 2.1, sx: 2.2, sz: 0.85, rot: 0.2 },
    { x: 6.4, z: 4.1, sx: 2.5, sz: 0.9, rot: -0.15 },
  ];
  const puddleGeo = new THREE.CircleGeometry(1, 24);
  puddleGeo.rotateX(-Math.PI / 2);
  geometries.push(puddleGeo);
  for (const p of puddleSpecs) {
    const puddle = new THREE.Mesh(puddleGeo, materials.puddleWater);
    puddle.position.set(p.x, 0.032, p.z);
    puddle.scale.set(p.sx, 1, p.sz);
    puddle.rotation.y = p.rot;
    puddle.receiveShadow = true;
    group.add(puddle);
  }

  // ---------------------------------------------------------------------------
  // 2. SURROUNDING STEPPED OPEN-PIT QUARRY CLIFFS & HAUL BASIN
  // ---------------------------------------------------------------------------
  const cliffW = 240;
  const cliffD = 210;
  const cliffGeo = new THREE.PlaneGeometry(cliffW, cliffD, 118, 102);
  cliffGeo.rotateX(-Math.PI / 2);

  const pos = cliffGeo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const tmpCol = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    // Shift mesh backward so it spans z from +55 down to -155
    const wz = pos.getZ(i) - 50;
    pos.setZ(i, wz);

    // Lower slightly under the playable floor pad so floorMesh sits cleanly above with zero z-fighting
    if (wz > -10.5 && wz < 14.5 && Math.abs(vx) < 24.5) {
      pos.setY(i, -0.45);
      tmpCol.setRGB(0.45, 0.36, 0.28);
    } else {
      const h = groundHeightAt(vx, wz);
      pos.setY(i, h);

      // Geological rock color banding by elevation: darker coal/slate at base, dusty ochre-limestone on terraces
      const band = Math.sin(h * 1.15) * 0.5 + 0.5;
      const r = THREE.MathUtils.lerp(0.36, 0.68, band * 0.65 + Math.min(1, h / 42) * 0.35);
      const g = THREE.MathUtils.lerp(0.3, 0.56, band * 0.65 + Math.min(1, h / 42) * 0.35);
      const b = THREE.MathUtils.lerp(0.25, 0.44, band * 0.65 + Math.min(1, h / 42) * 0.35);
      tmpCol.setRGB(r, g, b);
    }
    colors[i * 3] = tmpCol.r;
    colors[i * 3 + 1] = tmpCol.g;
    colors[i * 3 + 2] = tmpCol.b;
  }

  cliffGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  cliffGeo.computeVertexNormals();
  geometries.push(cliffGeo);

  const cliffMesh = new THREE.Mesh(cliffGeo, materials.cliffStone);
  cliffMesh.receiveShadow = true;
  cliffMesh.castShadow = false;
  group.add(cliffMesh);

  // ---------------------------------------------------------------------------
  // 3. CARVED SWITCHBACK QUARRY HAUL ROAD EMBANKMENT (Visible in Panel A & D)
  // ---------------------------------------------------------------------------
  const roadPoints = [
    new THREE.Vector3(-24, 0.3, -18),
    new THREE.Vector3(-8, 1.8, -22),
    new THREE.Vector3(6, 4.2, -28),
    new THREE.Vector3(16, 6.2, -35),
    new THREE.Vector3(4, 8.6, -42),
    new THREE.Vector3(-14, 10.6, -46),
    new THREE.Vector3(-28, 12.2, -52),
  ];
  const roadCurve = new THREE.CatmullRomCurve3(roadPoints);
  const roadSegs = 48;
  const roadWidth = 5.4;
  const roadVerts: number[] = [];
  const roadUvs: number[] = [];
  const roadIndices: number[] = [];

  const up = new THREE.Vector3(0, 1, 0);
  const tan = new THREE.Vector3();
  const side = new THREE.Vector3();

  for (let i = 0; i <= roadSegs; i++) {
    const t = i / roadSegs;
    const pt = roadCurve.getPoint(t);
    roadCurve.getTangent(t, tan).normalize();
    side.crossVectors(tan, up).normalize();

    const left = pt.clone().addScaledVector(side, -roadWidth * 0.5);
    const right = pt.clone().addScaledVector(side, roadWidth * 0.5);
    const skirtL = left.clone().setY(left.y - 5.5);
    const skirtR = right.clone().setY(right.y - 5.5);

    roadVerts.push(
      skirtL.x, skirtL.y, skirtL.z,
      left.x, left.y, left.z,
      right.x, right.y, right.z,
      skirtR.x, skirtR.y, skirtR.z,
    );
    roadUvs.push(0, t * 8, 0.2, t * 8, 0.8, t * 8, 1, t * 8);

    if (i < roadSegs) {
      const base = i * 4;
      const next = (i + 1) * 4;
      // Left embankment, road deck, right embankment
      for (let q = 0; q < 3; q++) {
        roadIndices.push(base + q, next + q, base + q + 1);
        roadIndices.push(base + q + 1, next + q, next + q + 1);
      }
    }
  }

  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadVerts, 3));
  roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUvs, 2));
  roadGeo.setIndex(roadIndices);
  roadGeo.computeVertexNormals();
  geometries.push(roadGeo);

  const roadMesh = new THREE.Mesh(roadGeo, materials.arenaGround);
  roadMesh.receiveShadow = true;
  group.add(roadMesh);

  // Upper horizontal quarry bench road (z ~ -56, y ~ 14.2) for upper dump trucks
  const upperBenchGeo = new THREE.BoxGeometry(92, 6, 7.5);
  geometries.push(upperBenchGeo);
  const upperBench = new THREE.Mesh(upperBenchGeo, materials.boulderStone);
  upperBench.position.set(-4, 11.2, -56);
  upperBench.receiveShadow = true;
  group.add(upperBench);

  // ---------------------------------------------------------------------------
  // 4. INSTANCED BOULDERS, FOREGROUND ROCK FRAMING & SCATTERED RUBBLE
  // ---------------------------------------------------------------------------
  const boulderGeo = new THREE.DodecahedronGeometry(1.0, 1);
  // Roughen boulder vertices for angular blasted-quarry granite silhouettes
  const bPos = boulderGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < bPos.count; i++) {
    const x = bPos.getX(i);
    const y = bPos.getY(i);
    const z = bPos.getZ(i);
    const n = 0.78 + 0.38 * Math.abs(Math.sin(x * 3.7 + y * 2.3 - z * 4.1));
    bPos.setXYZ(i, x * n, y * n * 0.78, z * n);
  }
  boulderGeo.computeVertexNormals();
  geometries.push(boulderGeo);

  const rockTransforms: Array<{
    x: number;
    y: number;
    z: number;
    sx: number;
    sy: number;
    sz: number;
    ry: number;
    rx: number;
    tint: number;
  }> = [];

  // Foreground dramatic framing rocks right along z = 7.8..10.5 (signature Panel A framing!)
  const fgRocks = [
    { x: -16.8, z: 8.3, s: 1.55 },
    { x: -14.2, z: 9.0, s: 1.05 },
    { x: -11.4, z: 8.6, s: 1.25 },
    { x: -7.8, z: 9.1, s: 0.72 },
    { x: -5.2, z: 8.9, s: 0.55 },
    { x: 4.8, z: 8.8, s: 0.65 },
    { x: 8.6, z: 9.0, s: 0.95 },
    { x: 11.8, z: 8.6, s: 1.15 },
    { x: 15.2, z: 8.4, s: 1.65 },
    { x: 17.5, z: 7.8, s: 1.9 },
  ];
  for (let i = 0; i < fgRocks.length; i++) {
    const r = fgRocks[i];
    rockTransforms.push({
      x: r.x,
      y: r.s * 0.28,
      z: r.z,
      sx: r.s * (1.1 + (i % 3) * 0.15),
      sy: r.s * 0.72,
      sz: r.s * 0.95,
      ry: i * 1.1,
      rx: 0.15 * (i % 2),
      tint: 0.72 + (i % 4) * 0.08,
    });
  }

  // Scattered rocks along back fence, watchtower base, shed flanks & quarry terraces
  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let i = 0; i < 115; i++) {
    let rx: number;
    let rz: number;
    let scale: number;
    if (i < 35) {
      // Back fence & side perimeter rocks
      rx = (rand() - 0.5) * 40;
      rz = -7.8 - rand() * 5.2;
      scale = 0.35 + rand() * 0.95;
    } else if (i < 60) {
      // Arena edge small rubble pebbles
      rx = (rand() - 0.5) * 34;
      rz = rand() > 0.5 ? 6.8 + rand() * 2.5 : -6.2 - rand() * 1.8;
      scale = 0.18 + rand() * 0.42;
    } else {
      // Distant cliff talus & quarry rock outcrops
      rx = (rand() - 0.5) * 95;
      rz = -16 - rand() * 52;
      scale = 1.2 + rand() * 3.1;
    }

    const gy = groundHeightAt(rx, rz);
    rockTransforms.push({
      x: rx,
      y: gy + scale * 0.25,
      z: rz,
      sx: scale * (0.85 + rand() * 0.45),
      sy: scale * (0.55 + rand() * 0.45),
      sz: scale * (0.85 + rand() * 0.45),
      ry: rand() * Math.PI * 2,
      rx: (rand() - 0.5) * 0.4,
      tint: 0.65 + rand() * 0.42,
    });
  }

  const boulderInstances = new THREE.InstancedMesh(
    boulderGeo,
    materials.boulderStone,
    rockTransforms.length,
  );
  boulderInstances.castShadow = true;
  boulderInstances.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const instCol = new THREE.Color();
  for (let i = 0; i < rockTransforms.length; i++) {
    const r = rockTransforms[i];
    dummy.position.set(r.x, r.y, r.z);
    dummy.rotation.set(r.rx, r.ry, 0);
    dummy.scale.set(r.sx, r.sy, r.sz);
    dummy.updateMatrix();
    boulderInstances.setMatrixAt(i, dummy.matrix);
    instCol.setRGB(r.tint, r.tint * 0.94, r.tint * 0.86);
    boulderInstances.setColorAt(i, instCol);
  }
  boulderInstances.instanceMatrix.needsUpdate = true;
  if (boulderInstances.instanceColor) boulderInstances.instanceColor.needsUpdate = true;
  boulderInstances.computeBoundingSphere();
  group.add(boulderInstances);

  return {
    group,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
    },
  };
}
