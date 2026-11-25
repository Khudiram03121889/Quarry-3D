import * as THREE from 'three';
import type { QuarryMaterialLibrary } from './materials';
import type { HazardKind, HazardTelemetry } from './types';
import type { QuarryAudioEngine } from './audio';

export interface DestructibleHazard {
  id: string;
  label: string;
  kind: HazardKind;
  position: THREE.Vector3;
  intactGroup: THREE.Group;
  hitProxy: THREE.Mesh;
  destroyed: boolean;
  chainRadius: number;
  highlightMats: THREE.MeshStandardMaterial[];
}

interface DebrisPiece {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  angVel: THREE.Vector3;
  active: boolean;
  age: number;
  maxAge: number;
}

interface BlastParticle {
  sprite: THREE.Sprite;
  vel: THREE.Vector3;
  age: number;
  life: number;
  startScale: number;
  endScale: number;
  maxOpacity: number;
  active: boolean;
}

interface ShockwaveRing {
  mesh: THREE.Mesh;
  age: number;
  life: number;
  active: boolean;
}

export interface QuarryHazardsSystem {
  group: THREE.Group;
  hitProxies: THREE.Mesh[];
  setHoveredProxy: (proxy: THREE.Object3D | null) => void;
  strikeProxy: (proxy: THREE.Object3D) => boolean;
  triggerChainBlast: () => void;
  resetAll: () => void;
  getTelemetry: () => HazardTelemetry;
  getGeneratorFlicker: () => number;
  update: (delta: number) => void;
  dispose: () => void;
}

const _tmpVec = new THREE.Vector3();

