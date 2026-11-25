import * as THREE from 'three';
import type { QuarryMaterialLibrary } from './materials';

export interface QuarryLightingRig {
  sunLight: THREE.DirectionalLight;
  fillRimLight: THREE.DirectionalLight;
  hemiLight: THREE.HemisphereLight;
  floodlightSpot: THREE.SpotLight;
  leftTowerPoint: THREE.PointLight;
  shedPoint: THREE.PointLight;
  centerFillPoint: THREE.PointLight;
  explosionFlashLight: THREE.PointLight;
  skyMesh: THREE.Mesh;
  dustParticles: THREE.Points;
  update: (
    sunElevation: number,
    elapsed: number,
    delta: number,
    generatorFlicker: number,
  ) => void;
  triggerExplosionFlash: (pos: THREE.Vector3, intensity?: number) => void;
  dispose: () => void;
}

const SKY_VERTEX_SHADER = `
  varying vec3 vWorldDir;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldDir = normalize(worldPos.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const SKY_FRAGMENT_SHADER = `
  uniform vec3 uZenithColor;
  uniform vec3 uHorizonColor;
  uniform vec3 uGroundColor;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uSunDiscSize;
  uniform float uSunIntensity;
  uniform float uTime;
  uniform float uCloudDensity;
  varying vec3 vWorldDir;

  // Compact procedural fbm for atmospheric dust clouds
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      v += amp * noise(p);
      p *= 2.06;
      amp *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 dir = normalize(vWorldDir);
    float h = dir.y;

    // Sky vertical gradient
    float horizonMix = pow(clamp(1.0 - max(h, 0.0), 0.0, 1.0), 2.2);
    vec3 col = mix(uZenithColor, uHorizonColor, horizonMix);
    if (h < 0.0) {
      col = mix(uHorizonColor, uGroundColor, clamp(-h * 4.5, 0.0, 1.0));
    }

    // Sun glow + crisp golden disc (visible in quarry notch at evening)
    vec3 sunDir = normalize(uSunDir);
    float sunDot = max(dot(dir, sunDir), 0.0);
    float halo = pow(sunDot, 10.0) * 0.52 * uSunIntensity;
    float tightGlow = pow(sunDot, 96.0) * 0.85 * uSunIntensity;
    float disc = smoothstep(uSunDiscSize, uSunDiscSize + 0.0022, sunDot) * 2.2 * uSunIntensity;
    col += uSunColor * (halo + tightGlow + disc);

    // Drifting quarry clouds lit along their undersides by the sun
    if (h > 0.015) {
      vec2 cloudUv = dir.xz / (h + 0.22) * 1.15 + vec2(uTime * 0.008, uTime * 0.003);
      float c = fbm(cloudUv * 2.1);
      float cMask = smoothstep(0.46, 0.82, c) * smoothstep(0.015, 0.16, h) * smoothstep(0.92, 0.35, h) * uCloudDensity;
      vec3 cloudShadow = mix(uZenithColor * 0.55, uHorizonColor * 0.72, 0.45);
      vec3 cloudLit = mix(uHorizonColor * 1.15, uSunColor * 1.25, pow(sunDot, 3.0) * 0.85);
      vec3 cloudCol = mix(cloudShadow, cloudLit, smoothstep(0.35, 0.8, c + pow(sunDot, 4.0) * 0.45));
      col = mix(col, cloudCol, cMask * 0.72);
    }

    gl_FragColor = vec4(col, 1.0);
  }
