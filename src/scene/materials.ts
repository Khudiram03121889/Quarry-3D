import * as THREE from 'three';
import type { QuarryTextureSet } from './textures';

export interface QuarryMaterialLibrary {
  cliffStone: THREE.MeshStandardMaterial;
  boulderStone: THREE.MeshStandardMaterial;
  arenaGround: THREE.MeshStandardMaterial;
  puddleWater: THREE.MeshPhysicalMaterial;
  corrugatedIron: THREE.MeshStandardMaterial;
  darkSteel: THREE.MeshStandardMaterial;
  rustSteel: THREE.MeshStandardMaterial;
  weatheredWood: THREE.MeshStandardMaterial;
  crateWood: THREE.MeshStandardMaterial;
  yellowMachinery: THREE.MeshStandardMaterial;
  rubberTire: THREE.MeshStandardMaterial;
  cabGlass: THREE.MeshPhysicalMaterial;
  oilBarrel: THREE.MeshStandardMaterial;
  barrelRim: THREE.MeshStandardMaterial;
  sandbag: THREE.MeshStandardMaterial;
  kgfBanner: THREE.MeshStandardMaterial;
  conveyorBelt: THREE.MeshStandardMaterial;
  emissiveFloodlight: THREE.MeshStandardMaterial;
  emissivePendant: THREE.MeshStandardMaterial;
  emissiveBeacon: THREE.MeshStandardMaterial;
  contactShadow: THREE.MeshBasicMaterial;
  scorchDecal: THREE.MeshBasicMaterial;
  dispose: () => void;
}

