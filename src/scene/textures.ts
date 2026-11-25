import * as THREE from 'three';

export interface QuarryTextureSet {
  // Stratified quarry stone cliffs & boulders
  stoneColor: THREE.CanvasTexture;
  stoneBump: THREE.CanvasTexture;
  stoneRoughness: THREE.CanvasTexture;

  // Arena dusty ground with pebbles, tracks & wet puddles
  groundColor: THREE.CanvasTexture;
  groundBump: THREE.CanvasTexture;
  groundRoughness: THREE.CanvasTexture;

  // Two-lane unpaved kutcha quarry haul road (side-by-side tire ruts + center gravel crown)
  kutchaRoadColor: THREE.CanvasTexture;
  kutchaRoadBump: THREE.CanvasTexture;
  kutchaRoadRoughness: THREE.CanvasTexture;

  // Corrugated rusted iron (shed roof & walls)
  corrugatedColor: THREE.CanvasTexture;
  corrugatedBump: THREE.CanvasTexture;
  corrugatedRoughness: THREE.CanvasTexture;

  // Weathered timber planks (watchtower, crates, fences)
  woodColor: THREE.CanvasTexture;
  woodBump: THREE.CanvasTexture;

  // Heavy industrial rusted steel
  steelColor: THREE.CanvasTexture;
  steelBump: THREE.CanvasTexture;

  // Yellow weathered mining machinery paint (trucks, excavator)
  yellowMachineryColor: THREE.CanvasTexture;
  yellowMachineryBump: THREE.CanvasTexture;

  // Oil / hazard drum texture
  barrelColor: THREE.CanvasTexture;
  barrelBump: THREE.CanvasTexture;

  // Burlap sandbag texture
  sandbagColor: THREE.CanvasTexture;
  sandbagBump: THREE.CanvasTexture;

  // Deep red KGF crossed-pickaxes banner
  bannerColor: THREE.CanvasTexture;

  // Soft particle puff (smoke, dust, fire) & contact shadow
  smokeSprite: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  scorchDecal: THREE.CanvasTexture;

  dispose: () => void;
}

// Deterministic seeded PRNG for repeatable photorealistic procedural textures
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

function configureTexture(
  canvas: HTMLCanvasElement,
  isColor: boolean,
  maxAnisotropy: number,
  repeatX = 1,
  repeatY = 1,
  clamp = false,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  tex.wrapT = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = Math.min(maxAnisotropy, 16);
  tex.needsUpdate = true;
  return tex;
}