export function createQuarryHazards(
  materials: QuarryMaterialLibrary,
  smokeSprite: THREE.Texture,
  audio: QuarryAudioEngine,
  onExplosionVisual: (pos: THREE.Vector3, shakeStrength: number, flashIntensity: number) => void,
  onTelemetryChange: (telemetry: HazardTelemetry) => void,
): QuarryHazardsSystem {
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

  const hazards: DestructibleHazard[] = [];
  const hitProxies: THREE.Mesh[] = [];
  const scorchDecals: THREE.Mesh[] = [];
  let hoveredHazard: DestructibleHazard | null = null;
  let lastEvent: string | null = null;
  let generatorFlickerTimer = 0;

  // Shared geometries for destructible combat hazards
  const barrelBodyGeo = trackGeo(new THREE.CylinderGeometry(0.38, 0.38, 1.12, 16));
  const barrelRimGeo = trackGeo(new THREE.TorusGeometry(0.39, 0.032, 8, 18));
  barrelRimGeo.rotateX(Math.PI / 2);
  const barrelCapGeo = trackGeo(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 8));

  const crateBoxGeo = trackGeo(new THREE.BoxGeometry(1.16, 1.16, 1.16));
  const crateFrameHGeo = trackGeo(new THREE.BoxGeometry(1.24, 0.14, 1.24));
  const crateFrameVGeo = trackGeo(new THREE.BoxGeometry(0.14, 1.16, 0.14));
  const crateDiagGeo = trackGeo(new THREE.BoxGeometry(1.42, 0.12, 0.08));

  const sandbagGeo = trackGeo(new THREE.SphereGeometry(0.42, 10, 8));
  sandbagGeo.scale(1.45, 0.56, 0.85);

  const rockShardGeo = trackGeo(new THREE.DodecahedronGeometry(0.62, 0));

  const proxyMat = trackMat(
    new THREE.MeshBasicMaterial({
      visible: false,
    }),
  );

  const shdGeo = trackGeo(new THREE.PlaneGeometry(1.6, 1.6));
  shdGeo.rotateX(-Math.PI / 2);

  // Helper to clone a material so each hazard can independently glow subtly on hover
  const cloneMat = (base: THREE.MeshStandardMaterial) => trackMat(base.clone());

  // ---------------------------------------------------------------------------
  // BUILDERS FOR EACH DESTRUCTIBLE HAZARD ARCHETYPE
  // ---------------------------------------------------------------------------
  const addOilBarrel = (id: string, x: number, z: number, rotY = 0) => {
    const root = new THREE.Group();
    root.position.set(x, 0, z);
    root.rotation.y = rotY;
    group.add(root);

    const bMat = cloneMat(materials.oilBarrel);
    const body = new THREE.Mesh(barrelBodyGeo, bMat);
    body.position.y = 0.56;
    body.castShadow = true;
    body.receiveShadow = true;
    root.add(body);

    for (const ry of [0.05, 0.36, 0.76, 1.1]) {
      const rim = new THREE.Mesh(barrelRimGeo, materials.barrelRim);
      rim.position.y = ry;
      root.add(rim);
    }
    const cap = new THREE.Mesh(barrelCapGeo, materials.barrelRim);
    cap.position.set(0.18, 1.14, 0);
    root.add(cap);

    const shd = new THREE.Mesh(shdGeo, materials.contactShadow);
    shd.position.y = 0.025;
    shd.scale.setScalar(0.95);
    root.add(shd);

    const proxy = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.05, 1.35, 1.05)), proxyMat);
    proxy.position.set(x, 0.68, z);
    proxy.layers.enable(1);
    group.add(proxy);

    const hz: DestructibleHazard = {
      id,
      label: 'Explosive Fuel Barrel',
      kind: 'oil_barrel',
      position: new THREE.Vector3(x, 0, z),
      intactGroup: root,
      hitProxy: proxy,
      destroyed: false,
      chainRadius: 4.3,
      highlightMats: [bMat],
    };
    proxy.userData.hazard = hz;
    hazards.push(hz);
    hitProxies.push(proxy);
  };

  const addWoodCrate = (id: string, x: number, z: number, rotY = 0, scale = 1.0) => {
    const root = new THREE.Group();
    root.position.set(x, 0, z);
    root.rotation.y = rotY;
    root.scale.setScalar(scale);
    group.add(root);

    const cMat = cloneMat(materials.crateWood);
    const fMat = cloneMat(materials.weatheredWood);

    const core = new THREE.Mesh(crateBoxGeo, cMat);
    core.position.y = 0.58;
    core.castShadow = true;
    core.receiveShadow = true;
    root.add(core);

    // Corner framing + diagonal braces for realistic heavy wooden cargo crate
    for (const fy of [0.07, 1.1]) {
      const hf = new THREE.Mesh(crateFrameHGeo, fMat);
      hf.position.y = fy;
      root.add(hf);
    }
    for (const cx of [-0.56, 0.56]) {
      for (const cz of [-0.56, 0.56]) {
        const vf = new THREE.Mesh(crateFrameVGeo, fMat);
        vf.position.set(cx, 0.58, cz);
        root.add(vf);
      }
    }
    const diagF = new THREE.Mesh(crateDiagGeo, fMat);
    diagF.position.set(0, 0.58, 0.59);
    diagF.rotation.z = Math.PI / 4;
    root.add(diagF);

    const shd = new THREE.Mesh(shdGeo, materials.contactShadow);
    shd.position.y = 0.025;
    shd.scale.setScalar(1.3);
    root.add(shd);

    const proxy = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(1.4 * scale, 1.35 * scale, 1.4 * scale)),
      proxyMat,
    );
    proxy.position.set(x, 0.65 * scale, z);
    proxy.layers.enable(1);
    group.add(proxy);

    const hz: DestructibleHazard = {
      id,
      label: 'Supply Crate',
      kind: 'wood_crate',
      position: new THREE.Vector3(x, 0, z),
      intactGroup: root,
      hitProxy: proxy,
      destroyed: false,
      chainRadius: 0,
      highlightMats: [cMat, fMat],
    };
    proxy.userData.hazard = hz;
    hazards.push(hz);
    hitProxies.push(proxy);
  };

  const addSandbagBarricade = (id: string, x: number, z: number, rotY = 0) => {
    const root = new THREE.Group();
    root.position.set(x, 0, z);
    root.rotation.y = rotY;
    group.add(root);

    const sMat = cloneMat(materials.sandbag);
    // 3-tier stacked sandbag cover wall (matching Panel A & C right-side cover!)
    const rows = [
      { y: 0.2, xs: [-0.95, 0, 0.95] },
      { y: 0.55, xs: [-0.52, 0.52] },
      { y: 0.9, xs: [0] },
    ];
    for (const row of rows) {
      for (const sx of row.xs) {
        const bag = new THREE.Mesh(sandbagGeo, sMat);
        bag.position.set(sx, row.y, (Math.abs(sx) > 0.1 ? 0.04 : -0.02));
        bag.rotation.y = (sx * 0.12);
        bag.castShadow = true;
        bag.receiveShadow = true;
        root.add(bag);
      }
    }

    const shd = new THREE.Mesh(shdGeo, materials.contactShadow);
    shd.position.y = 0.025;
    shd.scale.set(2.2, 1, 1.1);
    root.add(shd);

    const proxy = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.9, 1.3, 1.25)), proxyMat);
    proxy.position.set(x, 0.65, z);
    proxy.rotation.y = rotY;
    proxy.layers.enable(1);
    group.add(proxy);

    const hz: DestructibleHazard = {
      id,
      label: 'Sandbag Barricade',
      kind: 'sandbags',
      position: new THREE.Vector3(x, 0, z),
      intactGroup: root,
      hitProxy: proxy,
      destroyed: false,
      chainRadius: 0,
      highlightMats: [sMat],
    };
    proxy.userData.hazard = hz;
    hazards.push(hz);
    hitProxies.push(proxy);
  };

  const addRockPile = (id: string, x: number, z: number) => {
    const root = new THREE.Group();
    root.position.set(x, 0, z);
    group.add(root);

    const rMat = cloneMat(materials.boulderStone);
    const specs = [
      { x: 0, y: 0.45, z: 0, s: 1.25 },
      { x: -0.68, y: 0.34, z: 0.25, s: 0.85 },
      { x: 0.62, y: 0.32, z: -0.22, s: 0.8 },
      { x: 0.12, y: 0.92, z: -0.06, s: 0.68 },
    ];
    for (let i = 0; i < specs.length; i++) {
      const sp = specs[i];
      const rk = new THREE.Mesh(rockShardGeo, rMat);
      rk.position.set(sp.x, sp.y, sp.z);
      rk.scale.set(sp.s * 1.1, sp.s * 0.8, sp.s);
      rk.rotation.set(i * 0.9, i * 1.4, 0.3);
      rk.castShadow = true;
      rk.receiveShadow = true;
      root.add(rk);
    }

    const proxy = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.1, 1.4, 1.6)), proxyMat);
    proxy.position.set(x, 0.7, z);
    proxy.layers.enable(1);
    group.add(proxy);

    const hz: DestructibleHazard = {
      id,
      label: 'Fractured Quarry Boulders',
      kind: 'rock_pile',
      position: new THREE.Vector3(x, 0, z),
      intactGroup: root,
      hitProxy: proxy,
      destroyed: false,
      chainRadius: 0,
      highlightMats: [rMat],
    };
    proxy.userData.hazard = hz;
    hazards.push(hz);
    hitProxies.push(proxy);
  };

  const addPowerGenerator = (id: string, x: number, z: number) => {
    const root = new THREE.Group();
    root.position.set(x, 0, z);
    root.rotation.y = -0.35;
    group.add(root);

    const gBodyMat = cloneMat(materials.yellowMachinery);
    const gSteelMat = cloneMat(materials.darkSteel);

    const housing = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.45, 1.05, 0.95)), gBodyMat);
    housing.position.y = 0.62;
    housing.castShadow = true;
    root.add(housing);

    const frame = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.62, 0.16, 1.08)), gSteelMat);
    frame.position.y = 0.08;
    root.add(frame);

    const panel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.55, 0.52, 0.08)), gSteelMat);
    panel.position.set(-0.25, 0.68, 0.48);
    root.add(panel);

    const exhaust = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.06, 0.07, 0.65, 8)), gSteelMat);
    exhaust.position.set(0.52, 1.35, -0.2);
    root.add(exhaust);

    const proxy = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.8, 1.5, 1.3)), proxyMat);
    proxy.position.set(x, 0.75, z);
    proxy.layers.enable(1);
    group.add(proxy);

    const hz: DestructibleHazard = {
      id,
      label: 'Floodlight Generator (High Voltage)',
      kind: 'generator',
      position: new THREE.Vector3(x, 0, z),
      intactGroup: root,
      hitProxy: proxy,
      destroyed: false,
      chainRadius: 2.6,
      highlightMats: [gBodyMat, gSteelMat],
    };
    proxy.userData.hazard = hz;
    hazards.push(hz);
    hitProxies.push(proxy);
  };

  // ===========================================================================
  // PLACE ALL HAZARDS TO FAITHFULLY MATCH LAYER 4 IN PANELS A, B, C, D
  // ===========================================================================
  // Left watchtower flank: red oil barrels + wooden cargo crates
  addOilBarrel('barrel_left_1', -11.4, -2.1, 0.4);
  addOilBarrel('barrel_left_2', -10.5, -1.6, 1.2);
  addWoodCrate('crate_left_1', -11.6, 0.6, 0.18, 1.05);
  addWoodCrate('crate_left_2', -9.4, -4.6, -0.14, 0.95);

  // Back center arena edge: crates, explosive barrel cluster & unstable boulders
  addWoodCrate('crate_back_1', -6.8, -5.8, 0.08, 1.1);
  addOilBarrel('barrel_mid_1', -4.2, -5.6, 0.2);
  addOilBarrel('barrel_mid_2', -3.2, -5.9, 1.9);
  addRockPile('rock_mid_1', -0.6, -6.1);
  addWoodCrate('crate_back_2', 3.4, -5.9, -0.12, 1.0);
  addOilBarrel('barrel_mid_3', 5.2, -5.5, 0.8);

  // Right industrial shed & floodlight flank: sandbags, generator & oil drums (Panel A & C!)
  addPowerGenerator('gen_right', 9.2, -4.6);
  addSandbagBarricade('sandbags_right_1', 9.4, -1.6, -0.35);
  addSandbagBarricade('sandbags_right_2', 7.4, -5.5, 0.12);
  addOilBarrel('barrel_right_1', 11.4, 2.2, 0.5);
  addOilBarrel('barrel_right_2', 12.2, 3.0, 2.1);
  addOilBarrel('barrel_right_3', 11.1, 3.6, 1.4);
  addWoodCrate('crate_right_1', 11.8, -2.8, 0.22, 1.0);
  addRockPile('rock_left_fg', -8.4, 4.8);

  // ===========================================================================
  // PHYSICS DEBRIS, EXPLOSION PARTICLES & SHOCKWAVE RINGS (POOLED)
  // ===========================================================================
  const debrisPool: DebrisPiece[] = [];
  const plankGeo = trackGeo(new THREE.BoxGeometry(0.68, 0.09, 0.18));
  const shrapnelGeo = trackGeo(new THREE.BoxGeometry(0.32, 0.18, 0.28));
  const chunkGeo = trackGeo(new THREE.DodecahedronGeometry(0.24, 0));

  for (let i = 0; i < 90; i++) {
    const geo = i < 30 ? plankGeo : i < 60 ? shrapnelGeo : chunkGeo;
    const mat = i < 30 ? materials.crateWood : i < 60 ? materials.oilBarrel : materials.boulderStone;
    const m = new THREE.Mesh(geo, mat);
    m.visible = false;
    m.castShadow = true;
    group.add(m);
    debrisPool.push({
      mesh: m,
      vel: new THREE.Vector3(),
      angVel: new THREE.Vector3(),
      active: false,
      age: 0,
      maxAge: 6,
    });
  }

  const spawnDebrisBurst = (
    origin: THREE.Vector3,
    kind: HazardKind,
    count: number,
    power: number,
  ) => {
    const startIdx = kind === 'wood_crate' ? 0 : kind === 'oil_barrel' || kind === 'generator' ? 30 : 60;
    const matOverride =
      kind === 'sandbags'
        ? materials.sandbag
        : kind === 'rock_pile'
          ? materials.boulderStone
          : kind === 'wood_crate'
            ? materials.crateWood
            : materials.oilBarrel;

    let spawned = 0;
    for (let offset = 0; offset < 30 && spawned < count; offset++) {
      const idx = startIdx + ((offset + Math.floor(Math.random() * 30)) % 30);
      const d = debrisPool[idx];
      d.active = true;
      d.age = 0;
      d.maxAge = 5.5 + Math.random() * 2.5;
      d.mesh.material = matOverride;
      d.mesh.visible = true;
      d.mesh.position.set(
        origin.x + (Math.random() - 0.5) * 0.7,
        origin.y + 0.45 + Math.random() * 0.6,
        origin.z + (Math.random() - 0.5) * 0.7,
      );
      d.mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      const s = 0.65 + Math.random() * 0.75;
      d.mesh.scale.setScalar(s);

      const angle = Math.random() * Math.PI * 2;
      const horiz = (2.2 + Math.random() * 4.5) * power;
      d.vel.set(Math.cos(angle) * horiz, (4.2 + Math.random() * 5.2) * power, Math.sin(angle) * horiz);
      d.angVel.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
      spawned++;
    }
  };

  // Particle pool for fireballs, smoke plumes, sand bursts, and electric sparks
  const particlePool: BlastParticle[] = [];
  for (let i = 0; i < 84; i++) {
    const sMat = trackMat(
      new THREE.SpriteMaterial({
        map: smokeSprite,
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    const sp = new THREE.Sprite(sMat);
    sp.visible = false;
    group.add(sp);
    particlePool.push({
      sprite: sp,
      vel: new THREE.Vector3(),
      age: 0,
      life: 1,
      startScale: 1,
      endScale: 3,
      maxOpacity: 0.8,
      active: false,
    });
  }
  let particleCursor = 0;

  const spawnParticles = (
    origin: THREE.Vector3,
    count: number,
    colorHex: number,
    additive: boolean,
    speed: number,
    startScale: number,
    endScale: number,
    life: number,
  ) => {
    for (let i = 0; i < count; i++) {
      const p = particlePool[particleCursor];
      particleCursor = (particleCursor + 1) % particlePool.length;
      p.active = true;
      p.age = 0;
      p.life = life * (0.7 + Math.random() * 0.6);
      p.startScale = startScale * (0.8 + Math.random() * 0.4);
      p.endScale = endScale * (0.8 + Math.random() * 0.5);
      p.maxOpacity = additive ? 0.92 : 0.68;

      const mat = p.sprite.material as THREE.SpriteMaterial;
      mat.color.setHex(colorHex);
      mat.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
      mat.opacity = p.maxOpacity;

      p.sprite.visible = true;
      p.sprite.position.set(
        origin.x + (Math.random() - 0.5) * 0.9,
        origin.y + 0.5 + Math.random() * 0.8,
        origin.z + (Math.random() - 0.5) * 0.9,
      );
      p.sprite.scale.setScalar(p.startScale);

      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * speed;
      p.vel.set(Math.cos(a) * r, speed * (0.7 + Math.random() * 0.9), Math.sin(a) * r);
    }
  };

  // Shockwave rings expanding along ground on detonation
  const ringGeo = trackGeo(new THREE.RingGeometry(0.65, 1.0, 28));
  ringGeo.rotateX(-Math.PI / 2);
  const shockwaves: ShockwaveRing[] = [];
  for (let i = 0; i < 6; i++) {
    const rMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xff9a3c,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    const rm = new THREE.Mesh(ringGeo, rMat);
    rm.visible = false;
    group.add(rm);
    shockwaves.push({ mesh: rm, age: 0, life: 0.45, active: false });
  }
  let ringCursor = 0;

  const spawnShockwave = (origin: THREE.Vector3, colorHex = 0xff9a3c) => {
    const r = shockwaves[ringCursor];
    ringCursor = (ringCursor + 1) % shockwaves.length;
    r.active = true;
    r.age = 0;
    r.life = 0.48;
    r.mesh.visible = true;
    r.mesh.position.set(origin.x, 0.08, origin.z);
    r.mesh.scale.setScalar(0.5);
    const mat = r.mesh.material as THREE.MeshBasicMaterial;
    mat.color.setHex(colorHex);
    mat.opacity = 0.85;
  };

  const scorchGeo = trackGeo(new THREE.PlaneGeometry(3.4, 3.4));
  scorchGeo.rotateX(-Math.PI / 2);

  const addScorchDecal = (origin: THREE.Vector3, size = 1.0) => {
    const m = new THREE.Mesh(scorchGeo, materials.scorchDecal);
    m.position.set(origin.x, 0.036, origin.z);
    m.rotation.y = Math.random() * Math.PI * 2;
    m.scale.setScalar(size);
    group.add(m);
    scorchDecals.push(m);
  };

  // Delayed chain-reaction queue
  const pendingChainQueue: Array<{ hazard: DestructibleHazard; delay: number }> = [];

  const getTelemetry = (): HazardTelemetry => ({
    total: hazards.length,
    destroyed: hazards.filter((h) => h.destroyed).length,
    hoveredLabel: hoveredHazard && !hoveredHazard.destroyed ? hoveredHazard.label : null,
    lastEvent,
  });

  const emitTelemetry = () => {
    onTelemetryChange(getTelemetry());
  };

  const destroyHazard = (hz: DestructibleHazard, fromChain = false) => {
    if (hz.destroyed) return;
    hz.destroyed = true;
    hz.intactGroup.visible = false;
    hz.hitProxy.visible = false;

    if (hoveredHazard === hz) {
      hoveredHazard = null;
    }

    if (hz.kind === 'oil_barrel') {
      lastEvent = fromChain ? 'Chain Explosion — Fuel Barrel' : 'Detonated Fuel Barrel';
      audio.playExplosion();
      spawnDebrisBurst(hz.position, 'oil_barrel', 14, 1.25);
      spawnParticles(hz.position, 14, 0xff7b1c, true, 3.8, 1.3, 4.6, 0.65);
      spawnParticles(hz.position, 10, 0xffe484, true, 2.2, 0.9, 2.8, 0.42);
      spawnParticles(hz.position, 12, 0x26201c, false, 2.4, 1.5, 5.4, 1.65);
      spawnShockwave(hz.position, 0xff8c2e);
      addScorchDecal(hz.position, 1.15);
      onExplosionVisual(hz.position, 0.65, 110);
    } else if (hz.kind === 'wood_crate') {
      lastEvent = 'Shattered Supply Crate';
      audio.playWoodBreak();
      spawnDebrisBurst(hz.position, 'wood_crate', 12, 0.92);
      spawnParticles(hz.position, 8, 0xb8966e, false, 2.0, 0.8, 2.8, 0.9);
      spawnShockwave(hz.position, 0xd9b382);
      onExplosionVisual(hz.position, 0.22, 0);
    } else if (hz.kind === 'sandbags') {
      lastEvent = 'Breached Sandbag Barricade';
      audio.playWoodBreak();
      spawnDebrisBurst(hz.position, 'sandbags', 8, 0.72);
      spawnParticles(hz.position, 14, 0xc7a77b, false, 2.6, 1.1, 4.2, 1.25);
      onExplosionVisual(hz.position, 0.24, 0);
    } else if (hz.kind === 'rock_pile') {
      lastEvent = 'Fractured Quarry Boulders';
      audio.playRockShatter();
      spawnDebrisBurst(hz.position, 'rock_pile', 12, 0.95);
      spawnParticles(hz.position, 12, 0x9c8874, false, 2.4, 1.1, 3.8, 1.15);
      onExplosionVisual(hz.position, 0.34, 0);
    } else if (hz.kind === 'generator') {
      lastEvent = 'Short-Circuited Floodlight Generator';
      audio.playElectricZap();
      audio.playExplosion();
      generatorFlickerTimer = 3.8;
      spawnDebrisBurst(hz.position, 'generator', 10, 1.0);
      spawnParticles(hz.position, 14, 0x7fd4ff, true, 4.2, 0.7, 2.4, 0.52);
      spawnParticles(hz.position, 10, 0xffaa33, true, 3.0, 1.0, 3.4, 0.62);
      spawnShockwave(hz.position, 0x8ad8ff);
      addScorchDecal(hz.position, 0.85);
      onExplosionVisual(hz.position, 0.5, 85);
    }

    // Trigger chain reaction for nearby destructibles when explosive hazard detonates
    if (hz.chainRadius > 0) {
      for (const other of hazards) {
        if (other.destroyed || other === hz) continue;
        const dist = hz.position.distanceTo(other.position);
        if (dist <= hz.chainRadius) {
          pendingChainQueue.push({
            hazard: other,
            delay: 0.14 + dist * 0.045,
          });
        }
      }
    }

    emitTelemetry();
  };

  const setHoveredProxy = (proxy: THREE.Object3D | null) => {
    const next = proxy && proxy.userData.hazard ? (proxy.userData.hazard as DestructibleHazard) : null;
    const validNext = next && !next.destroyed ? next : null;
    if (validNext === hoveredHazard) return;

    // Clear previous hover tint
    if (hoveredHazard) {
      for (const m of hoveredHazard.highlightMats) {
        m.emissive.setHex(0x000000);
        m.emissiveIntensity = 0;
      }
    }
    hoveredHazard = validNext;
    if (hoveredHazard) {
      for (const m of hoveredHazard.highlightMats) {
        m.emissive.setHex(hoveredHazard.kind === 'oil_barrel' ? 0xd9480f : 0xc2842a);
        m.emissiveIntensity = 0.45;
      }
    }
    emitTelemetry();
  };

  const strikeProxy = (proxy: THREE.Object3D): boolean => {
    const hz = proxy.userData.hazard as DestructibleHazard | undefined;
    if (!hz || hz.destroyed) return false;
    destroyHazard(hz, false);
    return true;
  };

  const triggerChainBlast = () => {
    // Pick an intact explosive barrel (or reset first if all barrels are already gone)
    let target = hazards.find((h) => !h.destroyed && h.kind === 'oil_barrel');
    if (!target) {
      resetAll();
      target = hazards.find((h) => h.kind === 'oil_barrel');
    }
    if (target) {
      destroyHazard(target, false);
    }
  };

  const resetAll = () => {
    pendingChainQueue.length = 0;
    generatorFlickerTimer = 0;
    for (const h of hazards) {
      h.destroyed = false;
      h.intactGroup.visible = true;
      h.hitProxy.visible = false; // keep proxy invisible to render, still raycastable
      for (const m of h.highlightMats) {
        m.emissive.setHex(0x000000);
        m.emissiveIntensity = 0;
      }
    }
    for (const d of debrisPool) {
      d.active = false;
      d.mesh.visible = false;
    }
    for (const dec of scorchDecals) {
      group.remove(dec);
    }
    scorchDecals.length = 0;
    hoveredHazard = null;
    lastEvent = 'Arena Hazards Reset';
    emitTelemetry();
  };

  const update = (delta: number) => {
    // Process queued chain reactions
    for (let i = pendingChainQueue.length - 1; i >= 0; i--) {
      const item = pendingChainQueue[i];
      item.delay -= delta;
      if (item.delay <= 0) {
        pendingChainQueue.splice(i, 1);
        destroyHazard(item.hazard, true);
      }
    }

    if (generatorFlickerTimer > 0) {
      generatorFlickerTimer = Math.max(0, generatorFlickerTimer - delta);
    }

    // Physics step for tumbling debris pieces (gravity + arena floor bounce + friction)
    const gravity = -19.5;
    for (let i = 0; i < debrisPool.length; i++) {
      const d = debrisPool[i];
      if (!d.active) continue;
      d.age += delta;
      if (d.age >= d.maxAge) {
        d.active = false;
        d.mesh.visible = false;
        continue;
      }
      d.vel.y += gravity * delta;
      d.mesh.position.addScaledVector(d.vel, delta);
      d.mesh.rotation.x += d.angVel.x * delta;
      d.mesh.rotation.y += d.angVel.y * delta;
      d.mesh.rotation.z += d.angVel.z * delta;

      if (d.mesh.position.y < 0.14) {
        d.mesh.position.y = 0.14;
        d.vel.y = Math.abs(d.vel.y) * 0.34;
        d.vel.x *= 0.72;
        d.vel.z *= 0.72;
        d.angVel.multiplyScalar(0.65);
      }

      // Shrink gently at end of lifetime
      if (d.age > d.maxAge - 0.8) {
        const fade = Math.max(0.01, (d.maxAge - d.age) / 0.8);
        d.mesh.scale.multiplyScalar(0.95 + fade * 0.05);
      }
    }

    // Explosion fireball / smoke / sand / spark particles
    for (let i = 0; i < particlePool.length; i++) {
      const p = particlePool[i];
      if (!p.active) continue;
      p.age += delta;
      if (p.age >= p.life) {
        p.active = false;
        p.sprite.visible = false;
        continue;
      }
      const norm = p.age / p.life;
      _tmpVec.copy(p.vel).multiplyScalar(delta);
      p.sprite.position.add(_tmpVec);
      p.vel.multiplyScalar(Math.max(0, 1 - delta * 2.1));
      const sc = THREE.MathUtils.lerp(p.startScale, p.endScale, Math.pow(norm, 0.7));
      p.sprite.scale.setScalar(sc);
      const mat = p.sprite.material as THREE.SpriteMaterial;
      mat.opacity = p.maxOpacity * (1 - norm) * (1 - norm * 0.4);
    }

    // Expanding ground shockwave rings
    for (let i = 0; i < shockwaves.length; i++) {
      const r = shockwaves[i];
      if (!r.active) continue;
      r.age += delta;
      if (r.age >= r.life) {
        r.active = false;
        r.mesh.visible = false;
        continue;
      }
      const norm = r.age / r.life;
      r.mesh.scale.setScalar(0.6 + norm * 5.2);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - norm) * 0.75;
    }
  };

  const dispose = () => {
    geometries.forEach((g) => g.dispose());
    extraMaterials.forEach((m) => m.dispose());
  };

  return {
    group,
    hitProxies,
    setHoveredProxy,
    strikeProxy,
    triggerChainBlast,
    resetAll,
    getTelemetry,
    getGeneratorFlicker: () => generatorFlickerTimer,
    update,
    dispose,
  };
}
