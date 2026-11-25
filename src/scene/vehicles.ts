import * as THREE from 'three';
import type { QuarryMaterialLibrary } from './materials';
import { groundHeightAt } from './terrainAndCliffs';
import { getQuarryHaulRoads, sampleKutchaRoadFrame } from './haulRoads';

export interface QuarryVehiclesResult {
  group: THREE.Group;
  update: (elapsed: number, delta: number, speedMultiplier: number, sunElevation: number) => void;
  dispose: () => void;
}

interface MovingTruck {
  root: THREE.Group;
  wheels: THREE.Mesh[];
  roadId: 'lower' | 'upper';
  curve: THREE.CatmullRomCurve3;
  laneOffset: number;
  progress: number;
  speed: number; // curve u per second
  direction: 1 | -1;
  bouncePhase: number;
  dustTimer: number;
  headlights: THREE.Mesh[];
}

interface DustPuff {
  sprite: THREE.Sprite;
  active: boolean;
  age: number;
  life: number;
  vel: THREE.Vector3;
}

// Module-scope scratch helpers (zero GC in render loop)
const _pos = new THREE.Vector3();
const _nextPos = new THREE.Vector3();
const _tan = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _rearWorld = new THREE.Vector3();

export function createQuarryVehicles(
  materials: QuarryMaterialLibrary,
  smokeSprite: THREE.Texture,
): QuarryVehiclesResult {
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const extraMaterials: THREE.Material[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    extraMaterials.push(m);
    return m;
  };

  // Shared geometries for heavy mining dump trucks (composite 10+ parts each)
  const chassisGeo = trackGeo(new THREE.BoxGeometry(2.3, 0.72, 4.9));
  const frontHoodGeo = trackGeo(new THREE.BoxGeometry(2.35, 1.15, 1.55));
  const grilleGeo = trackGeo(new THREE.BoxGeometry(1.75, 0.85, 0.14));
  const bumperGeo = trackGeo(new THREE.BoxGeometry(2.55, 0.42, 0.36));
  const cabGeo = trackGeo(new THREE.BoxGeometry(1.25, 1.05, 1.35));
  const windshieldGeo = trackGeo(new THREE.BoxGeometry(1.12, 0.62, 0.08));
  const bedBaseGeo = trackGeo(new THREE.BoxGeometry(2.75, 1.48, 3.65));
  const bedCanopyGeo = trackGeo(new THREE.BoxGeometry(2.85, 0.24, 1.65));
  const bedRibGeo = trackGeo(new THREE.BoxGeometry(0.16, 1.42, 0.22));
  const oreLoadGeo = trackGeo(new THREE.DodecahedronGeometry(1.15, 1));
  const tireGeo = trackGeo(new THREE.CylinderGeometry(0.84, 0.84, 0.56, 16));
  tireGeo.rotateZ(Math.PI / 2);
  const hubGeo = trackGeo(new THREE.CylinderGeometry(0.42, 0.42, 0.6, 10));
  hubGeo.rotateZ(Math.PI / 2);
  const exhaustGeo = trackGeo(new THREE.CylinderGeometry(0.08, 0.09, 1.5, 8));
  const headlightGeo = trackGeo(new THREE.BoxGeometry(0.32, 0.2, 0.08));
  const taillightGeo = trackGeo(new THREE.BoxGeometry(0.28, 0.16, 0.08));
  const beaconGeo = trackGeo(new THREE.CylinderGeometry(0.1, 0.12, 0.2, 8));

  const headlightMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfff8dc,
      emissive: 0xffd27d,
      emissiveIntensity: 2.2,
      roughness: 0.15,
    }),
  );

  const taillightMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xb81f1a,
      emissive: 0xff2c1a,
      emissiveIntensity: 1.6,
      roughness: 0.25,
    }),
  );

  const buildMiningDumpTruck = (
    scale = 1.0,
  ): { root: THREE.Group; wheels: THREE.Mesh[]; headlights: THREE.Mesh[] } => {
    const truck = new THREE.Group();
    truck.scale.setScalar(scale);

    const addPart = (
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
      x: number,
      y: number,
      z: number,
      rx = 0,
      ry = 0,
      rz = 0,
      cast = true,
    ) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, rz);
      m.castShadow = cast;
      m.receiveShadow = true;
      truck.add(m);
      return m;
    };

    // Primary chassis + front engine deck (+Z is forward)
    addPart(chassisGeo, materials.darkSteel, 0, 1.05, 0);
    addPart(frontHoodGeo, materials.yellowMachinery, 0, 1.72, 1.68);
    addPart(grilleGeo, materials.darkSteel, 0, 1.65, 2.48);
    addPart(bumperGeo, materials.darkSteel, 0, 1.02, 2.58);

    // Offset heavy operator cab (left side of deck) + glass windshield + roof amber beacon
    addPart(cabGeo, materials.yellowMachinery, -0.52, 2.65, 1.48);
    addPart(windshieldGeo, materials.cabGlass, -0.52, 2.7, 2.16, -0.1, 0, 0, false);
    addPart(beaconGeo, materials.emissiveBeacon, -0.52, 3.26, 1.45, 0, 0, 0, false);

    // Massive sloped armored yellow dump bed + canopy overhang protecting cab + structural side ribs
    addPart(bedBaseGeo, materials.yellowMachinery, 0, 2.24, -0.68, -0.06, 0, 0);
    addPart(bedCanopyGeo, materials.yellowMachinery, 0, 3.16, 1.25, 0.08, 0, 0);
    for (const rz of [-2.0, -1.1, -0.2, 0.7]) {
      addPart(bedRibGeo, materials.rustSteel, 1.4, 2.22, rz, 0, 0, 0, false);
      addPart(bedRibGeo, materials.rustSteel, -1.4, 2.22, rz, 0, 0, 0, false);
    }

    // Heaped quarry ore / crushed granite inside dump bed
    const ore = addPart(oreLoadGeo, materials.boulderStone, 0, 2.86, -0.75, 0.2, 0.6, 0, false);
    ore.scale.set(1.08, 0.56, 1.45);

    // Dual vertical steel exhaust stacks
    addPart(exhaustGeo, materials.darkSteel, 0.95, 2.65, 1.25, 0, 0, 0, false);
    addPart(exhaustGeo, materials.darkSteel, 0.72, 2.65, 1.25, 0, 0, 0, false);

    // Glowing headlights on front bumper + red brake/taillights on rear chassis
    const hl1 = addPart(headlightGeo, headlightMat, -0.88, 1.25, 2.55, 0, 0, 0, false);
    const hl2 = addPart(headlightGeo, headlightMat, 0.88, 1.25, 2.55, 0, 0, 0, false);
    addPart(taillightGeo, taillightMat, -0.92, 1.12, -2.48, 0, 0, 0, false);
    addPart(taillightGeo, taillightMat, 0.92, 1.12, -2.48, 0, 0, 0, false);

    // 4 oversized mining wheels (front pair + dual-width rear drive tires) with yellow hubs
    const wheels: THREE.Mesh[] = [];
    const wheelCoords: Array<[number, number, number, number]> = [
      [-1.28, 0.84, 1.58, 1.0],
      [1.28, 0.84, 1.58, 1.0],
      [-1.32, 0.84, -1.35, 1.22],
      [1.32, 0.84, -1.35, 1.22],
    ];
    for (const [wx, wy, wz, widthScale] of wheelCoords) {
      const wMesh = new THREE.Mesh(tireGeo, materials.rubberTire);
      wMesh.position.set(wx, wy, wz);
      wMesh.scale.set(widthScale, 1, 1);
      wMesh.castShadow = true;
      const hub = new THREE.Mesh(hubGeo, materials.yellowMachinery);
      wMesh.add(hub);
      truck.add(wMesh);
      wheels.push(wMesh);
    }

    return { root: truck, wheels, headlights: [hl1, hl2] };
  };

  // ===========================================================================
  // TWO-LANE KUTCHA HAUL ROAD NETWORK (Side-by-side collision-free traffic!)
  // ===========================================================================
  const haulRoads = getQuarryHaulRoads();
  const trucks: MovingTruck[] = [];

  const spawnTruck = (
    roadId: 'lower' | 'upper',
    startProgress: number,
    speed: number,
    direction: 1 | -1,
    scale: number,
  ) => {
    const spec = roadId === 'lower' ? haulRoads.lower : haulRoads.upper;
    // Left-hand / dedicated opposing lane assignment:
    // direction +1 uses inner lane (-laneOffset), direction -1 uses outer lane (+laneOffset)
    // Center-to-center lane separation is 4.70m vs ~3.35m truck width -> ~1.35m clear passing gap!
    const laneOffset = direction === 1 ? -spec.laneOffset : spec.laneOffset;
    const built = buildMiningDumpTruck(scale);
    group.add(built.root);
    trucks.push({
      root: built.root,
      wheels: built.wheels,
      headlights: built.headlights,
      roadId,
      curve: spec.curve,
      laneOffset,
      progress: startProgress,
      speed,
      direction,
      bouncePhase: startProgress * 23.7 + (direction === 1 ? 0 : 3.1),
      dustTimer: Math.random() * 0.25,
    });
  };

  // Lower two-lane kutcha haul road: 2 trucks ascending (+1 inner lane), 2 descending (-1 outer lane)
  // Matched lane speeds + headway guard prevent overtaking; opposing lanes pass cleanly side-by-side!
  spawnTruck('lower', 0.18, 0.024, 1, 1.0);
  spawnTruck('lower', 0.66, 0.024, 1, 0.98);
  spawnTruck('lower', 0.36, 0.024, -1, 1.0);
  spawnTruck('lower', 0.84, 0.024, -1, 1.02);

  // Upper cliff-terrace two-lane kutcha haul road: 2 eastbound (+1), 2 westbound (-1)
  spawnTruck('upper', 0.20, 0.026, 1, 1.04);
  spawnTruck('upper', 0.70, 0.026, 1, 1.02);
  spawnTruck('upper', 0.44, 0.026, -1, 1.04);
  spawnTruck('upper', 0.92, 0.026, -1, 1.02);

  // ===========================================================================
  // POOLED DUST TRAILS KICKED UP BEHIND MOVING DUMP TRUCKS ON KUTCHA ROAD
  // ===========================================================================
  const dustPool: DustPuff[] = [];
  for (let i = 0; i < 56; i++) {
    const mat = trackMat(
      new THREE.SpriteMaterial({
        map: smokeSprite,
        color: 0xc29e74,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    const sp = new THREE.Sprite(mat);
    sp.visible = false;
    group.add(sp);
    dustPool.push({
      sprite: sp,
      active: false,
      age: 0,
      life: 1.8,
      vel: new THREE.Vector3(),
    });
  }
  let dustPoolCursor = 0;

  const spawnTruckDust = (pos: THREE.Vector3, sunElevation: number) => {
    const p = dustPool[dustPoolCursor];
    dustPoolCursor = (dustPoolCursor + 1) % dustPool.length;
    p.active = true;
    p.age = 0;
    p.life = 1.65 + Math.random() * 0.75;
    p.sprite.visible = true;
    p.sprite.position.set(
      pos.x + (Math.random() - 0.5) * 1.2,
      pos.y + 0.65,
      pos.z + (Math.random() - 0.5) * 1.2,
    );
    p.sprite.scale.set(1.5, 1.25, 1);
    p.vel.set(
      (Math.random() - 0.5) * 0.65,
      0.6 + Math.random() * 0.45,
      (Math.random() - 0.5) * 0.65,
    );
    const mat = p.sprite.material as THREE.SpriteMaterial;
    mat.color.setHex(sunElevation < 0.14 ? 0x4b4a52 : sunElevation < 0.45 ? 0xc29568 : 0xd2bd9d);
  };

  // ===========================================================================
  // COMPOSITE ARTICULATED MINING EXCAVATOR (Key Assets Reference!)
  // Perched cleanly on a mid-left quarry bench between lower & upper kutcha roads
  // (x = -21, z = -38.5 — 100% clear of all moving haul trucks & road berms)
  // ===========================================================================
  const excavatorBase = new THREE.Group();
  const exX = -21.0;
  const exZ = -38.5;
  const exY = groundHeightAt(exX, exZ);
  excavatorBase.position.set(exX, Math.max(2.6, exY), exZ);
  excavatorBase.rotation.y = 0.72;
  group.add(excavatorBase);

  // Tracked undercarriage
  const caterpillarTrackGeo = trackGeo(new THREE.BoxGeometry(0.75, 0.82, 4.2));
  const leftTrack = new THREE.Mesh(caterpillarTrackGeo, materials.rubberTire);
  leftTrack.position.set(-1.15, 0.41, 0);
  leftTrack.castShadow = true;
  excavatorBase.add(leftTrack);

  const rightTrack = new THREE.Mesh(caterpillarTrackGeo, materials.rubberTire);
  rightTrack.position.set(1.15, 0.41, 0);
  rightTrack.castShadow = true;
  excavatorBase.add(rightTrack);

  const axleGeo = trackGeo(new THREE.BoxGeometry(2.2, 0.55, 2.4));
  const axle = new THREE.Mesh(axleGeo, materials.darkSteel);
  axle.position.set(0, 0.55, 0);
  excavatorBase.add(axle);

  // Slewing upper house
  const excHouse = new THREE.Group();
  excHouse.position.set(0, 0.95, 0);
  excavatorBase.add(excHouse);

  const bodyGeo = trackGeo(new THREE.BoxGeometry(2.5, 1.35, 3.1));
  const excBody = new THREE.Mesh(bodyGeo, materials.yellowMachinery);
  excBody.position.set(0, 0.68, -0.35);
  excBody.castShadow = true;
  excHouse.add(excBody);

  const counterGeo = trackGeo(new THREE.BoxGeometry(2.6, 1.1, 0.95));
  const counter = new THREE.Mesh(counterGeo, materials.darkSteel);
  counter.position.set(0, 0.65, -2.15);
  excHouse.add(counter);

  // Excavator operator glass cab
  const excCabGeo = trackGeo(new THREE.BoxGeometry(1.1, 1.45, 1.65));
  const excCab = new THREE.Mesh(excCabGeo, materials.cabGlass);
  excCab.position.set(-0.78, 1.35, 0.52);
  excHouse.add(excCab);

  // Articulated hydraulic boom
  const excBoomPivot = new THREE.Group();
  excBoomPivot.position.set(0.35, 0.95, 0.85);
  excHouse.add(excBoomPivot);

  const boomGeo = trackGeo(new THREE.BoxGeometry(0.45, 0.58, 4.6));
  const boomMesh = new THREE.Mesh(boomGeo, materials.yellowMachinery);
  boomMesh.position.set(0, 1.55, 1.65);
  boomMesh.rotation.x = -0.74;
  boomMesh.castShadow = true;
  excBoomPivot.add(boomMesh);

  // Hydraulic cylinder piston
  const pistonGeo = trackGeo(new THREE.CylinderGeometry(0.09, 0.12, 2.2, 8));
  const piston = new THREE.Mesh(pistonGeo, materials.darkSteel);
  piston.position.set(0, 0.85, 1.2);
  piston.rotation.x = 0.68;
  excBoomPivot.add(piston);

  // Dipper stick + digging bucket
  const excStickPivot = new THREE.Group();
  excStickPivot.position.set(0, 3.05, 3.35);
  excBoomPivot.add(excStickPivot);

  const stickGeo = trackGeo(new THREE.BoxGeometry(0.36, 3.2, 0.42));
  const stickMesh = new THREE.Mesh(stickGeo, materials.yellowMachinery);
  stickMesh.position.set(0, -1.4, 0.35);
  stickMesh.rotation.x = -0.22;
  excStickPivot.add(stickMesh);

  const bucketPivot = new THREE.Group();
  bucketPivot.position.set(0, -2.9, 0.65);
  excStickPivot.add(bucketPivot);

  const bucketGeo = trackGeo(new THREE.BoxGeometry(1.15, 0.95, 1.05));
  const bucket = new THREE.Mesh(bucketGeo, materials.darkSteel);
  bucket.position.set(0, -0.32, 0.22);
  bucketPivot.add(bucket);

  // ===========================================================================
  // PER-FRAME VEHICLE KINEMATICS (Side-by-side lanes + Same-lane headway guard)
  // ===========================================================================
  const MIN_SAME_LANE_HEADWAY = 0.22; // ~28-32m safe convoy separation on 140m kutcha roads
  const HARD_STOP_HEADWAY = 0.14;

  const update = (
    elapsed: number,
    delta: number,
    speedMultiplier: number,
    sunElevation: number,
  ) => {
    headlightMat.emissiveIntensity = THREE.MathUtils.clamp(2.8 - sunElevation * 2.2, 0.4, 3.2);
    taillightMat.emissiveIntensity = THREE.MathUtils.clamp(2.0 - sunElevation * 1.2, 0.6, 2.2);

    // 1. Move mining dump trucks smoothly inside their dedicated kutcha road lanes
    for (let i = 0; i < trucks.length; i++) {
      const t = trucks[i];

      // Runtime same-lane convoy spacing guard: prevents any same-lane truck from catching up
      let headwayFactor = 1.0;
      for (let j = 0; j < trucks.length; j++) {
        if (i === j) continue;
        const other = trucks[j];
        if (other.roadId !== t.roadId || other.direction !== t.direction) continue;

        const forwardGap =
          t.direction === 1
            ? (other.progress - t.progress + 1) % 1
            : (t.progress - other.progress + 1) % 1;

        if (forwardGap > 0 && forwardGap < MIN_SAME_LANE_HEADWAY) {
          const factor = THREE.MathUtils.clamp(
            (forwardGap - HARD_STOP_HEADWAY) / (MIN_SAME_LANE_HEADWAY - HARD_STOP_HEADWAY),
            0,
            1,
          );
          if (factor < headwayFactor) headwayFactor = factor;
        }
      }

      const deltaU = t.speed * headwayFactor * speedMultiplier * delta;
      t.progress += deltaU * t.direction;

      // Wrap seamlessly beyond cliff edges so trucks enter/exit naturally off-screen
      if (t.progress >= 0.992) {
        t.progress = 0.008;
      } else if (t.progress <= 0.008) {
        t.progress = 0.992;
      }

      // Sample exact wheel-rut lane position & smooth forward look target along the same lane
      sampleKutchaRoadFrame(t.curve, t.progress, t.laneOffset, _pos, _tan);

      const lookStep = 0.012 * t.direction;
      const aheadU = t.progress + lookStep;
      if (aheadU >= 0 && aheadU <= 1) {
        sampleKutchaRoadFrame(t.curve, aheadU, t.laneOffset, _nextPos);
      } else {
        // Near endpoints, extrapolate cleanly along the road tangent so orientation never glitches
        _nextPos.copy(_pos).addScaledVector(_tan, 2.5 * t.direction);
      }

      // Subtle diesel suspension vibration over unpaved kutcha gravel ruts
      const suspensionJitter =
        speedMultiplier > 0.02
          ? Math.sin(elapsed * 13 + t.bouncePhase) * 0.022
          : Math.sin(elapsed * 20 + t.bouncePhase) * 0.006;

      // Wheels have radius 0.84 with center at local y = 0.84 -> local y = 0 sits flush on kutcha surface
      t.root.position.set(_pos.x, _pos.y + 0.01 + suspensionJitter, _pos.z);
      _lookTarget.copy(_nextPos);
      _lookTarget.y += 0.01 + suspensionJitter;
      t.root.lookAt(_lookTarget);

      // Spin massive mining tires proportional to truck movement
      const wheelSpin = deltaU * 145;
      for (let w = 0; w < t.wheels.length; w++) {
        t.wheels[w].rotation.x += wheelSpin;
      }

      // Emit trailing ochre kutcha dust clouds behind moving trucks
      if (speedMultiplier > 0.05 && headwayFactor > 0.25) {
        t.dustTimer += delta * speedMultiplier;
        if (t.dustTimer > 0.36) {
          t.dustTimer = 0;
          _rearWorld.set(0, 0.35, -2.55).applyMatrix4(t.root.matrixWorld);
          spawnTruckDust(_rearWorld, sunElevation);
        }
      }
    }

    // 2. Update truck dust plume sprites
    for (let i = 0; i < dustPool.length; i++) {
      const p = dustPool[i];
      if (!p.active) continue;
      p.age += delta;
      if (p.age >= p.life) {
        p.active = false;
        p.sprite.visible = false;
        continue;
      }
      const norm = p.age / p.life;
      p.sprite.position.addScaledVector(p.vel, delta);
      const sc = 1.45 + norm * 4.1;
      p.sprite.scale.set(sc, sc * 0.85, 1);
      (p.sprite.material as THREE.SpriteMaterial).opacity = Math.sin(norm * Math.PI) * 0.34;
    }

    // 3. Animate quarry mining excavator digging & slewing cycle
    const digSpeed = Math.max(0.25, speedMultiplier);
    const cycle = elapsed * 0.55 * digSpeed;
    excHouse.rotation.y = Math.sin(cycle * 0.7) * 0.52;
    excBoomPivot.rotation.x = Math.sin(cycle * 1.4) * 0.22;
    excStickPivot.rotation.x = 0.25 + Math.cos(cycle * 1.4) * 0.32;
    bucketPivot.rotation.x = 0.35 + Math.sin(cycle * 1.4 + 0.8) * 0.5;
  };

  const dispose = () => {
    geometries.forEach((g) => g.dispose());
    extraMaterials.forEach((m) => m.dispose());
  };

  return {
    group,
    update,
    dispose,
  };
}
