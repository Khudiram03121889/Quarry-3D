import * as THREE from 'three';
import type { QuarryMaterialLibrary } from './materials';
import {
  getQuarryHaulRoads,
  queryRoadCorridorClearance,
  sampleKutchaRoadFrame,
  type KutchaRoadSpec,
} from './haulRoads';

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
  const extraMaterials: THREE.Material[] = [];

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
      let h = groundHeightAt(vx, wz);

      // Carve & depress cliff mesh beneath both two-lane kutcha haul roads so rock never pokes through
      const clearance = queryRoadCorridorClearance(vx, wz, 6.2);
      if (clearance.blend > 0) {
        h = THREE.MathUtils.lerp(h, clearance.roadY - 0.85, clearance.blend);
      }
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
  // 3. WIDE TWO-LANE KUTCHA (UNPAVED DIRT & GRAVEL) QUARRY HAUL ROADS + SAFETY BERMS
  //    Shared exact spline curves with vehicles.ts so opposing dump trucks pass
  //    side-by-side cleanly on dedicated tire-rutted lanes with zero glitches!
  // ---------------------------------------------------------------------------
  const haulRoads = getQuarryHaulRoads();

  const postMat = new THREE.MeshStandardMaterial({
    color: 0xd9d2c5,
    roughness: 0.72,
    metalness: 0.15,
  });
  const postStripeMat = new THREE.MeshStandardMaterial({
    color: 0xc22b1e,
    emissive: 0x3a0c08,
    emissiveIntensity: 0.45,
    roughness: 0.52,
    metalness: 0.1,
  });
  extraMaterials.push(postMat, postStripeMat);

  const bollardTransforms: Array<{ x: number; y: number; z: number; ry: number }> = [];
  const bermRockTransforms: Array<{
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

  const tmpPos = new THREE.Vector3();
  const tmpTan = new THREE.Vector3();
  const tmpRight = new THREE.Vector3();

  // Helper builds a swept ribbon mesh from cross-section profile points (lat, dy, u) with +Y normals
  const buildRibbonMesh = (
    spec: KutchaRoadSpec,
    profile: Array<{ lat: number; dy: number; u: number }>,
    material: THREE.Material,
    vRepeatScale: number,
  ) => {
    const segs = spec.segments;
    const cols = profile.length;
    const arcLen = spec.curve.getLength();
    const verts: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      sampleKutchaRoadFrame(spec.curve, t, 0, tmpPos, tmpTan, tmpRight);
      const vCoord = t * (arcLen / vRepeatScale);

      for (let c = 0; c < cols; c++) {
        const p = profile[c];
        const px = tmpPos.x + tmpRight.x * p.lat;
        const py = tmpPos.y + p.dy;
        const pz = tmpPos.z + tmpRight.z * p.lat;
        verts.push(px, py, pz);
        uvs.push(p.u, vCoord);
      }

      if (i < segs) {
        const base = i * cols;
        const next = (i + 1) * cols;
        // Winding order: (base+q, base+q+1, next+q) -> (+right) x (+tan) = +Y (upward normals!)
        for (let q = 0; q < cols - 1; q++) {
          indices.push(base + q, base + q + 1, next + q);
          indices.push(base + q + 1, next + q + 1, next + q);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    geometries.push(geo);

    const mesh = new THREE.Mesh(geo, material);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    group.add(mesh);
  };

  for (const spec of haulRoads.all) {
    const halfW = spec.width * 0.5; // 4.70m

    // 3A. Two-lane kutcha dirt & gravel carriageway with subtle dusty center crown + compacted wheel tracks
    const carriagewayProfile = [
      { lat: -halfW, dy: -0.02, u: 0.0 },
      { lat: -3.25, dy: -0.025, u: 0.155 },
      { lat: -1.45, dy: -0.025, u: 0.345 },
      { lat: 0.0, dy: 0.065, u: 0.5 }, // Dusty unpaved gravel center crown dividing opposing lanes
      { lat: 1.45, dy: -0.025, u: 0.655 },
      { lat: 3.25, dy: -0.025, u: 0.845 },
      { lat: halfW, dy: -0.02, u: 1.0 },
    ];
    buildRibbonMesh(spec, carriagewayProfile, materials.kutchaRoad, 9.2);

    // 3B. Inner hillside cut-verge & drainage bank (-Z side)
    const innerEmbankmentProfile = [
      { lat: -halfW - 5.2, dy: -5.8, u: 0.0 },
      { lat: -halfW - 1.1, dy: 0.38, u: 0.65 },
      { lat: -halfW + 0.04, dy: -0.02, u: 1.0 },
    ];
    buildRibbonMesh(spec, innerEmbankmentProfile, materials.roadBerm, 8.0);

    // 3C. Outer quarry drop-off raised dirt/stone safety berm (bund) & deep retaining embankment (+Z side)
    const outerEmbankmentProfile = [
      { lat: halfW - 0.04, dy: -0.02, u: 0.0 },
      { lat: halfW + 0.52, dy: 0.56, u: 0.18 }, // Raised compacted-earth quarry safety bund inner crest
      { lat: halfW + 1.2, dy: 0.50, u: 0.34 }, // Safety bund outer crest
      { lat: halfW + 3.2, dy: -2.4, u: 0.65 }, // Steep rocky retaining slope
      { lat: halfW + 7.8, dy: -9.8, u: 1.0 }, // Deeply grounded into quarry pit floor
    ];
    buildRibbonMesh(spec, outerEmbankmentProfile, materials.roadBerm, 8.0);

    // 3D. Quarry edge reflective guide bollards & safety bund boulders along outer drop-off crest
    const bollardCount = spec.id === 'lower' ? 16 : 12;
    for (let b = 1; b < bollardCount; b++) {
      const u = b / bollardCount;
      sampleKutchaRoadFrame(spec.curve, u, halfW + 0.86, tmpPos, tmpTan);
      bollardTransforms.push({
        x: tmpPos.x,
        y: tmpPos.y + 0.44,
        z: tmpPos.z,
        ry: Math.atan2(tmpTan.x, tmpTan.z),
      });

      // Pair rough quarry safety stones embedded into the dirt berm between bollards
      const rockU = Math.min(0.96, u + 0.5 / bollardCount);
      sampleKutchaRoadFrame(spec.curve, rockU, halfW + 0.82, tmpPos, tmpTan);
      const rScale = 0.42 + ((b * 37) % 10) * 0.032;
      bermRockTransforms.push({
        x: tmpPos.x,
        y: tmpPos.y + 0.48,
        z: tmpPos.z,
        sx: rScale * 1.35,
        sy: rScale * 0.72,
        sz: rScale * 1.1,
        ry: b * 1.7,
        rx: 0.12,
        tint: 0.76 + (b % 3) * 0.08,
      });
    }
  }

  // Instanced weathered red/white quarry road edge guide posts
  const bollardPostGeo = new THREE.CylinderGeometry(0.085, 0.1, 1.05, 8);
  const bollardBandGeo = new THREE.CylinderGeometry(0.095, 0.095, 0.28, 8);
  geometries.push(bollardPostGeo, bollardBandGeo);

  const bollardPosts = new THREE.InstancedMesh(bollardPostGeo, postMat, bollardTransforms.length);
  const bollardBands = new THREE.InstancedMesh(bollardBandGeo, postStripeMat, bollardTransforms.length);
  bollardPosts.castShadow = true;
  bollardPosts.receiveShadow = true;
  const bDummy = new THREE.Object3D();
  for (let i = 0; i < bollardTransforms.length; i++) {
    const bt = bollardTransforms[i];
    bDummy.position.set(bt.x, bt.y + 0.42, bt.z);
    bDummy.rotation.set(0, bt.ry, 0);
    bDummy.scale.set(1, 1, 1);
    bDummy.updateMatrix();
    bollardPosts.setMatrixAt(i, bDummy.matrix);

    bDummy.position.set(bt.x, bt.y + 0.72, bt.z);
    bDummy.updateMatrix();
    bollardBands.setMatrixAt(i, bDummy.matrix);
  }
  bollardPosts.instanceMatrix.needsUpdate = true;
  bollardBands.instanceMatrix.needsUpdate = true;
  bollardPosts.computeBoundingSphere();
  bollardBands.computeBoundingSphere();
  group.add(bollardPosts, bollardBands);

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

  // Include safety bund boulders along the outer kutcha road berms
  for (const br of bermRockTransforms) {
    rockTransforms.push(br);
  }

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

    // Keep both kutcha haul roads and their berms 100% clear of random scattered rocks
    if (queryRoadCorridorClearance(rx, rz, 6.8).inside) {
      continue;
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
      extraMaterials.forEach((m) => m.dispose());
    },
  };
}