export function createQuarryMaterials(
  tex: QuarryTextureSet,
  isSoftwareGl: boolean,
): QuarryMaterialLibrary {
  const all: THREE.Material[] = [];
  const reg = <T extends THREE.Material>(m: T): T => {
    all.push(m);
    return m;
  };

  const cliffStone = reg(
    new THREE.MeshStandardMaterial({
      map: tex.stoneColor,
      bumpMap: tex.stoneBump,
      bumpScale: 1.45,
      roughnessMap: tex.stoneRoughness,
      roughness: 0.94,
      metalness: 0.04,
      vertexColors: true,
    }),
  );

  const boulderStone = reg(
    new THREE.MeshStandardMaterial({
      map: tex.stoneColor,
      bumpMap: tex.stoneBump,
      bumpScale: 0.85,
      roughnessMap: tex.stoneRoughness,
      roughness: 0.9,
      metalness: 0.06,
    }),
  );

  const arenaGround = reg(
    new THREE.MeshStandardMaterial({
      map: tex.groundColor,
      bumpMap: tex.groundBump,
      bumpScale: 0.42,
      roughnessMap: tex.groundRoughness,
      roughness: 0.92,
      metalness: 0.05,
    }),
  );

  const puddleWater = reg(
    new THREE.MeshPhysicalMaterial({
      color: 0x3b3128,
      roughness: 0.08,
      metalness: 0.15,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      transparent: true,
      opacity: 0.78,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );

  const corrugatedIron = reg(
    new THREE.MeshStandardMaterial({
      map: tex.corrugatedColor,
      bumpMap: tex.corrugatedBump,
      bumpScale: 0.32,
      roughnessMap: tex.corrugatedRoughness,
      roughness: 0.74,
      metalness: 0.56,
      side: THREE.DoubleSide,
    }),
  );

  const darkSteel = reg(
    new THREE.MeshStandardMaterial({
      map: tex.steelColor,
      bumpMap: tex.steelBump,
      bumpScale: 0.18,
      color: 0x524c48,
      roughness: 0.58,
      metalness: 0.72,
    }),
  );

  const rustSteel = reg(
    new THREE.MeshStandardMaterial({
      map: tex.steelColor,
      bumpMap: tex.steelBump,
      bumpScale: 0.24,
      color: 0x7d4c32,
      roughness: 0.84,
      metalness: 0.42,
    }),
  );

  const weatheredWood = reg(
    new THREE.MeshStandardMaterial({
      map: tex.woodColor,
      bumpMap: tex.woodBump,
      bumpScale: 0.22,
      color: 0x8f7458,
      roughness: 0.88,
      metalness: 0.04,
    }),
  );

  const crateWood = reg(
    new THREE.MeshStandardMaterial({
      map: tex.woodColor,
      bumpMap: tex.woodBump,
      bumpScale: 0.18,
      color: 0xb69267,
      roughness: 0.82,
      metalness: 0.04,
    }),
  );

  const yellowMachinery = reg(
    new THREE.MeshStandardMaterial({
      map: tex.yellowMachineryColor,
      bumpMap: tex.yellowMachineryBump,
      bumpScale: 0.15,
      roughness: 0.46,
      metalness: 0.38,
    }),
  );

  const rubberTire = reg(
    new THREE.MeshStandardMaterial({
      color: 0x1c1a19,
      roughness: 0.92,
      metalness: 0.05,
    }),
  );

  const cabGlass = reg(
    new THREE.MeshPhysicalMaterial({
      color: 0x26323a,
      roughness: 0.12,
      metalness: 0.1,
      clearcoat: 1.0,
      transmission: isSoftwareGl ? 0 : 0.35,
      transparent: true,
      opacity: isSoftwareGl ? 0.65 : 0.88,
    }),
  );

  const oilBarrel = reg(
    new THREE.MeshStandardMaterial({
      map: tex.barrelColor,
      bumpMap: tex.barrelBump,
      bumpScale: 0.16,
      roughness: 0.48,
      metalness: 0.52,
    }),
  );

  const barrelRim = reg(
    new THREE.MeshStandardMaterial({
      color: 0x3b3532,
      roughness: 0.42,
      metalness: 0.78,
    }),
  );

  const sandbag = reg(
    new THREE.MeshStandardMaterial({
      map: tex.sandbagColor,
      bumpMap: tex.sandbagBump,
      bumpScale: 0.26,
      roughness: 0.95,
      metalness: 0.02,
    }),
  );

  const kgfBanner = reg(
    new THREE.MeshStandardMaterial({
      map: tex.bannerColor,
      roughness: 0.88,
      metalness: 0.02,
      side: THREE.DoubleSide,
    }),
  );

  const conveyorBelt = reg(
    new THREE.MeshStandardMaterial({
      color: 0x252322,
      roughness: 0.85,
      metalness: 0.15,
    }),
  );

  const emissiveFloodlight = reg(
    new THREE.MeshStandardMaterial({
      color: 0xfff3cf,
      emissive: 0xffb84d,
      emissiveIntensity: 3.4,
      roughness: 0.15,
      metalness: 0.1,
    }),
  );

  const emissivePendant = reg(
    new THREE.MeshStandardMaterial({
      color: 0xffe4a8,
      emissive: 0xff9d2e,
      emissiveIntensity: 3.0,
      roughness: 0.2,
      metalness: 0.1,
    }),
  );

  const emissiveBeacon = reg(
    new THREE.MeshStandardMaterial({
      color: 0xffbe3b,
      emissive: 0xff8c00,
      emissiveIntensity: 2.5,
      roughness: 0.15,
      metalness: 0.1,
    }),
  );

  const contactShadow = reg(
    new THREE.MeshBasicMaterial({
      map: tex.contactShadow,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );

  const scorchDecal = reg(
    new THREE.MeshBasicMaterial({
      map: tex.scorchDecal,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );

  return {
    cliffStone,
    boulderStone,
    arenaGround,
    puddleWater,
    corrugatedIron,
    darkSteel,
    rustSteel,
    weatheredWood,
    crateWood,
    yellowMachinery,
    rubberTire,
    cabGlass,
    oilBarrel,
    barrelRim,
    sandbag,
    kgfBanner,
    conveyorBelt,
    emissiveFloodlight,
    emissivePendant,
    emissiveBeacon,
    contactShadow,
    scorchDecal,
    dispose: () => {
      all.forEach((m) => m.dispose());
    },
  };
}
