import * as THREE from 'three';
import type { QuarryMaterialLibrary } from './materials';
import { groundHeightAt } from './terrainAndCliffs';

export interface QuarryStructuresResult {
  group: THREE.Group;
  fightersGroup: THREE.Group;
  floodlightCones: THREE.Mesh[];
  update: (elapsed: number, delta: number, sunElevation: number, generatorFlicker: number) => void;
  dispose: () => void;
}

export function createQuarryStructures(
  materials: QuarryMaterialLibrary,
  smokeSprite: THREE.Texture,
): QuarryStructuresResult {
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const extraMaterials: THREE.Material[] = [];
  const floodlightCones: THREE.Mesh[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    extraMaterials.push(m);
    return m;
  };

  const addShadowMesh = (
    parent: THREE.Object3D,
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
    parent.add(m);
    return m;
  };

  // ===========================================================================
  // 1. LEFT INDUSTRIAL WATCHTOWER + STAIRCASE + KGF CROSSED-PICKAXES BANNER
  //    (Matching Panels A, B, D — positioned at x = -14.8, z = -3.4)
  // ===========================================================================
  const leftTower = new THREE.Group();
  leftTower.position.set(-14.8, 0, -3.4);
  leftTower.rotation.y = 0.14;
  group.add(leftTower);

  const postGeo = trackGeo(new THREE.BoxGeometry(0.28, 9.2, 0.28));
  const towerHalf = 1.95;
  const corners = [
    [-towerHalf, -towerHalf],
    [towerHalf, -towerHalf],
    [-towerHalf, towerHalf],
    [towerHalf, towerHalf],
  ];
  // 4 main vertical corner steel/timber stanchions
  for (const [cx, cz] of corners) {
    addShadowMesh(leftTower, postGeo, materials.darkSteel, cx, 4.6, cz);
    // Concrete footing pad at base
    const footGeo = trackGeo(new THREE.BoxGeometry(0.65, 0.35, 0.65));
    addShadowMesh(leftTower, footGeo, materials.boulderStone, cx, 0.175, cz, 0, 0, 0, false);
  }

  // Mid platform (y = 3.2) & upper lookout deck (y = 6.4)
  const deckGeo = trackGeo(new THREE.BoxGeometry(4.5, 0.24, 4.5));
  addShadowMesh(leftTower, deckGeo, materials.weatheredWood, 0, 3.2, 0);
  addShadowMesh(leftTower, deckGeo, materials.weatheredWood, 0, 6.4, 0);

  // Horizontal steel perimeter beams & X-bracing on all 4 sides
  const hBeamGeo = trackGeo(new THREE.BoxGeometry(4.0, 0.18, 0.18));
  const xBraceGeo = trackGeo(new THREE.BoxGeometry(4.8, 0.12, 0.12));
  for (const levelY of [1.6, 4.8]) {
    // Front & back X-braces
    for (const sideZ of [-towerHalf, towerHalf]) {
      addShadowMesh(leftTower, xBraceGeo, materials.rustSteel, 0, levelY, sideZ, 0, 0, 0.68);
      addShadowMesh(leftTower, xBraceGeo, materials.rustSteel, 0, levelY, sideZ, 0, 0, -0.68);
    }
    // Left & right X-braces
    for (const sideX of [-towerHalf, towerHalf]) {
      addShadowMesh(leftTower, xBraceGeo, materials.rustSteel, sideX, levelY, 0, 0.68, Math.PI / 2, 0);
      addShadowMesh(leftTower, xBraceGeo, materials.rustSteel, sideX, levelY, 0, -0.68, Math.PI / 2, 0);
    }
  }
  for (const beamY of [3.08, 6.28, 7.55, 8.9]) {
    addShadowMesh(leftTower, hBeamGeo, materials.darkSteel, 0, beamY, towerHalf);
    addShadowMesh(leftTower, hBeamGeo, materials.darkSteel, 0, beamY, -towerHalf);
    addShadowMesh(leftTower, hBeamGeo, materials.darkSteel, towerHalf, beamY, 0, 0, Math.PI / 2, 0);
    addShadowMesh(leftTower, hBeamGeo, materials.darkSteel, -towerHalf, beamY, 0, 0, Math.PI / 2, 0);
  }

  // Lookout deck guardrails (y = 6.5..7.6)
  const railPostGeo = trackGeo(new THREE.BoxGeometry(0.1, 1.15, 0.1));
  for (const offset of [-1.0, 0, 1.0]) {
    addShadowMesh(leftTower, railPostGeo, materials.darkSteel, offset, 7.0, towerHalf);
    addShadowMesh(leftTower, railPostGeo, materials.darkSteel, offset, 7.0, -towerHalf);
    addShadowMesh(leftTower, railPostGeo, materials.darkSteel, towerHalf, 7.0, offset);
  }

  // Pitched corrugated iron lookout roof (y = 9.0..10.1)
  const roofPanelGeo = trackGeo(new THREE.BoxGeometry(5.6, 0.14, 2.85));
  addShadowMesh(leftTower, roofPanelGeo, materials.corrugatedIron, 0, 9.55, 1.25, 0.34, 0, 0);
  addShadowMesh(leftTower, roofPanelGeo, materials.corrugatedIron, 0, 9.55, -1.25, -0.34, 0, 0);
  const ridgeCapGeo = trackGeo(new THREE.BoxGeometry(5.7, 0.18, 0.32));
  addShadowMesh(leftTower, ridgeCapGeo, materials.rustSteel, 0, 10.02, 0);

  // Dual glowing warm floodlights mounted under the watchtower front eaves!
  const lampHousingGeo = trackGeo(new THREE.BoxGeometry(0.65, 0.42, 0.34));
  const lampFaceGeo = trackGeo(new THREE.PlaneGeometry(0.56, 0.34));
  for (const lx of [-0.65, 0.65]) {
    addShadowMesh(leftTower, lampHousingGeo, materials.darkSteel, lx, 8.65, towerHalf + 0.18, 0.25, 0, 0, false);
    const lens = new THREE.Mesh(lampFaceGeo, materials.emissiveFloodlight);
    lens.position.set(lx, 8.61, towerHalf + 0.36);
    lens.rotation.x = 0.25;
    leftTower.add(lens);
  }

  // Volumetric soft cone under watchtower lights
  const coneMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xffb858,
      transparent: true,
      opacity: 0.09,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  );
  const towerConeGeo = trackGeo(new THREE.ConeGeometry(2.6, 7.4, 16, 1, true));
  const towerCone = new THREE.Mesh(towerConeGeo, coneMat);
  towerCone.position.set(0, 5.2, towerHalf + 1.8);
  towerCone.rotation.x = -0.32;
  leftTower.add(towerCone);
  floodlightCones.push(towerCone);

  // Exterior diagonal steel staircase climbing up the left side (visible in Panel B!)
  const stairGroup = new THREE.Group();
  stairGroup.position.set(-towerHalf - 0.45, 0, 0);
  leftTower.add(stairGroup);
  const stringerGeo = trackGeo(new THREE.BoxGeometry(0.14, 0.24, 5.8));
  addShadowMesh(stairGroup, stringerGeo, materials.darkSteel, -0.45, 1.75, 2.2, -0.58, 0, 0);
  addShadowMesh(stairGroup, stringerGeo, materials.darkSteel, 0.35, 1.75, 2.2, -0.58, 0, 0);
  // Second stair flight from mid-deck up to top deck
  addShadowMesh(stairGroup, stringerGeo, materials.darkSteel, -0.45, 4.9, -0.2, 0.58, 0, 0);
  addShadowMesh(stairGroup, stringerGeo, materials.darkSteel, 0.35, 4.9, -0.2, 0.58, 0, 0);
  // Stair treads
  const treadGeo = trackGeo(new THREE.BoxGeometry(0.88, 0.06, 0.32));
  for (let s = 0; s < 11; s++) {
    const t = s / 10;
    addShadowMesh(stairGroup, treadGeo, materials.rustSteel, -0.05, 0.28 + t * 2.9, 4.4 - t * 4.5, 0, 0, 0, false);
    addShadowMesh(stairGroup, treadGeo, materials.rustSteel, -0.05, 3.45 + t * 2.9, -2.3 + t * 4.2, 0, 0, 0, false);
  }

  // Signature Deep Red KGF Crossed-Pickaxes Banner draped down the front-right face!
  // Subdivided plane with swallowtail notch at the bottom so it waves naturally in the wind
  const bannerGeo = trackGeo(new THREE.PlaneGeometry(1.75, 4.15, 6, 14));
  const bAttr = bannerGeo.attributes.position as THREE.BufferAttribute;
  const bannerBaseZ = new Float32Array(bAttr.count);
  for (let i = 0; i < bAttr.count; i++) {
    const bx = bAttr.getX(i);
    const by = bAttr.getY(i);
    // Swallowtail V-notch cut at bottom edge (by < -1.4)
    if (by < -1.45) {
      const centerProximity = 1.0 - Math.min(1.0, Math.abs(bx) / 0.88);
      bAttr.setY(i, by + centerProximity * 0.65);
    }
    bannerBaseZ[i] = bAttr.getZ(i);
  }
  bannerGeo.computeVertexNormals();

  const bannerMesh = new THREE.Mesh(bannerGeo, materials.kgfBanner);
  bannerMesh.position.set(0.62, 4.35, towerHalf + 0.16);
  bannerMesh.castShadow = true;
  leftTower.add(bannerMesh);

  // Horizontal steel mounting rod at top of banner
  const rodGeo = trackGeo(new THREE.CylinderGeometry(0.05, 0.05, 2.05, 8));
  rodGeo.rotateZ(Math.PI / 2);
  addShadowMesh(leftTower, rodGeo, materials.darkSteel, 0.62, 6.45, towerHalf + 0.16);

  // ===========================================================================
  // 2. INCLINED QUARRY CONVEYOR BELT STRUCTURE (Matching Panels A, B, C, D)
  //    Rising diagonally from left-back (-14, 1.5, -13) up to (-2.2, 9.6, -12.5)
  // ===========================================================================
  const conveyorGroup = new THREE.Group();
  group.add(conveyorGroup);

  const convStart = new THREE.Vector3(-14.6, 1.8, -13.2);
  const convEnd = new THREE.Vector3(-2.6, 9.4, -13.2);
  const convVec = new THREE.Vector3().subVectors(convEnd, convStart);
  const convLen = convVec.length();
  const convMid = new THREE.Vector3().addVectors(convStart, convEnd).multiplyScalar(0.5);
  const convAngle = Math.atan2(convVec.y, convVec.x);

  const trussHolder = new THREE.Group();
  trussHolder.position.copy(convMid);
  trussHolder.rotation.z = convAngle;
  conveyorGroup.add(trussHolder);

  // Belt bed + side steel girders + catwalk handrail
  const beltBedGeo = trackGeo(new THREE.BoxGeometry(convLen, 0.28, 1.35));
  addShadowMesh(trussHolder, beltBedGeo, materials.conveyorBelt, 0, 0.12, 0);

  const girderGeo = trackGeo(new THREE.BoxGeometry(convLen, 0.22, 0.16));
  addShadowMesh(trussHolder, girderGeo, materials.darkSteel, 0, -0.1, 0.82);
  addShadowMesh(trussHolder, girderGeo, materials.darkSteel, 0, -0.1, -0.82);
  addShadowMesh(trussHolder, girderGeo, materials.rustSteel, 0, 0.95, 0.82);
  addShadowMesh(trussHolder, girderGeo, materials.rustSteel, 0, 0.95, -0.82);

  // Truss diagonal struts along the conveyor gallery
  const strutGeo = trackGeo(new THREE.BoxGeometry(0.1, 1.25, 0.1));
  const numBays = 10;
  for (let i = 0; i <= numBays; i++) {
    const xPos = -convLen * 0.5 + (i / numBays) * convLen;
    addShadowMesh(trussHolder, strutGeo, materials.darkSteel, xPos, 0.45, 0.82, 0, 0, 0, false);
    addShadowMesh(trussHolder, strutGeo, materials.darkSteel, xPos, 0.45, -0.82, 0, 0, 0, false);
    if (i < numBays) {
      addShadowMesh(
        trussHolder,
        strutGeo,
        materials.rustSteel,
        xPos + (convLen / numBays) * 0.5,
        0.45,
        0.82,
        0,
        0,
        i % 2 === 0 ? 0.65 : -0.65,
        false,
      );
    }
  }

  // Discharge head house / ore chute at upper right end of conveyor
  const headHouseGeo = trackGeo(new THREE.BoxGeometry(2.1, 2.5, 2.2));
  addShadowMesh(conveyorGroup, headHouseGeo, materials.corrugatedIron, convEnd.x + 0.5, convEnd.y + 0.4, convEnd.z);
  const chuteGeo = trackGeo(new THREE.CylinderGeometry(0.75, 0.42, 2.4, 8));
  addShadowMesh(conveyorGroup, chuteGeo, materials.rustSteel, convEnd.x + 0.8, convEnd.y - 1.4, convEnd.z, 0, 0, 0.18);

  // Tall A-frame steel support trestles grounding the conveyor into the quarry floor
  const trestleFracs = [0.22, 0.58, 0.96];
  for (const f of trestleFracs) {
    const pt = new THREE.Vector3().lerpVectors(convStart, convEnd, f);
    const groundY = groundHeightAt(pt.x, pt.z);
    const h = pt.y - groundY;
    const legGeo = trackGeo(new THREE.BoxGeometry(0.24, h + 0.5, 0.24));
    addShadowMesh(conveyorGroup, legGeo, materials.darkSteel, pt.x, groundY + h * 0.5, pt.z - 0.95, 0.14, 0, 0);
    addShadowMesh(conveyorGroup, legGeo, materials.darkSteel, pt.x, groundY + h * 0.5, pt.z + 0.95, -0.14, 0, 0);
    // Horizontal tie bars
    const tieGeo = trackGeo(new THREE.BoxGeometry(0.18, 0.18, 2.4));
    addShadowMesh(conveyorGroup, tieGeo, materials.rustSteel, pt.x, groundY + h * 0.5, pt.z);
    addShadowMesh(conveyorGroup, tieGeo, materials.rustSteel, pt.x, groundY + h * 0.25, pt.z);
  }

  // Animated ore rock chunks riding up the conveyor belt!
  const oreChunkGeo = trackGeo(new THREE.DodecahedronGeometry(0.26, 0));
  const oreChunks: Array<{ mesh: THREE.Mesh; offset: number }> = [];
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(oreChunkGeo, materials.boulderStone);
    m.scale.set(1.2, 0.72, 1.0);
    m.rotation.set(i * 0.7, i * 1.3, 0);
    trussHolder.add(m);
    oreChunks.push({ mesh: m, offset: i / 12 });
  }

  // ===========================================================================
  // 3. RIGHT INDUSTRIAL CORRUGATED IRON SHED (Matching Panels A, C, D)
  //    Positioned at x = +15.8, z = +0.5, open front bay with glowing amber pendants
  // ===========================================================================
  const shedGroup = new THREE.Group();
  shedGroup.position.set(15.8, 0, 0.6);
  shedGroup.rotation.y = -0.06;
  group.add(shedGroup);

  const shedW = 7.4;
  const shedD = 10.6;
  // Sloped corrugated roof (higher toward back/right, lower eaves toward arena left)
  const shedRoofGeo = trackGeo(new THREE.BoxGeometry(shedW + 1.4, 0.16, shedD + 1.2));
  addShadowMesh(shedGroup, shedRoofGeo, materials.corrugatedIron, -0.2, 4.95, 0, 0, 0, 0.28);

  // Roof support rafters
  const rafterGeo = trackGeo(new THREE.BoxGeometry(shedW + 0.8, 0.18, 0.16));
  for (const rz of [-4.6, -2.3, 0, 2.3, 4.6]) {
    addShadowMesh(shedGroup, rafterGeo, materials.weatheredWood, -0.2, 4.78, rz, 0, 0, 0.28, false);
  }

  // Back wall (right side x = +3.4) & far-end wall (z = -5.2) in rusted corrugated iron
  const shedBackWallGeo = trackGeo(new THREE.BoxGeometry(0.16, 5.8, shedD));
  addShadowMesh(shedGroup, shedBackWallGeo, materials.corrugatedIron, 3.4, 2.9, 0);
  const shedEndWallGeo = trackGeo(new THREE.BoxGeometry(shedW, 4.8, 0.16));
  addShadowMesh(shedGroup, shedEndWallGeo, materials.corrugatedIron, 0, 2.4, -5.2);

  // Heavy front veranda posts along x = -3.4 facing the fighting arena
  const shedPostGeo = trackGeo(new THREE.BoxGeometry(0.26, 4.1, 0.26));
  for (const pz of [-5.0, -1.7, 1.7, 5.0]) {
    addShadowMesh(shedGroup, shedPostGeo, materials.weatheredWood, -3.4, 2.05, pz);
  }
  // Eaves beam connecting front posts
  const eavesBeamGeo = trackGeo(new THREE.BoxGeometry(0.24, 0.26, shedD));
  addShadowMesh(shedGroup, eavesBeamGeo, materials.weatheredWood, -3.4, 4.02, 0);

  // Warm glowing hanging industrial pendant lamps inside the shed eaves (Panel A & C!)
  const cordGeo = trackGeo(new THREE.CylinderGeometry(0.02, 0.02, 0.85, 6));
  const shadeGeo = trackGeo(new THREE.ConeGeometry(0.32, 0.24, 12, 1, true));
  const bulbGeo = trackGeo(new THREE.SphereGeometry(0.14, 10, 10));
  for (const lz of [-2.4, 1.8]) {
    addShadowMesh(shedGroup, cordGeo, materials.darkSteel, -1.6, 3.95, lz, 0, 0, 0, false);
    addShadowMesh(shedGroup, shadeGeo, materials.darkSteel, -1.6, 3.55, lz, 0, 0, 0, false);
    const bulb = new THREE.Mesh(bulbGeo, materials.emissivePendant);
    bulb.position.set(-1.6, 3.45, lz);
    shedGroup.add(bulb);
  }

  // Interior work table & machinery silhouette inside shed for depth
  const benchGeo = trackGeo(new THREE.BoxGeometry(1.8, 0.95, 4.2));
  addShadowMesh(shedGroup, benchGeo, materials.weatheredWood, 1.4, 0.475, -1.2);
  const motorGeo = trackGeo(new THREE.CylinderGeometry(0.45, 0.45, 1.3, 12));
  motorGeo.rotateX(Math.PI / 2);
  addShadowMesh(shedGroup, motorGeo, materials.rustSteel, 1.4, 1.25, -1.8);

  // ===========================================================================
  // 4. RIGHT TALL INDUSTRIAL STEEL DERRICK / WATCHTOWER (Behind shed, Panel A)
  // ===========================================================================
  const rightTower = new THREE.Group();
  rightTower.position.set(13.8, 0, -8.2);
  rightTower.rotation.y = -0.18;
  group.add(rightTower);

  const rtPostGeo = trackGeo(new THREE.BoxGeometry(0.3, 13.5, 0.3));
  const rtHalf = 2.05;
  for (const [cx, cz] of [
    [-rtHalf, -rtHalf],
    [rtHalf, -rtHalf],
    [-rtHalf, rtHalf],
    [rtHalf, rtHalf],
  ]) {
    addShadowMesh(rightTower, rtPostGeo, materials.darkSteel, cx, 6.75, cz);
  }
  const rtDeckGeo = trackGeo(new THREE.BoxGeometry(4.6, 0.24, 4.6));
  for (const dy of [4.2, 8.2, 12.0]) {
    addShadowMesh(rightTower, rtDeckGeo, materials.rustSteel, 0, dy, 0);
  }
  // Cross braces on right tower
  const rtBraceGeo = trackGeo(new THREE.BoxGeometry(5.3, 0.14, 0.14));
  for (const by of [2.1, 6.2, 10.1]) {
    addShadowMesh(rightTower, rtBraceGeo, materials.darkSteel, 0, by, rtHalf, 0, 0, 0.72);
    addShadowMesh(rightTower, rtBraceGeo, materials.darkSteel, 0, by, rtHalf, 0, 0, -0.72);
    addShadowMesh(rightTower, rtBraceGeo, materials.darkSteel, -rtHalf, by, 0, 0.72, Math.PI / 2, 0);
    addShadowMesh(rightTower, rtBraceGeo, materials.darkSteel, -rtHalf, by, 0, -0.72, Math.PI / 2, 0);
  }
  // Overhead derrick roof canopy
  const rtRoofGeo = trackGeo(new THREE.BoxGeometry(5.4, 0.2, 5.4));
  addShadowMesh(rightTower, rtRoofGeo, materials.corrugatedIron, 0, 13.6, 0);

  // ===========================================================================
  // 5. TALL QUAD/MULTI-BULB FLOODLIGHT POLE RIG (Matching Panel A, C, D!)
  //    Positioned at x = +10.2, z = -5.8 casting bright stadium illumination
  // ===========================================================================
  const floodPole = new THREE.Group();
  floodPole.position.set(10.2, 0, -5.8);
  floodPole.rotation.y = -0.62;
  group.add(floodPole);

  // Heavy tripod legs + central mast
  const mastGeo = trackGeo(new THREE.CylinderGeometry(0.11, 0.16, 6.8, 10));
  addShadowMesh(floodPole, mastGeo, materials.darkSteel, 0, 3.4, 0);
  const tripodLegGeo = trackGeo(new THREE.CylinderGeometry(0.06, 0.06, 2.3, 8));
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3;
    addShadowMesh(
      floodPole,
      tripodLegGeo,
      materials.rustSteel,
      Math.cos(a) * 0.55,
      0.95,
      Math.sin(a) * 0.55,
      Math.sin(a) * 0.45,
      0,
      -Math.cos(a) * 0.45,
    );
  }

  // Lamp array frame (4x3 halogen lamp bank)
  const frameGeo = trackGeo(new THREE.BoxGeometry(1.95, 1.32, 0.26));
  addShadowMesh(floodPole, frameGeo, materials.darkSteel, 0, 6.95, 0.08, 0.24, 0, 0);
  const cellGeo = trackGeo(new THREE.BoxGeometry(0.38, 0.34, 0.08));
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      const lx = -0.66 + c * 0.44;
      const ly = 6.56 + r * 0.39;
      const cell = new THREE.Mesh(cellGeo, materials.emissiveFloodlight);
      cell.position.set(lx, ly, 0.22);
      cell.rotation.x = 0.24;
      floodPole.add(cell);
    }
  }

  // Volumetric beam cone shining from the floodlight mast onto the arena
  const mastConeGeo = trackGeo(new THREE.ConeGeometry(4.4, 11.5, 20, 1, true));
  const mastCone = new THREE.Mesh(mastConeGeo, coneMat);
  mastCone.position.set(0, 2.5, 4.3);
  mastCone.rotation.x = -0.68;
  floodPole.add(mastCone);
  floodlightCones.push(mastCone);

  // Secondary smaller work floodlight pole on left-mid back fence (Panel A!)
  const smallPole = new THREE.Group();
  smallPole.position.set(-4.6, 0, -7.8);
  group.add(smallPole);
  const sMastGeo = trackGeo(new THREE.CylinderGeometry(0.07, 0.1, 3.6, 8));
  addShadowMesh(smallPole, sMastGeo, materials.darkSteel, 0, 1.8, 0);
  const sHeadGeo = trackGeo(new THREE.BoxGeometry(0.75, 0.52, 0.18));
  addShadowMesh(smallPole, sHeadGeo, materials.darkSteel, 0, 3.65, 0);
  const sLens = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(0.66, 0.42)), materials.emissiveFloodlight);
  sLens.position.set(0, 3.65, 0.11);
  smallPole.add(sLens);

  // ===========================================================================
  // 6. BACK PERIMETER BARRICADE FENCE (Separating fighting floor from quarry pit)
  // ===========================================================================
  const fenceGroup = new THREE.Group();
  group.add(fenceGroup);
  const fPostGeo = trackGeo(new THREE.BoxGeometry(0.16, 1.65, 0.16));
  const fRailGeo = trackGeo(new THREE.BoxGeometry(2.85, 0.12, 0.08));
  for (let fx = -11.5; fx <= 9.5; fx += 2.75) {
    addShadowMesh(fenceGroup, fPostGeo, materials.weatheredWood, fx, 0.82, -7.8);
    if (fx < 9.0) {
      addShadowMesh(fenceGroup, fRailGeo, materials.weatheredWood, fx + 1.375, 1.25, -7.75);
      addShadowMesh(fenceGroup, fRailGeo, materials.weatheredWood, fx + 1.375, 0.65, -7.75);
      // Occasional corrugated sheet scrap patched onto fence
      if (Math.abs(fx + 3) < 2 || Math.abs(fx - 4) < 2) {
        const patchGeo = trackGeo(new THREE.BoxGeometry(2.3, 1.35, 0.06));
        addShadowMesh(fenceGroup, patchGeo, materials.corrugatedIron, fx + 1.35, 0.72, -7.85);
      }
    }
  }

  // ===========================================================================
  // 7. DISTANT INDUSTRIAL CRUSHER PLANT & TALL SMOKESTACK CHIMNEY (Panel A!)
  //    Positioned on upper right-center quarry rim (x = +19, z = -62)
  // ===========================================================================
  const plantGroup = new THREE.Group();
  const plantBaseY = groundHeightAt(19, -62);
  plantGroup.position.set(19, plantBaseY - 0.5, -62);
  group.add(plantGroup);

  // Tall tapered industrial smokestack
  const stackGeo = trackGeo(new THREE.CylinderGeometry(0.85, 1.85, 22, 14));
  addShadowMesh(plantGroup, stackGeo, materials.boulderStone, 2.2, 11, 0, 0, 0, 0, false);
  const stackCollarGeo = trackGeo(new THREE.CylinderGeometry(1.15, 1.05, 1.1, 14));
  addShadowMesh(plantGroup, stackCollarGeo, materials.darkSteel, 2.2, 21.8, 0, 0, 0, 0, false);

  // Crusher plant buildings, silos & steel scaffold
  const plantBodyGeo = trackGeo(new THREE.BoxGeometry(9.5, 7.5, 6.2));
  addShadowMesh(plantGroup, plantBodyGeo, materials.darkSteel, -4.2, 3.75, 1.5, 0, 0, 0, false);
  const siloGeo = trackGeo(new THREE.CylinderGeometry(1.9, 1.9, 9.5, 12));
  addShadowMesh(plantGroup, siloGeo, materials.rustSteel, -10.5, 4.75, 0.5, 0, 0, 0, false);
  const plantTowerGeo = trackGeo(new THREE.BoxGeometry(3.2, 13.0, 3.2));
  addShadowMesh(plantGroup, plantTowerGeo, materials.darkSteel, -5.2, 6.5, -2.5, 0, 0, 0, false);

  // Billowing dark-grey coal smoke plume rising from the smokestack across the sunset sky!
  const smokePuffs: Array<{
    sprite: THREE.Sprite;
    age: number;
    life: number;
    driftX: number;
    driftZ: number;
  }> = [];
  const smokeTopWorld = new THREE.Vector3(21.2, plantBaseY + 21.6, -62);
  const smokeCount = 26;
  for (let i = 0; i < smokeCount; i++) {
    const sMat = trackMat(
      new THREE.SpriteMaterial({
        map: smokeSprite,
        color: 0x3b3532,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
    );
    const sp = new THREE.Sprite(sMat);
    const life = 7.5 + (i % 5) * 0.9;
    const age = (i / smokeCount) * life;
    sp.position.copy(smokeTopWorld);
    group.add(sp);
    smokePuffs.push({
      sprite: sp,
      age,
      life,
      driftX: -2.6 - (i % 4) * 0.35, // drifts left-upward across the sun sky just like Panel A!
      driftZ: (i % 3 - 1) * 0.35,
    });
  }

  // ===========================================================================
  // 8. OPTIONAL 1.8m FIGHTER SCALE REFERENCE PAIR (Key Measurements Panel)
  // ===========================================================================
  const fightersGroup = new THREE.Group();
  fightersGroup.visible = false;
  group.add(fightersGroup);

  const buildFighterMannequin = (facingRight: boolean, accentHex: number) => {
    const f = new THREE.Group();
    const bodyMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xe6dfd3,
        roughness: 0.52,
        metalness: 0.12,
      }),
    );
    const bandMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: accentHex,
        roughness: 0.65,
        metalness: 0.08,
      }),
    );

    const dir = facingRight ? 1 : -1;
    // Legs in martial arts stance (total height = 1.80m)
    const legGeo = trackGeo(new THREE.CapsuleGeometry(0.11, 0.68, 6, 10));
    addShadowMesh(f, legGeo, bodyMat, -0.26 * dir, 0.45, 0.08, 0, 0, -0.22 * dir);
    addShadowMesh(f, legGeo, bodyMat, 0.28 * dir, 0.44, -0.08, 0, 0, 0.24 * dir);
    // Torso
    const torsoGeo = trackGeo(new THREE.CapsuleGeometry(0.2, 0.46, 6, 12));
    addShadowMesh(f, torsoGeo, bodyMat, 0.02 * dir, 1.12, 0, 0, 0, -0.08 * dir);
    // Belt sash
    const beltGeo = trackGeo(new THREE.CylinderGeometry(0.21, 0.21, 0.1, 12));
    addShadowMesh(f, beltGeo, bandMat, 0.02 * dir, 0.88, 0);
    // Guarded combat arms
    const armGeo = trackGeo(new THREE.CapsuleGeometry(0.08, 0.44, 6, 10));
    addShadowMesh(f, armGeo, bodyMat, 0.26 * dir, 1.24, 0.18, 0.45, 0, -0.7 * dir);
    addShadowMesh(f, armGeo, bodyMat, 0.34 * dir, 1.28, -0.14, -0.35, 0, -0.95 * dir);
    // Head
    const headGeo = trackGeo(new THREE.SphereGeometry(0.15, 14, 12));
    addShadowMesh(f, headGeo, bodyMat, 0.06 * dir, 1.64, 0);
    // Contact shadow disc
    const shdGeo = trackGeo(new THREE.PlaneGeometry(1.5, 1.5));
    shdGeo.rotateX(-Math.PI / 2);
    const shd = new THREE.Mesh(shdGeo, materials.contactShadow);
    shd.position.y = 0.025;
    f.add(shd);

    return f;
  };

  const fighterLeft = buildFighterMannequin(true, 0xb91c1c);
  fighterLeft.position.set(-4.2, 0, 0.8);
  fightersGroup.add(fighterLeft);

  const fighterRight = buildFighterMannequin(false, 0xf59e0b);
  fighterRight.position.set(4.2, 0, 0.8);
  fightersGroup.add(fighterRight);

  // Subtle 36m arena measurement boundary line on floor (only shown with Fighter Scale toggle)
  const guideMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    }),
  );
  const laneGeo = trackGeo(new THREE.PlaneGeometry(34, 0.12));
  laneGeo.rotateX(-Math.PI / 2);
  const laneLine = new THREE.Mesh(laneGeo, guideMat);
  laneLine.position.set(0, 0.04, 0.8);
  fightersGroup.add(laneLine);

  // ===========================================================================
  // PER-FRAME STRUCTURE ANIMATIONS (Banner wind, Conveyor ore, Smokestack, Stance)
  // ===========================================================================
  const update = (
    elapsed: number,
    delta: number,
    sunElevation: number,
    generatorFlicker: number,
  ) => {
    // 1. Cloth wind sway on the KGF watchtower banner
    for (let i = 0; i < bAttr.count; i++) {
      const by = bAttr.getY(i);
      const bx = bAttr.getX(i);
      // Pin top edge (by ~ +2.075), sway increases smoothly toward bottom
      const freeFactor = THREE.MathUtils.clamp((2.075 - by) / 4.15, 0, 1);
      const wave =
        Math.sin(elapsed * 2.6 + by * 1.4 + bx * 1.2) * 0.18 * freeFactor * freeFactor +
        Math.sin(elapsed * 5.1 + by * 2.8) * 0.05 * freeFactor;
      bAttr.setZ(i, bannerBaseZ[i] + wave);
    }
    bAttr.needsUpdate = true;

    // 2. Moving ore chunks riding up the inclined conveyor belt
    for (let i = 0; i < oreChunks.length; i++) {
      const c = oreChunks[i];
      const u = (c.offset + elapsed * 0.11) % 1.0;
      c.mesh.position.set(-convLen * 0.48 + u * convLen * 0.94, 0.36, (i % 3 - 1) * 0.22);
    }

    // 3. Billowing industrial smokestack coal plume
    for (let i = 0; i < smokePuffs.length; i++) {
      const p = smokePuffs[i];
      p.age += delta;
      if (p.age >= p.life) p.age -= p.life;
      const t = p.age / p.life;
      p.sprite.position.set(
        smokeTopWorld.x + p.driftX * t * 9.0,
        smokeTopWorld.y + t * 14.5 + Math.sin(t * 5.0 + i) * 0.6,
        smokeTopWorld.z + p.driftZ * t * 6.0,
      );
      const scale = 2.6 + t * 11.5;
      p.sprite.scale.set(scale, scale * 0.85, 1);
      const mat = p.sprite.material as THREE.SpriteMaterial;
      mat.opacity = Math.sin(t * Math.PI) * 0.48;
      // Tint smoke slightly warmer in golden evening light
      if (sunElevation < 0.12) {
        mat.color.setHex(0x1e2028);
      } else if (sunElevation < 0.45) {
        mat.color.setHex(0x4b3f39);
      } else {
        mat.color.setHex(0x6e6964);
      }
    }

    // 4. Adjust volumetric floodlight cone visibility by time of day & generator flicker
    const nightVis = THREE.MathUtils.clamp(1.25 - sunElevation * 1.4, 0.0, 1.0);
    const flickerMul = generatorFlicker > 0 ? (Math.random() > 0.45 ? 0.1 : 1.35) : 1.0;
    coneMat.opacity = 0.095 * nightVis * flickerMul;

    // 5. Subtle fighting idle breathing bounce on the 1.8m scale mannequins
    if (fightersGroup.visible) {
      fighterLeft.position.y = Math.abs(Math.sin(elapsed * 3.2)) * 0.045;
      fighterRight.position.y = Math.abs(Math.sin(elapsed * 3.2 + 1.1)) * 0.045;
    }
  };

  const dispose = () => {
    geometries.forEach((g) => g.dispose());
    extraMaterials.forEach((m) => m.dispose());
  };

  return {
    group,
    fightersGroup,
    floodlightCones,
    update,
    dispose,
  };
}
