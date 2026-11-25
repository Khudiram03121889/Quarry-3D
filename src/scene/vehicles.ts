import * as THREE from 'three';
import type { QuarryMaterialLibrary } from './materials';
import { groundHeightAt } from './terrainAndCliffs';

export interface QuarryVehiclesResult {
  group: THREE.Group;
  update: (elapsed: number, delta: number, speedMultiplier: number, sunElevation: number) => void;
  dispose: () => void;
}

interface MovingTruck {
  root: THREE.Group;
  wheels: THREE.Mesh[];
  curve: THREE.CatmullRomCurve3;
  progress: number;
  speed: number; // curve t per second
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
  const beaconGeo = trackGeo(new THREE.CylinderGeometry(0.1, 0.12, 0.2, 8));

  const headlightMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfff8dc,
      emissive: 0xffd27d,
      emissiveIntensity: 2.2,
      roughness: 0.15,
    }),
  );

  const buildMiningDumpTruck = (scale = 1.0): { root: THREE.Group; wheels: THREE.Mesh[]; headlights: THREE.Mesh[] } => {
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

    // Glowing headlights on front bumper
    const hl1 = addPart(headlightGeo, headlightMat, -0.88, 1.25, 2.55, 0, 0, 0, false);
    const hl2 = addPart(headlightGeo, headlightMat, 0.88, 1.25, 2.55, 0, 0, 0, false);

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
  // HAUL ROAD PATHS FOR MOVING DUMP TRUCKS (Matching Panels A, C, D!)
  // ===========================================================================
  // Path 1: Lower winding switchback quarry ramp clearly visible center-back in Panel A & D
  const lowerRoadCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-25, 0.35, -18),
    new THREE.Vector3(-8, 1.85, -22),
    new THREE.Vector3(6, 4.25, -28),
    new THREE.Vector3(16, 6.25, -35),
    new THREE.Vector3(4, 8.65, -42),
    new THREE.Vector3(-14, 10.65, -46),
    new THREE.Vector3(-29, 12.25, -52),
  ]);

  // Path 2: Elevated horizontal upper quarry terrace beneath the cliffs (Panel A & C!)
  const upperTerraceCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-42, 14.3, -55.8),
    new THREE.Vector3(-18, 14.3, -55.5),
    new THREE.Vector3(4, 14.3, -55.8),
    new THREE.Vector3(24, 14.3, -56.2),
    new THREE.Vector3(38, 14.3, -56.0),
  ]);

  const trucks: MovingTruck[] = [];

  const spawnTruck = (
    curve: THREE.CatmullRomCurve3,
    startProgress: number,
    speed: number,
    direction: 1 | -1,
    scale: number,
  ) => {
    const built = buildMiningDumpTruck(scale);
    group.add(built.root);
    trucks.push({
      root: built.root,
      wheels: built.wheels,
      headlights: built.headlights,
      curve,
      progress: startProgress,
      speed,
      direction,
      bouncePhase: startProgress * 20,
      dustTimer: 0,
    });
  };

  // 3 haul trucks continuously hauling ore along the winding switchback road
  spawnTruck(lowerRoadCurve, 0.16, 0.036, 1, 1.05);
  spawnTruck(lowerRoadCurve, 0.52, 0.032, 1, 1.0);
  spawnTruck(lowerRoadCurve, 0.84, 0.034, -1, 1.0);

  // 2 haul trucks cruising along the high cliff terrace
  spawnTruck(upperTerraceCurve, 0.24, 0.042, 1, 1.12);
  spawnTruck(upperTerraceCurve, 0.68, 0.038, -1, 1.12);

  // ===========================================================================
  // POOLED DUST TRAILS KICKED UP BEHIND MOVING DUMP TRUCKS
  // ===========================================================================
  const dustPool: DustPuff[] = [];
  for (let i = 0; i < 42; i++) {
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
    p.life = 1.6 + Math.random() * 0.8;
    p.sprite.visible = true;
    p.sprite.position.set(
      pos.x + (Math.random() - 0.5) * 1.4,
      pos.y + 0.7,
      pos.z + (Math.random() - 0.5) * 1.4,
    );
    p.sprite.scale.set(1.4, 1.2, 1);
    p.vel.set((Math.random() - 0.5) * 0.7, 0.65 + Math.random() * 0.5, (Math.random() - 0.5) * 0.7);
    const mat = p.sprite.material as THREE.SpriteMaterial;
    mat.color.setHex(sunElevation < 0.14 ? 0x4b4a52 : sunElevation < 0.45 ? 0xc29568 : 0xd2bd9d);
  };

  // ===========================================================================
  // COMPOSITE ARTICULATED MINING EXCAVATOR (Key Assets Reference!)
  // Positioned working on a mid-left rocky ledge (x = -19.5, z = -23.5)
  // ===========================================================================
  const excavatorBase = new THREE.Group();
  const exY = groundHeightAt(-19.5, -23.5);
  excavatorBase.position.set(-19.5, Math.max(0.4, exY), -23.5);
  excavatorBase.rotation.y = 0.68;
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
  // PER-FRAME VEHICLE KINEMATICS
  // ===========================================================================
  const update = (
    elapsed: number,
    delta: number,
    speedMultiplier: number,
    sunElevation: number,
  ) => {
    headlightMat.emissiveIntensity = THREE.MathUtils.clamp(2.8 - sunElevation * 2.2, 0.4, 3.2);

    // 1. Move mining dump trucks smoothly along curved haul roads
    for (let i = 0; i < trucks.length; i++) {
      const t = trucks[i];
      const deltaT = t.speed * speedMultiplier * delta;
      t.progress += deltaT * t.direction;

      // Wrap seamlessly when reaching end of quarry road
      if (t.progress >= 0.995) {
        t.progress = 0.005;
      } else if (t.progress <= 0.005) {
        t.progress = 0.995;
      }

      const lookDelta = 0.015 * t.direction;
      const clampedNext = THREE.MathUtils.clamp(t.progress + lookDelta, 0, 1);

      t.curve.getPointAt(t.progress, _pos);
      t.curve.getPointAt(clampedNext, _nextPos);

      // Subtle diesel suspension vibration over quarry dirt
      const suspensionJitter =
        speedMultiplier > 0.02
          ? Math.sin(elapsed * 14 + t.bouncePhase) * 0.035
          : Math.sin(elapsed * 22 + t.bouncePhase) * 0.008;

      t.root.position.set(_pos.x, _pos.y + suspensionJitter, _pos.z);
      _lookTarget.copy(_nextPos);
      _lookTarget.y += suspensionJitter;
      t.root.lookAt(_lookTarget);

      // Spin massive mining tires proportional to truck movement
      const wheelSpin = deltaT * 110;
      for (let w = 0; w < t.wheels.length; w++) {
        t.wheels[w].rotation.x += wheelSpin;
      }

      // Emit trailing dust clouds behind moving trucks
      if (speedMultiplier > 0.05) {
        t.dustTimer += delta * speedMultiplier;
        if (t.dustTimer > 0.34) {
          t.dustTimer = 0;
          _rearWorld.set(0, 0.4, -2.5).applyMatrix4(t.root.matrixWorld);
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
      const sc = 1.4 + norm * 4.2;
      p.sprite.scale.set(sc, sc * 0.85, 1);
      (p.sprite.material as THREE.SpriteMaterial).opacity = Math.sin(norm * Math.PI) * 0.36;
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