`;

// Reusable color helpers to avoid per-frame GC
const _zenithEvening = new THREE.Color(0x282735);
const _horizonEvening = new THREE.Color(0xc97b45);
const _groundEvening = new THREE.Color(0x251a14);
const _sunEvening = new THREE.Color(0xffa748);
const _fogEvening = new THREE.Color(0x7c5338);

const _zenithDay = new THREE.Color(0x5d7c99);
const _horizonDay = new THREE.Color(0xdcc09b);
const _groundDay = new THREE.Color(0x524234);
const _sunDay = new THREE.Color(0xfff1d2);
const _fogDay = new THREE.Color(0xb89b7a);

const _zenithNight = new THREE.Color(0x090b14);
const _horizonNight = new THREE.Color(0x1f2230);
const _groundNight = new THREE.Color(0x0b0908);
const _sunNight = new THREE.Color(0x5a739c);
const _fogNight = new THREE.Color(0x161720);

const _zenithOut = new THREE.Color();
const _horizonOut = new THREE.Color();
const _groundOut = new THREE.Color();
const _sunOut = new THREE.Color();
const _fogOut = new THREE.Color();
const _hemiSkyOut = new THREE.Color();
const _hemiGroundOut = new THREE.Color();
const _sunDir = new THREE.Vector3();

export function createSkyAndLighting(
  scene: THREE.Scene,
  materials: QuarryMaterialLibrary,
  smokeSprite: THREE.Texture,
  isSoftwareGl: boolean,
): QuarryLightingRig {
  const skyUniforms = {
    uZenithColor: { value: _zenithEvening.clone() },
    uHorizonColor: { value: _horizonEvening.clone() },
    uGroundColor: { value: _groundEvening.clone() },
    uSunDir: { value: new THREE.Vector3(0.06, 0.19, -0.98).normalize() },
    uSunColor: { value: _sunEvening.clone() },
    uSunDiscSize: { value: 0.9968 },
    uSunIntensity: { value: 1.0 },
    uTime: { value: 0 },
    uCloudDensity: { value: 0.92 },
  };

  const skyGeo = new THREE.SphereGeometry(280, 32, 20);
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERTEX_SHADER,
    fragmentShader: SKY_FRAGMENT_SHADER,
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  skyMesh.frustumCulled = false;
  scene.add(skyMesh);

  // Horizon-matched atmospheric dust fog
  scene.fog = new THREE.FogExp2(_fogEvening.getHex(), 0.0092);

  // Key directional Sun Light (with tight shadow frustum covering the playable arena & flanking landmarks)
  const sunLight = new THREE.DirectionalLight(0xffaa56, 3.0);
  sunLight.position.set(5, 18, -68);
  sunLight.target.position.set(0, 0, 0);
  sunLight.castShadow = !isSoftwareGl;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 155;
  sunLight.shadow.camera.left = -28;
  sunLight.shadow.camera.right = 28;
  sunLight.shadow.camera.top = 22;
  sunLight.shadow.camera.bottom = -16;
  sunLight.shadow.bias = -0.0005;
  sunLight.shadow.normalBias = 0.035;
  scene.add(sunLight);
  scene.add(sunLight.target);

  // Warm/Cool sky-ground HemisphereLight fill
  const hemiLight = new THREE.HemisphereLight(0x7c8ea8, 0x5c3e26, 0.85);
  scene.add(hemiLight);

  // Subtle front-left cool/warm rim fill so front faces of arena props read crisply even with backlit sunset
  const fillRimLight = new THREE.DirectionalLight(0xd4a478, 0.95);
  fillRimLight.position.set(-14, 14, 24);
  fillRimLight.target.position.set(0, 1, -2);
  scene.add(fillRimLight);
  scene.add(fillRimLight.target);

  // Industrial Arena Floodlight (right-side quad pole casting warm pool across right arena)
  const floodlightSpot = new THREE.SpotLight(0xffba5c, 42, 46, Math.PI / 3.1, 0.58, 1.35);
  floodlightSpot.position.set(10.2, 6.8, -5.6);
  floodlightSpot.target.position.set(2.5, 0, 1.5);
  floodlightSpot.castShadow = false; // keep <= 1 shadow caster for smooth FPS
  scene.add(floodlightSpot);
  scene.add(floodlightSpot.target);

  // Left Watchtower Dual Eaves Floodlights
  const leftTowerPoint = new THREE.PointLight(0xffb44c, 26, 28, 1.5);
  leftTowerPoint.position.set(-13.8, 7.6, -2.8);
  scene.add(leftTowerPoint);

  // Right Corrugated Shed Warm Hanging Pendants
  const shedPoint = new THREE.PointLight(0xff9b35, 24, 22, 1.55);
  shedPoint.position.set(13.8, 3.8, 1.2);
  scene.add(shedPoint);

  // Mid-arena subtle dusty bounce fill
  const centerFillPoint = new THREE.PointLight(0xffaa55, 8, 22, 1.8);
  centerFillPoint.position.set(-4.5, 3.6, -7.2);
  scene.add(centerFillPoint);

  // Dynamic explosion flash point light (dormant until hazard detonation)
  const explosionFlashLight = new THREE.PointLight(0xff7722, 0, 26, 1.5);
  explosionFlashLight.position.set(0, 2, 0);
  scene.add(explosionFlashLight);

  let flashIntensity = 0;

  // Ambient floating sunlit quarry dust motes across the fighting arena
  const dustCount = 240;
  const dustPositions = new Float32Array(dustCount * 3);
  const dustPhases = new Float32Array(dustCount);
  for (let i = 0; i < dustCount; i++) {
    dustPositions[i * 3] = (Math.random() - 0.5) * 44;
    dustPositions[i * 3 + 1] = 0.4 + Math.random() * 8.5;
    dustPositions[i * 3 + 2] = -14 + Math.random() * 24;
    dustPhases[i] = Math.random() * Math.PI * 2;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dustMat = new THREE.PointsMaterial({
    map: smokeSprite,
    color: 0xf4c38a,
    size: 0.42,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
  const dustParticles = new THREE.Points(dustGeo, dustMat);
  dustParticles.frustumCulled = false;
  scene.add(dustParticles);

  const update = (
    sunElevation: number,
    elapsed: number,
    delta: number,
    generatorFlicker: number,
  ) => {
    skyUniforms.uTime.value = elapsed;

    // sunElevation in [0, 1]:
    // 0.00 -> Night (moonlit / floodlit)
    // 0.24 -> Golden Sunset Evening (exact Panel A mood)
    // 0.88 -> Harsh Dusty Midday
    const elev = THREE.MathUtils.clamp(sunElevation, 0, 1);

    let lampFactor = 1.0;
    if (elev < 0.24) {
      // Blend Night (0) -> Evening (0.24)
      const t = elev / 0.24;
      _zenithOut.copy(_zenithNight).lerp(_zenithEvening, t);
      _horizonOut.copy(_horizonNight).lerp(_horizonEvening, t);
      _groundOut.copy(_groundNight).lerp(_groundEvening, t);
      _sunOut.copy(_sunNight).lerp(_sunEvening, t);
      _fogOut.copy(_fogNight).lerp(_fogEvening, t);

      skyUniforms.uSunIntensity.value = THREE.MathUtils.lerp(0.18, 1.05, t);
      skyUniforms.uSunDiscSize.value = THREE.MathUtils.lerp(0.9982, 0.9966, t);
      skyUniforms.uCloudDensity.value = THREE.MathUtils.lerp(0.45, 0.92, t);

      sunLight.intensity = THREE.MathUtils.lerp(0.65, 3.1, t);
      sunLight.color.copy(_sunOut);
      fillRimLight.intensity = THREE.MathUtils.lerp(0.32, 0.95, t);
      fillRimLight.color.setHex(t < 0.4 ? 0x62779c : 0xd4a478);

      _hemiSkyOut.setHex(0x3a4866).lerp(new THREE.Color(0x8a95ad), t);
      _hemiGroundOut.setHex(0x1d1712).lerp(new THREE.Color(0x634128), t);
      hemiLight.color.copy(_hemiSkyOut);
      hemiLight.groundColor.copy(_hemiGroundOut);
      hemiLight.intensity = THREE.MathUtils.lerp(0.45, 0.88, t);

      lampFactor = THREE.MathUtils.lerp(1.65, 1.05, t);
      dustMat.color.setHex(t < 0.35 ? 0x8ea0ba : 0xf4c38a);
      dustMat.opacity = THREE.MathUtils.lerp(0.18, 0.3, t);
    } else {
      // Blend Evening (0.24) -> Harsh Dusty Day (1.0)
      const t = (elev - 0.24) / 0.76;
      _zenithOut.copy(_zenithEvening).lerp(_zenithDay, t);
      _horizonOut.copy(_horizonEvening).lerp(_horizonDay, t);
      _groundOut.copy(_groundEvening).lerp(_groundDay, t);
      _sunOut.copy(_sunEvening).lerp(_sunDay, t);
      _fogOut.copy(_fogEvening).lerp(_fogDay, t);

      skyUniforms.uSunIntensity.value = THREE.MathUtils.lerp(1.05, 0.88, t);
      skyUniforms.uSunDiscSize.value = THREE.MathUtils.lerp(0.9966, 0.9985, t);
      skyUniforms.uCloudDensity.value = THREE.MathUtils.lerp(0.92, 0.55, t);

      sunLight.intensity = THREE.MathUtils.lerp(3.1, 3.6, t);
      sunLight.color.copy(_sunOut);
      fillRimLight.intensity = THREE.MathUtils.lerp(0.95, 1.3, t);
      fillRimLight.color.setHex(0xe8d5b8);

      _hemiSkyOut.setHex(0x8a95ad).lerp(new THREE.Color(0xaec6dc), t);
      _hemiGroundOut.setHex(0x634128).lerp(new THREE.Color(0x8f7455), t);
      hemiLight.color.copy(_hemiSkyOut);
      hemiLight.groundColor.copy(_hemiGroundOut);
      hemiLight.intensity = THREE.MathUtils.lerp(0.88, 1.15, t);

      lampFactor = THREE.MathUtils.lerp(1.05, 0.22, t);
      dustMat.color.setHex(0xe6ccb0);
      dustMat.opacity = THREE.MathUtils.lerp(0.3, 0.22, t);
    }

    // Position the sun right over the distant quarry notch at evening (elev=0.24 -> pitch ~12 deg)
    const pitch = THREE.MathUtils.lerp(0.08, 1.08, elev);
    const azimuth = THREE.MathUtils.lerp(-0.08, 0.42, elev);
    _sunDir
      .set(
        Math.sin(azimuth) * Math.cos(pitch),
        Math.sin(pitch),
        -Math.cos(azimuth) * Math.cos(pitch),
      )
      .normalize();

    skyUniforms.uZenithColor.value.copy(_zenithOut);
    skyUniforms.uHorizonColor.value.copy(_horizonOut);
    skyUniforms.uGroundColor.value.copy(_groundOut);
    skyUniforms.uSunColor.value.copy(_sunOut);
    skyUniforms.uSunDir.value.copy(_sunDir);

    sunLight.position.copy(_sunDir).multiplyScalar(78);

    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.color.copy(_fogOut);
      scene.fog.density = elev < 0.24 ? 0.0105 : THREE.MathUtils.lerp(0.0092, 0.0068, (elev - 0.24) / 0.76);
    }

    // Industrial floodlights + generator flicker effect
    const flicker =
      generatorFlicker > 0
        ? Math.random() > 0.45
          ? 0.15
          : 1.4
        : 1.0 + Math.sin(elapsed * 11.0) * 0.015;

    floodlightSpot.intensity = 44 * lampFactor * flicker;
    leftTowerPoint.intensity = 28 * lampFactor;
    shedPoint.intensity = 26 * lampFactor * (0.96 + Math.sin(elapsed * 6.5) * 0.04);
    centerFillPoint.intensity = 10 * lampFactor;

    materials.emissiveFloodlight.emissiveIntensity = 3.2 * lampFactor * flicker;
    materials.emissivePendant.emissiveIntensity = 2.8 * lampFactor;
    materials.emissiveBeacon.emissiveIntensity = 1.6 + Math.sin(elapsed * 8.0) * 1.2;

    // Decay explosion flash light
    if (flashIntensity > 0.05) {
      flashIntensity = THREE.MathUtils.damp(flashIntensity, 0, 8.5, delta);
      explosionFlashLight.intensity = flashIntensity;
    } else if (explosionFlashLight.intensity > 0) {
      explosionFlashLight.intensity = 0;
    }

    // Drift sunlit dust motes smoothly across the arena
    const posAttr = dustGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < dustCount; i++) {
      let x = posAttr.getX(i) + delta * 0.55;
      if (x > 22) x = -22;
      const y = posAttr.getY(i) + Math.sin(elapsed * 0.7 + dustPhases[i]) * delta * 0.12;
      posAttr.setXY(i, x, y);
    }
    posAttr.needsUpdate = true;
  };

  const triggerExplosionFlash = (pos: THREE.Vector3, intensity = 95) => {
    explosionFlashLight.position.set(pos.x, pos.y + 1.8, pos.z);
    flashIntensity = intensity;
    explosionFlashLight.intensity = intensity;
  };

  const dispose = () => {
    skyGeo.dispose();
    skyMat.dispose();
    dustGeo.dispose();
    dustMat.dispose();
  };

  return {
    sunLight,
    fillRimLight,
    hemiLight,
    floodlightSpot,
    leftTowerPoint,
    shedPoint,
    centerFillPoint,
    explosionFlashLight,
    skyMesh,
    dustParticles,
    update,
    triggerExplosionFlash,
    dispose,
  };
}