export function createQuarryTextures(maxAnisotropy: number): QuarryTextureSet {
  const allTextures: THREE.CanvasTexture[] = [];
  const reg = (t: THREE.CanvasTexture) => {
    allTextures.push(t);
    return t;
  };

  // ---------------------------------------------------------------------------
  // 1. STRATIFIED QUARRY STONE (Albedo + Bump + Roughness)
  // ---------------------------------------------------------------------------
  const stoneW = 512;
  const stoneH = 512;
  const [stColC, stCol] = makeCanvas(stoneW, stoneH);
  const [stBmpC, stBmp] = makeCanvas(stoneW, stoneH);
  const [stRghC, stRgh] = makeCanvas(stoneW, stoneH);
  {
    const rng = mulberry32(101);
    // Base dusty granite-ochre tone
    stCol.fillStyle = '#5a4d42';
    stCol.fillRect(0, 0, stoneW, stoneH);
    stBmp.fillStyle = '#808080';
    stBmp.fillRect(0, 0, stoneW, stoneH);
    stRgh.fillStyle = '#d8d8d8';
    stRgh.fillRect(0, 0, stoneW, stoneH);

    // Horizontal geological sedimentary/blasted quarry strata bands
    let y = 0;
    while (y < stoneH) {
      const bandH = 8 + rng() * 28;
      const shade = 0.72 + rng() * 0.45;
      const r = Math.min(255, Math.floor((88 + rng() * 34) * shade));
      const g = Math.min(255, Math.floor((74 + rng() * 28) * shade));
      const b = Math.min(255, Math.floor((62 + rng() * 24) * shade));
      stCol.fillStyle = `rgb(${r},${g},${b})`;
      stCol.fillRect(0, y, stoneW, bandH);

      const bmpV = Math.floor(95 + rng() * 90);
      stBmp.fillStyle = `rgb(${bmpV},${bmpV},${bmpV})`;
      stBmp.fillRect(0, y, stoneW, bandH);

      const rghV = Math.floor(195 + rng() * 55);
      stRgh.fillStyle = `rgb(${rghV},${rghV},${rghV})`;
      stRgh.fillRect(0, y, stoneW, bandH);

      // Dark fracture seam between rock strata
      stCol.fillStyle = 'rgba(20, 16, 14, 0.55)';
      stCol.fillRect(0, y, stoneW, 1 + rng() * 2.5);
      stBmp.fillStyle = '#222222';
      stBmp.fillRect(0, y, stoneW, 2);

      y += bandH;
    }

    // Angular blasted rock facets & vertical cleavage lines
    for (let i = 0; i < 420; i++) {
      const x = rng() * stoneW;
      const py = rng() * stoneH;
      const w = 10 + rng() * 44;
      const h = 6 + rng() * 28;
      const bright = rng() > 0.45;
      stCol.fillStyle = bright
        ? `rgba(176, 148, 118, ${0.08 + rng() * 0.14})`
        : `rgba(24, 19, 16, ${0.12 + rng() * 0.22})`;
      stCol.beginPath();
      stCol.moveTo(x, py);
      stCol.lineTo(x + w, py + (rng() - 0.5) * 10);
      stCol.lineTo(x + w * (0.7 + rng() * 0.4), py + h);
      stCol.lineTo(x - rng() * 12, py + h * 0.85);
      stCol.closePath();
      stCol.fill();

      const bv = bright ? 175 + Math.floor(rng() * 65) : 45 + Math.floor(rng() * 55);
      stBmp.fillStyle = `rgba(${bv},${bv},${bv},0.45)`;
      stBmp.fillRect(x, py, w * 0.8, h * 0.8);
    }

    // Cracks and fine mineral grit
    stCol.strokeStyle = 'rgba(18, 14, 12, 0.55)';
    stBmp.strokeStyle = 'rgba(15, 15, 15, 0.75)';
    for (let i = 0; i < 95; i++) {
      let cx = rng() * stoneW;
      let cy = rng() * stoneH;
      stCol.lineWidth = 0.8 + rng() * 1.5;
      stBmp.lineWidth = stCol.lineWidth;
      stCol.beginPath();
      stBmp.beginPath();
      stCol.moveTo(cx, cy);
      stBmp.moveTo(cx, cy);
      const segs = 3 + Math.floor(rng() * 5);
      for (let s = 0; s < segs; s++) {
        cx += (rng() - 0.5) * 34;
        cy += (rng() - 0.2) * 28;
        stCol.lineTo(cx, cy);
        stBmp.lineTo(cx, cy);
      }
      stCol.stroke();
      stBmp.stroke();
    }

    // Fine sand/mineral speckle
    for (let i = 0; i < 3500; i++) {
      const px = rng() * stoneW;
      const py = rng() * stoneH;
      const v = rng() > 0.5 ? 210 : 35;
      stCol.fillStyle = `rgba(${v},${v - 15},${v - 25},0.16)`;
      stCol.fillRect(px, py, 2, 2);
      stBmp.fillStyle = `rgba(${v},${v},${v},0.22)`;
      stBmp.fillRect(px, py, 2, 2);
    }
  }

  // ---------------------------------------------------------------------------
  // 2. ARENA GROUND: COMPACTED QUARRY DIRT, PEBBLES & REFLECTIVE PUDDLES
  // ---------------------------------------------------------------------------
  const gSize = 512;
  const [gColC, gCol] = makeCanvas(gSize, gSize);
  const [gBmpC, gBmp] = makeCanvas(gSize, gSize);
  const [gRghC, gRgh] = makeCanvas(gSize, gSize);
  {
    const rng = mulberry32(202);
    gCol.fillStyle = '#735b43';
    gCol.fillRect(0, 0, gSize, gSize);
    gBmp.fillStyle = '#808080';
    gBmp.fillRect(0, 0, gSize, gSize);
    // High roughness for dry dust (~0.92 -> 235)
    gRgh.fillStyle = '#eaeaea';
    gRgh.fillRect(0, 0, gSize, gSize);

    // Broad earthy color variation blotches
    for (let i = 0; i < 160; i++) {
      const x = rng() * gSize;
      const y = rng() * gSize;
      const rad = 18 + rng() * 68;
      const grad = gCol.createRadialGradient(x, y, 2, x, y, rad);
      const tone = rng();
      if (tone < 0.35) {
        grad.addColorStop(0, 'rgba(155, 122, 86, 0.25)');
        grad.addColorStop(1, 'rgba(155, 122, 86, 0)');
      } else if (tone < 0.7) {
        grad.addColorStop(0, 'rgba(62, 46, 33, 0.28)');
        grad.addColorStop(1, 'rgba(62, 46, 33, 0)');
      } else {
        grad.addColorStop(0, 'rgba(105, 86, 68, 0.22)');
        grad.addColorStop(1, 'rgba(105, 86, 68, 0)');
      }
      gCol.fillStyle = grad;
      gCol.beginPath();
      gCol.arc(x, y, rad, 0, Math.PI * 2);
      gCol.fill();
    }

    // Tire ruts & combat scuff streaks horizontally across the arena
    for (let i = 0; i < 24; i++) {
      const y = rng() * gSize;
      const h = 4 + rng() * 14;
      gCol.fillStyle = `rgba(48, 35, 25, ${0.12 + rng() * 0.14})`;
      gCol.fillRect(0, y, gSize, h);
      gBmp.fillStyle = 'rgba(70, 70, 70, 0.32)';
      gBmp.fillRect(0, y, gSize, h);
    }

    // Pebbles & gravel grit
    for (let i = 0; i < 2400; i++) {
      const px = rng() * gSize;
      const py = rng() * gSize;
      const s = 1 + rng() * 3.5;
      const light = rng() > 0.45;
      gCol.fillStyle = light
        ? `rgba(182, 152, 118, ${0.22 + rng() * 0.3})`
        : `rgba(42, 32, 24, ${0.25 + rng() * 0.35})`;
      gCol.fillRect(px, py, s, s * 0.8);

      const bv = light ? 190 : 65;
      gBmp.fillStyle = `rgba(${bv},${bv},${bv},0.45)`;
      gBmp.fillRect(px, py, s, s * 0.8);
    }

    // Subtle damp muddy patches (darker albedo, smoother roughness catching sunset glare)
    for (let i = 0; i < 6; i++) {
      const px = 60 + rng() * (gSize - 120);
      const py = 60 + rng() * (gSize - 120);
      const rx = 24 + rng() * 44;
      const ry = 12 + rng() * 22;

      const cGrad = gCol.createRadialGradient(px, py, 2, px, py, rx);
      cGrad.addColorStop(0, 'rgba(34, 28, 24, 0.55)');
      cGrad.addColorStop(0.7, 'rgba(46, 38, 30, 0.3)');
      cGrad.addColorStop(1, 'rgba(46, 38, 30, 0)');
      gCol.save();
      gCol.translate(px, py);
      gCol.scale(1, ry / rx);
      gCol.translate(-px, -py);
      gCol.fillStyle = cGrad;
      gCol.beginPath();
      gCol.arc(px, py, rx, 0, Math.PI * 2);
      gCol.fill();

      // Smooth low-roughness puddle interior (roughness ~ 0.14 -> 36)
      const rGrad = gRgh.createRadialGradient(px, py, 2, px, py, rx * 0.85);
      rGrad.addColorStop(0, 'rgba(28, 28, 28, 0.92)');
      rGrad.addColorStop(0.65, 'rgba(70, 70, 70, 0.65)');
      rGrad.addColorStop(1, 'rgba(230, 230, 230, 0)');
      gRgh.fillStyle = rGrad;
      gRgh.beginPath();
      gRgh.arc(px, py, rx * 0.85, 0, Math.PI * 2);
      gRgh.fill();

      // Flatten bump inside puddle
      gBmp.fillStyle = 'rgba(128, 128, 128, 0.85)';
      gBmp.beginPath();
      gBmp.arc(px, py, rx * 0.72, 0, Math.PI * 2);
      gBmp.fill();
      gCol.restore();
    }
  }

  // ---------------------------------------------------------------------------
  // 2B. TWO-LANE KUTCHA UNPACKED QUARRY HAUL ROAD (U across width, V along road)
  // ---------------------------------------------------------------------------
  const krSize = 512;
  const [krColC, krCol] = makeCanvas(krSize, krSize);
  const [krBmpC, krBmp] = makeCanvas(krSize, krSize);
  const [krRghC, krRgh] = makeCanvas(krSize, krSize);
  {
    const rng = mulberry32(252);

    // Base warm packed kutcha soil / red-brown quarry earth
    krCol.fillStyle = '#826447';
    krCol.fillRect(0, 0, krSize, krSize);
    krBmp.fillStyle = '#8a8a8a';
    krBmp.fillRect(0, 0, krSize, krSize);
    krRgh.fillStyle = '#e8e8e8';
    krRgh.fillRect(0, 0, krSize, krSize);

    // Cross-section profile (x = 0..512 maps across road width: outer shoulders + 2 lanes + center crown)
    // Dusty loose gravel shoulders on both edges (0..0.11 and 0.89..1.0)
    const edgeGradL = krCol.createLinearGradient(0, 0, krSize * 0.14, 0);
    edgeGradL.addColorStop(0, '#5a4635');
    edgeGradL.addColorStop(0.55, '#9d7d59');
    edgeGradL.addColorStop(1, 'rgba(130, 100, 71, 0)');
    krCol.fillStyle = edgeGradL;
    krCol.fillRect(0, 0, krSize * 0.14, krSize);

    const edgeGradR = krCol.createLinearGradient(krSize, 0, krSize * 0.86, 0);
    edgeGradR.addColorStop(0, '#5a4635');
    edgeGradR.addColorStop(0.55, '#9d7d59');
    edgeGradR.addColorStop(1, 'rgba(130, 100, 71, 0)');
    krCol.fillStyle = edgeGradR;
    krCol.fillRect(krSize * 0.86, 0, krSize * 0.14, krSize);

    // Slightly raised dusty gravel center ridge separating left & right lanes (x ~ 0.44..0.56)
    const centerGrad = krCol.createLinearGradient(krSize * 0.43, 0, krSize * 0.57, 0);
    centerGrad.addColorStop(0, 'rgba(168, 138, 102, 0)');
    centerGrad.addColorStop(0.5, 'rgba(168, 138, 102, 0.58)');
    centerGrad.addColorStop(1, 'rgba(168, 138, 102, 0)');
    krCol.fillStyle = centerGrad;
    krCol.fillRect(krSize * 0.43, 0, krSize * 0.14, krSize);

    const centerBmp = krBmp.createLinearGradient(krSize * 0.43, 0, krSize * 0.57, 0);
    centerBmp.addColorStop(0, 'rgba(210, 210, 210, 0)');
    centerBmp.addColorStop(0.5, 'rgba(225, 225, 225, 0.72)');
    centerBmp.addColorStop(1, 'rgba(210, 210, 210, 0)');
    krBmp.fillStyle = centerBmp;
    krBmp.fillRect(krSize * 0.43, 0, krSize * 0.14, krSize);

    // Four compacted heavy mining-truck tire ruts (2 per side-by-side lane!)
    // Lane 1 centered at u = 0.25 -> wheel tracks at 0.155 and 0.345
    // Lane 2 centered at u = 0.75 -> wheel tracks at 0.655 and 0.845
    const rutCenters = [0.155, 0.345, 0.655, 0.845];
    for (const rc of rutCenters) {
      const cx = rc * krSize;
      const halfW = krSize * 0.052;
      const cGrad = krCol.createLinearGradient(cx - halfW, 0, cx + halfW, 0);
      cGrad.addColorStop(0, 'rgba(58, 42, 28, 0)');
      cGrad.addColorStop(0.35, 'rgba(54, 38, 25, 0.68)');
      cGrad.addColorStop(0.65, 'rgba(54, 38, 25, 0.68)');
      cGrad.addColorStop(1, 'rgba(58, 42, 28, 0)');
      krCol.fillStyle = cGrad;
      krCol.fillRect(cx - halfW, 0, halfW * 2, krSize);

      // Depressed groove in bump map + slightly smoother compacted soil in roughness map
      const bGrad = krBmp.createLinearGradient(cx - halfW, 0, cx + halfW, 0);
      bGrad.addColorStop(0, 'rgba(42, 42, 42, 0)');
      bGrad.addColorStop(0.5, 'rgba(34, 34, 34, 0.85)');
      bGrad.addColorStop(1, 'rgba(42, 42, 42, 0)');
      krBmp.fillStyle = bGrad;
      krBmp.fillRect(cx - halfW, 0, halfW * 2, krSize);

      const rGrad = krRgh.createLinearGradient(cx - halfW, 0, cx + halfW, 0);
      rGrad.addColorStop(0, 'rgba(180, 180, 180, 0)');
      rGrad.addColorStop(0.5, 'rgba(165, 165, 165, 0.55)');
      rGrad.addColorStop(1, 'rgba(180, 180, 180, 0)');
      krRgh.fillStyle = rGrad;
      krRgh.fillRect(cx - halfW, 0, halfW * 2, krSize);

      // Repeating heavy chevron tire tread impressions inside each rut
      krCol.fillStyle = 'rgba(40, 28, 19, 0.25)';
      krBmp.fillStyle = 'rgba(26, 26, 26, 0.35)';
      for (let ty = 0; ty < krSize; ty += 16) {
        krCol.fillRect(cx - halfW * 0.55, ty, halfW * 1.1, 5);
        krBmp.fillRect(cx - halfW * 0.55, ty, halfW * 1.1, 5);
      }
    }

    // Subtle transverse kutcha washboard dirt ripples & dusty patches
    for (let i = 0; i < 65; i++) {
      const y = rng() * krSize;
      const h = 3 + rng() * 9;
      krCol.fillStyle =
        rng() > 0.5
          ? `rgba(170, 138, 100, ${0.06 + rng() * 0.08})`
          : `rgba(52, 38, 26, ${0.06 + rng() * 0.09})`;
      krCol.fillRect(0, y, krSize, h);
    }

    // Crushed quarry gravel & loose stones concentrated on shoulders and center ridge
    for (let i = 0; i < 2800; i++) {
      const u = rng();
      const px = u * krSize;
      const py = rng() * krSize;
      const onRidgeOrEdge = u < 0.11 || u > 0.89 || (u > 0.44 && u < 0.56);
      const s = onRidgeOrEdge ? 1.5 + rng() * 4.2 : 1.0 + rng() * 2.2;
      const light = rng() > 0.45;
      krCol.fillStyle = light
        ? `rgba(196, 168, 132, ${onRidgeOrEdge ? 0.45 : 0.24})`
        : `rgba(46, 35, 26, ${onRidgeOrEdge ? 0.48 : 0.26})`;
      krCol.fillRect(px, py, s, s * 0.85);

      const bv = light ? 215 : 55;
      krBmp.fillStyle = `rgba(${bv},${bv},${bv},${onRidgeOrEdge ? 0.58 : 0.32})`;
      krBmp.fillRect(px, py, s, s * 0.85);
    }
  }

  // ---------------------------------------------------------------------------
  // 3. RUSTED CORRUGATED IRON (Industrial Shed Roof & Walls)
  // ---------------------------------------------------------------------------
  const corSize = 512;
  const [corColC, corCol] = makeCanvas(corSize, corSize);
  const [corBmpC, corBmp] = makeCanvas(corSize, corSize);
  const [corRghC, corRgh] = makeCanvas(corSize, corSize);
  {
    const rng = mulberry32(303);
    corCol.fillStyle = '#4a4744';
    corCol.fillRect(0, 0, corSize, corSize);
    corRgh.fillStyle = '#b4b4b4';
    corRgh.fillRect(0, 0, corSize, corSize);

    const ribs = 24;
    const ribW = corSize / ribs;
    for (let i = 0; i < ribs; i++) {
      const x = i * ribW;
      // Bump sine profile
      const bGrad = corBmp.createLinearGradient(x, 0, x + ribW, 0);
      bGrad.addColorStop(0, '#303030');
      bGrad.addColorStop(0.5, '#f0f0f0');
      bGrad.addColorStop(1, '#303030');
      corBmp.fillStyle = bGrad;
      corBmp.fillRect(x, 0, ribW + 0.5, corSize);

      // Albedo rib shading
      const cGrad = corCol.createLinearGradient(x, 0, x + ribW, 0);
      cGrad.addColorStop(0, '#363331');
      cGrad.addColorStop(0.5, '#686460');
      cGrad.addColorStop(1, '#363331');
      corCol.fillStyle = cGrad;
      corCol.fillRect(x, 0, ribW + 0.5, corSize);
    }

    // Sheet overlap horizontal seams
    for (let s = 1; s <= 3; s++) {
      const sy = (s * corSize) / 4;
      corCol.fillStyle = 'rgba(18, 14, 12, 0.65)';
      corCol.fillRect(0, sy, corSize, 3);
      corBmp.fillStyle = '#181818';
      corBmp.fillRect(0, sy, corSize, 3);
    }

    // Heavy orange-brown oxidation & rust streaks
    for (let i = 0; i < 240; i++) {
      const x = rng() * corSize;
      const y = rng() * corSize;
      const w = 6 + rng() * 34;
      const h = 14 + rng() * 95;
      const rustR = 115 + Math.floor(rng() * 55);
      const rustG = 48 + Math.floor(rng() * 34);
      const rustB = 22 + Math.floor(rng() * 18);
      corCol.fillStyle = `rgba(${rustR},${rustG},${rustB},${0.22 + rng() * 0.48})`;
      corCol.fillRect(x, y, w, h);

      // Rust is rougher than bare steel
      corRgh.fillStyle = `rgba(242, 242, 242, ${0.4 + rng() * 0.4})`;
      corRgh.fillRect(x, y, w, h);
    }
  }

  // ---------------------------------------------------------------------------
  // 4. WEATHERED TIMBER PLANKS (Crates, Watchtower Decks, Fence)
  // ---------------------------------------------------------------------------
  const wSize = 512;
  const [wdColC, wdCol] = makeCanvas(wSize, wSize);
  const [wdBmpC, wdBmp] = makeCanvas(wSize, wSize);
  {
    const rng = mulberry32(404);
    const planks = 6;
    const pH = wSize / planks;
    for (let i = 0; i < planks; i++) {
      const py = i * pH;
      const baseR = 92 + Math.floor(rng() * 36);
      const baseG = 66 + Math.floor(rng() * 26);
      const baseB = 42 + Math.floor(rng() * 18);
      wdCol.fillStyle = `rgb(${baseR},${baseG},${baseB})`;
      wdCol.fillRect(0, py, wSize, pH);
      wdBmp.fillStyle = `rgb(${120 + Math.floor(rng() * 30)},${120 + Math.floor(rng() * 30)},${120 + Math.floor(rng() * 30)})`;
      wdBmp.fillRect(0, py, wSize, pH);

      // Grain streaks
      for (let g = 0; g < 38; g++) {
        const gy = py + rng() * pH;
        const dark = rng() > 0.4;
        wdCol.fillStyle = dark
          ? `rgba(34, 22, 12, ${0.15 + rng() * 0.25})`
          : `rgba(175, 140, 96, ${0.1 + rng() * 0.16})`;
        wdCol.fillRect(0, gy, wSize, 1 + rng() * 2.5);
        wdBmp.fillStyle = dark ? 'rgba(65,65,65,0.35)' : 'rgba(185,185,185,0.28)';
        wdBmp.fillRect(0, gy, wSize, 1.5);
      }

      // Plank gap
      wdCol.fillStyle = '#1b120b';
      wdCol.fillRect(0, py, wSize, 3);
      wdBmp.fillStyle = '#141414';
      wdBmp.fillRect(0, py, wSize, 3);
    }

    // Dusty grime & nail heads
    for (let i = 0; i < planks; i++) {
      const py = i * pH + pH * 0.5;
      for (const nx of [22, wSize - 22]) {
        wdCol.fillStyle = '#241d19';
        wdCol.beginPath();
        wdCol.arc(nx, py, 4, 0, Math.PI * 2);
        wdCol.fill();
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 5. INDUSTRIAL WEATHERED DARK STEEL
  // ---------------------------------------------------------------------------
  const sSize = 256;
  const [stMetalColC, stMetalCol] = makeCanvas(sSize, sSize);
  const [stMetalBmpC, stMetalBmp] = makeCanvas(sSize, sSize);
  {
    const rng = mulberry32(505);
    stMetalCol.fillStyle = '#363536';
    stMetalCol.fillRect(0, 0, sSize, sSize);
    stMetalBmp.fillStyle = '#808080';
    stMetalBmp.fillRect(0, 0, sSize, sSize);

    for (let i = 0; i < 420; i++) {
      const x = rng() * sSize;
      const y = rng() * sSize;
      const w = 4 + rng() * 28;
      const h = 4 + rng() * 24;
      const isRust = rng() < 0.32;
      stMetalCol.fillStyle = isRust
        ? `rgba(128, 60, 28, ${0.18 + rng() * 0.35})`
        : `rgba(${60 + Math.floor(rng() * 55)}, ${58 + Math.floor(rng() * 50)}, ${56 + Math.floor(rng() * 48)}, 0.25)`;
      stMetalCol.fillRect(x, y, w, h);
      const bv = isRust ? 165 : 95 + Math.floor(rng() * 50);
      stMetalBmp.fillStyle = `rgba(${bv},${bv},${bv},0.35)`;
      stMetalBmp.fillRect(x, y, w, h);
    }
  }

  // ---------------------------------------------------------------------------
  // 6. YELLOW HEAVY MINING MACHINERY PAINT (Dump Trucks & Excavator)
  // ---------------------------------------------------------------------------
  const ySize = 256;
  const [ymColC, ymCol] = makeCanvas(ySize, ySize);
  const [ymBmpC, ymBmp] = makeCanvas(ySize, ySize);
  {
    const rng = mulberry32(606);
    ymCol.fillStyle = '#d39120';
    ymCol.fillRect(0, 0, ySize, ySize);
    ymBmp.fillStyle = '#888888';
    ymBmp.fillRect(0, 0, ySize, ySize);

    // Quarry dust coat along lower areas + paint chips revealing bare metal/rust
    const dustGrad = ymCol.createLinearGradient(0, ySize, 0, 0);
    dustGrad.addColorStop(0, 'rgba(130, 106, 80, 0.55)');
    dustGrad.addColorStop(0.45, 'rgba(130, 106, 80, 0.14)');
    dustGrad.addColorStop(1, 'rgba(130, 106, 80, 0)');
    ymCol.fillStyle = dustGrad;
    ymCol.fillRect(0, 0, ySize, ySize);

    for (let i = 0; i < 180; i++) {
      const x = rng() * ySize;
      const y = rng() * ySize;
      const w = 3 + rng() * 18;
      const h = 2 + rng() * 10;
      ymCol.fillStyle =
        rng() > 0.4
          ? `rgba(76, 52, 34, ${0.25 + rng() * 0.45})`
          : `rgba(54, 52, 50, ${0.3 + rng() * 0.4})`;
      ymCol.fillRect(x, y, w, h);
      ymBmp.fillStyle = 'rgba(40,40,40,0.45)';
      ymBmp.fillRect(x, y, w, h);
    }
  }

  // ---------------------------------------------------------------------------
  // 7. RED HAZARD OIL BARREL TEXTURE
  // ---------------------------------------------------------------------------
  const bSize = 256;
  const [brColC, brCol] = makeCanvas(bSize, bSize);
  const [brBmpC, brBmp] = makeCanvas(bSize, bSize);
  {
    const rng = mulberry32(707);
    brCol.fillStyle = '#921c18';
    brCol.fillRect(0, 0, bSize, bSize);
    brBmp.fillStyle = '#808080';
    brBmp.fillRect(0, 0, bSize, bSize);

    // Subtle white/off-white industrial stencil center stripe
    brCol.fillStyle = '#dfd5c3';
    brCol.fillRect(0, bSize * 0.41, bSize, bSize * 0.18);

    // Stencil text "FUEL" / "OIL"
    brCol.fillStyle = '#251a16';
    brCol.font = 'bold 24px monospace';
    brCol.textAlign = 'center';
    brCol.textBaseline = 'middle';
    brCol.fillText('OIL', bSize * 0.25, bSize * 0.5);
    brCol.fillText('HAZARD', bSize * 0.72, bSize * 0.5);

    // Drum rolling ribs
    for (const ry of [bSize * 0.3, bSize * 0.7]) {
      brCol.fillStyle = 'rgba(20, 8, 6, 0.42)';
      brCol.fillRect(0, ry - 5, bSize, 10);
      brBmp.fillStyle = '#f2f2f2';
      brBmp.fillRect(0, ry - 4, bSize, 8);
    }

    // Grime, soot & rust scuffs
    for (let i = 0; i < 190; i++) {
      const x = rng() * bSize;
      const y = rng() * bSize;
      const w = 3 + rng() * 18;
      const h = 3 + rng() * 20;
      brCol.fillStyle =
        rng() > 0.35
          ? `rgba(42, 24, 16, ${0.18 + rng() * 0.38})`
          : `rgba(145, 72, 34, ${0.22 + rng() * 0.35})`;
      brCol.fillRect(x, y, w, h);
    }
  }

  // ---------------------------------------------------------------------------
  // 8. BURLAP SANDBAG TEXTURE
  // ---------------------------------------------------------------------------
  const sbSize = 256;
  const [sbColC, sbCol] = makeCanvas(sbSize, sbSize);
  const [sbBmpC, sbBmp] = makeCanvas(sbSize, sbSize);
  {
    const rng = mulberry32(808);
    sbCol.fillStyle = '#a48966';
    sbCol.fillRect(0, 0, sbSize, sbSize);
    sbBmp.fillStyle = '#808080';
    sbBmp.fillRect(0, 0, sbSize, sbSize);

    // Crosshatch woven burlap threads
    for (let i = 0; i < sbSize; i += 4) {
      sbCol.fillStyle = i % 8 === 0 ? 'rgba(65, 48, 30, 0.22)' : 'rgba(215, 192, 152, 0.16)';
      sbCol.fillRect(0, i, sbSize, 2);
      sbCol.fillRect(i, 0, 2, sbSize);

      sbBmp.fillStyle = i % 8 === 0 ? 'rgba(55,55,55,0.45)' : 'rgba(195,195,195,0.45)';
      sbBmp.fillRect(0, i, sbSize, 2);
      sbBmp.fillRect(i, 0, 2, sbSize);
    }

    for (let i = 0; i < 120; i++) {
      sbCol.fillStyle = `rgba(60, 44, 28, ${0.1 + rng() * 0.18})`;
      sbCol.fillRect(rng() * sbSize, rng() * sbSize, 8 + rng() * 22, 8 + rng() * 22);
    }
  }

  // ---------------------------------------------------------------------------
  // 9. DEEP RED KGF CROSSED-PICKAXES WATCHTOWER BANNER
  // ---------------------------------------------------------------------------
  const banW = 256;
  const banH = 512;
  const [banC, ban] = makeCanvas(banW, banH);
  {
    const rng = mulberry32(909);
    // Deep crimson cloth base
    const grad = ban.createLinearGradient(0, 0, 0, banH);
    grad.addColorStop(0, '#6a1212');
    grad.addColorStop(0.5, '#8a1717');
    grad.addColorStop(1, '#581010');
    ban.fillStyle = grad;
    ban.fillRect(0, 0, banW, banH);

    // Gold/ochre weathered inner trim border
    ban.strokeStyle = 'rgba(210, 165, 92, 0.55)';
    ban.lineWidth = 6;
    ban.strokeRect(18, 18, banW - 36, banH - 80);

    // Crossed mining pickaxes emblem (matching Panels A, B, D!)
    ban.save();
    ban.translate(banW * 0.5, banH * 0.43);

    const drawPickaxe = (angle: number) => {
      ban.save();
      ban.rotate(angle);
      // Wooden/cream handle
      ban.fillStyle = '#e5d4b4';
      ban.fillRect(-7, -86, 14, 178);
      // Curved double-pointed pick head
      ban.beginPath();
      ban.moveTo(-66, -42);
      ban.quadraticCurveTo(0, -86, 66, -42);
      ban.quadraticCurveTo(0, -60, -66, -42);
      ban.closePath();
      ban.fillStyle = '#efe2c6';
      ban.fill();
      // Center socket collar
      ban.fillStyle = '#c8b08a';
      ban.fillRect(-13, -68, 26, 20);
      ban.restore();
    };

    drawPickaxe(Math.PI / 4.2);
    drawPickaxe(-Math.PI / 4.2);
    ban.restore();

    // Cloth weave & quarry grime/soot weathering
    for (let y = 0; y < banH; y += 4) {
      ban.fillStyle = 'rgba(0,0,0,0.06)';
      ban.fillRect(0, y, banW, 1);
    }
    for (let i = 0; i < 240; i++) {
      ban.fillStyle = `rgba(24, 16, 12, ${0.08 + rng() * 0.22})`;
      ban.fillRect(rng() * banW, rng() * banH, 4 + rng() * 24, 6 + rng() * 34);
    }
    // Lower edge soot
    const botGrad = ban.createLinearGradient(0, banH * 0.65, 0, banH);
    botGrad.addColorStop(0, 'rgba(18,12,8,0)');
    botGrad.addColorStop(1, 'rgba(18,12,8,0.65)');
    ban.fillStyle = botGrad;
    ban.fillRect(0, banH * 0.65, banW, banH * 0.35);
  }

  // ---------------------------------------------------------------------------
  // 10. SOFT SMOKE / DUST PUFF SPRITE & CONTACT SHADOW & SCORCH DECAL
  // ---------------------------------------------------------------------------
  const [smkC, smk] = makeCanvas(128, 128);
  {
    const rng = mulberry32(1010);
    smk.clearRect(0, 0, 128, 128);
    for (let i = 0; i < 14; i++) {
      const cx = 64 + (rng() - 0.5) * 34;
      const cy = 64 + (rng() - 0.5) * 34;
      const r = 20 + rng() * 28;
      const g = smk.createRadialGradient(cx, cy, 2, cx, cy, r);
      g.addColorStop(0, 'rgba(255,255,255,0.42)');
      g.addColorStop(0.55, 'rgba(255,255,255,0.18)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      smk.fillStyle = g;
      smk.beginPath();
      smk.arc(cx, cy, r, 0, Math.PI * 2);
      smk.fill();
    }
  }

  const [shdC, shd] = makeCanvas(128, 128);
  {
    const g = shd.createRadialGradient(64, 64, 6, 64, 64, 62);
    g.addColorStop(0, 'rgba(0,0,0,0.75)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.32)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    shd.fillStyle = g;
    shd.fillRect(0, 0, 128, 128);
  }

  const [scrC, scr] = makeCanvas(128, 128);
  {
    const rng = mulberry32(1111);
    const g = scr.createRadialGradient(64, 64, 4, 64, 64, 60);
    g.addColorStop(0, 'rgba(12, 9, 8, 0.92)');
    g.addColorStop(0.45, 'rgba(28, 18, 12, 0.72)');
    g.addColorStop(0.8, 'rgba(42, 24, 14, 0.25)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    scr.fillStyle = g;
    scr.fillRect(0, 0, 128, 128);
    // Radial blast streaks
    scr.strokeStyle = 'rgba(15, 10, 8, 0.55)';
    for (let i = 0; i < 24; i++) {
      const a = rng() * Math.PI * 2;
      const r1 = 10 + rng() * 14;
      const r2 = 34 + rng() * 26;
      scr.lineWidth = 1.5 + rng() * 3;
      scr.beginPath();
      scr.moveTo(64 + Math.cos(a) * r1, 64 + Math.sin(a) * r1);
      scr.lineTo(64 + Math.cos(a) * r2, 64 + Math.sin(a) * r2);
      scr.stroke();
    }
  }

  return {
    stoneColor: reg(configureTexture(stColC, true, maxAnisotropy, 6, 3)),
    stoneBump: reg(configureTexture(stBmpC, false, maxAnisotropy, 6, 3)),
    stoneRoughness: reg(configureTexture(stRghC, false, maxAnisotropy, 6, 3)),

    groundColor: reg(configureTexture(gColC, true, maxAnisotropy, 8, 6)),
    groundBump: reg(configureTexture(gBmpC, false, maxAnisotropy, 8, 6)),
    groundRoughness: reg(configureTexture(gRghC, false, maxAnisotropy, 8, 6)),

    kutchaRoadColor: reg(configureTexture(krColC, true, maxAnisotropy, 1, 1)),
    kutchaRoadBump: reg(configureTexture(krBmpC, false, maxAnisotropy, 1, 1)),
    kutchaRoadRoughness: reg(configureTexture(krRghC, false, maxAnisotropy, 1, 1)),

    corrugatedColor: reg(configureTexture(corColC, true, maxAnisotropy, 3, 2)),
    corrugatedBump: reg(configureTexture(corBmpC, false, maxAnisotropy, 3, 2)),
    corrugatedRoughness: reg(configureTexture(corRghC, false, maxAnisotropy, 3, 2)),

    woodColor: reg(configureTexture(wdColC, true, maxAnisotropy, 1, 1)),
    woodBump: reg(configureTexture(wdBmpC, false, maxAnisotropy, 1, 1)),

    steelColor: reg(configureTexture(stMetalColC, true, maxAnisotropy, 2, 2)),
    steelBump: reg(configureTexture(stMetalBmpC, false, maxAnisotropy, 2, 2)),

    yellowMachineryColor: reg(configureTexture(ymColC, true, maxAnisotropy, 1, 1)),
    yellowMachineryBump: reg(configureTexture(ymBmpC, false, maxAnisotropy, 1, 1)),

    barrelColor: reg(configureTexture(brColC, true, maxAnisotropy, 1, 1)),
    barrelBump: reg(configureTexture(brBmpC, false, maxAnisotropy, 1, 1)),

    sandbagColor: reg(configureTexture(sbColC, true, maxAnisotropy, 2, 2)),
    sandbagBump: reg(configureTexture(sbBmpC, false, maxAnisotropy, 2, 2)),

    bannerColor: reg(configureTexture(banC, true, maxAnisotropy, 1, 1, true)),

    smokeSprite: reg(configureTexture(smkC, true, maxAnisotropy, 1, 1, true)),
    contactShadow: reg(configureTexture(shdC, true, maxAnisotropy, 1, 1, true)),
    scorchDecal: reg(configureTexture(scrC, true, maxAnisotropy, 1, 1, true)),

    dispose: () => {
      allTextures.forEach((t) => t.dispose());
    },
  };
}
