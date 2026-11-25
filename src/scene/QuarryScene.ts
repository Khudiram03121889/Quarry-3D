import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createQuarryTextures } from './textures';
import { createQuarryMaterials } from './materials';
import { createSkyAndLighting } from './skyAndLighting';
import { createTerrainAndCliffs } from './terrainAndCliffs';
import { createQuarryStructures } from './structures';
import { createQuarryVehicles } from './vehicles';
import { createQuarryHazards } from './hazards';
import { QuarryAudioEngine } from './audio';
import type { CameraPresetId, HazardTelemetry } from './types';

interface CameraPreset {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

// Camera presets calibrated directly to Panels A, B, C, D & Map Overview of the design sheet!
const CAMERA_PRESETS: Record<CameraPresetId, CameraPreset> = {
  // Panel A: Front View (In-Game 16:9 Fighting Game Camera)
  front: {
    position: [0.2, 4.1, 18.8],
    target: [0.0, 3.2, -5.0],
    fov: 46,
  },
  // Panel B: Left Side Angle (Perspective View toward Watchtower, Stairs & KGF Banner)
  left: {
    position: [-2.8, 3.8, 12.6],
    target: [-13.5, 4.6, -4.2],
    fov: 48,
  },
  // Panel C: Right Side Angle (Perspective View toward Industrial Shed, Hanging Lamps & Floodlights)
  right: {
    position: [2.4, 3.6, 12.2],
    target: [12.4, 3.2, -1.6],
    fov: 48,
  },
  // Panel D: Depth / 3/4 Establishing View showing entire quarry basin, conveyor & winding haul roads
  depth: {
    position: [-19.5, 11.4, 16.5],
    target: [1.5, 2.2, -10.0],
    fov: 46,
  },
  // Map Overview (Top View — ~36m x 15m arena layout)
  top: {
    position: [0.0, 34.5, 8.5],
    target: [0.0, 0.0, -2.5],
    fov: 46,
  },
};

export interface QuarrySceneCallbacks {
  onTelemetryChange: (telemetry: HazardTelemetry) => void;
  onContextLostChange?: (lost: boolean) => void;
}

export class QuarrySceneController {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private isSoftwareGl: boolean;
  private audio: QuarryAudioEngine;

  private lighting: ReturnType<typeof createSkyAndLighting>;
  private terrain: ReturnType<typeof createTerrainAndCliffs>;
  private structures: ReturnType<typeof createQuarryStructures>;
  private vehicles: ReturnType<typeof createQuarryVehicles>;
  private hazards: ReturnType<typeof createQuarryHazards>;
  private textures: ReturnType<typeof createQuarryTextures>;
  private materials: ReturnType<typeof createQuarryMaterials>;
  private envRenderTarget: THREE.WebGLRenderTarget | null = null;

  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private pointerDownPos = new THREE.Vector2();
  private lastHoverRaycast = 0;

  // Smooth exponential camera preset transition state
  private transitioning = false;
  private targetCamPos = new THREE.Vector3();
  private targetLookAt = new THREE.Vector3();
  private targetFov = 46;

  // Dynamic settings
  private sunElevation = 0.24; // Default: Golden Sunset Evening (Panel A)
  private currentSunElevation = 0.24;
  private truckSpeed = 1.0;

  // Impact camera shake state
  private shakeMagnitude = 0;
  private shakeOffset = new THREE.Vector3();

  // Loop & lifecycle
  private clock = new THREE.Clock();
  private frameId = 0;
  private disposed = false;

  constructor(container: HTMLElement, callbacks: QuarrySceneCallbacks) {
    this.container = container;

    // 1. Detect software WebGL (SwiftShader / llvmpipe / WARP) from GPU renderer string
    this.isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 2. Modern WebGLRenderer with ACESFilmicToneMapping & sRGB pipeline
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2),
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    // 3. Scene + Procedural Studio Environment Reflection (RoomEnvironment PMREM)
    this.scene = new THREE.Scene();
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.envRenderTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRenderTarget.texture;
    this.scene.environmentIntensity = 0.42;
    pmremGenerator.dispose();

    // 4. Camera initialized to iconic Panel A Front In-Game View
    const initial = CAMERA_PRESETS.front;
    this.camera = new THREE.PerspectiveCamera(initial.fov, width / height, 0.25, 420);
    this.camera.position.set(...initial.position);

    // 5. OrbitControls with generous arena inspection bounds
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.06;
    this.controls.target.set(...initial.target);
    this.controls.minDistance = 6;
    this.controls.maxDistance = 62;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.04; // Never clip below arena dirt
    this.controls.update();

    // Cancel scripted camera transition immediately when user grabs the viewport
    this.controls.addEventListener('start', () => {
      this.transitioning = false;
    });

    // Restrict raycaster to Layer 1 (invisible destructible hazard proxies)
    this.raycaster.layers.set(1);

    // 6. Build 100% procedural textures, PBR materials, sky, terrain, structures, vehicles & hazards
    this.audio = new QuarryAudioEngine();
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createQuarryTextures(maxAniso);
    this.materials = createQuarryMaterials(this.textures, this.isSoftwareGl);

    this.lighting = createSkyAndLighting(
      this.scene,
      this.materials,
      this.textures.smokeSprite,
      this.isSoftwareGl,
    );
    this.terrain = createTerrainAndCliffs(this.materials);
    this.scene.add(this.terrain.group);

    this.structures = createQuarryStructures(this.materials, this.textures.smokeSprite);
    this.scene.add(this.structures.group);

    this.vehicles = createQuarryVehicles(this.materials, this.textures.smokeSprite);
    this.scene.add(this.vehicles.group);

    this.hazards = createQuarryHazards(
      this.materials,
      this.textures.smokeSprite,
      this.audio,
      (pos, shake, flash) => {
        this.shakeMagnitude = Math.max(this.shakeMagnitude, shake);
        if (flash > 0) {
          this.lighting.triggerExplosionFlash(pos, flash);
        }
      },
      callbacks.onTelemetryChange,
    );
    this.scene.add(this.hazards.group);

    // Emit initial telemetry once built
    callbacks.onTelemetryChange(this.hazards.getTelemetry());

    // Pre-warm shaders on hardware GPUs
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // 7. Attach DOM & WebGL context listeners
    window.addEventListener('resize', this.handleResize);
    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.addEventListener('pointermove', this.handlePointerMove);
    this.renderer.domElement.addEventListener('pointerup', this.handlePointerUp);
    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      callbacks.onContextLostChange?.(true);
    });
    this.renderer.domElement.addEventListener('webglcontextrestored', () => {
      callbacks.onContextLostChange?.(false);
    });

    // 8. Kick off continuous paced animation loop
    this.clock.start();
    this.tick();
  }

  public setCameraPreset(presetId: CameraPresetId) {
    const preset = CAMERA_PRESETS[presetId];
    if (!preset) return;
    this.targetCamPos.set(...preset.position);
    this.targetLookAt.set(...preset.target);
    this.targetFov = preset.fov;
    this.transitioning = true;
  }

  public setSunElevation(elev: number) {
    this.sunElevation = THREE.MathUtils.clamp(elev, 0, 1);
  }

  public setShowFighters(show: boolean) {
    this.structures.fightersGroup.visible = show;
  }

  public setTruckSpeed(speed: number) {
    this.truckSpeed = THREE.MathUtils.clamp(speed, 0, 2.5);
  }

  public setAudioEnabled(enabled: boolean) {
    this.audio.setEnabled(enabled);
  }

  public resetHazards() {
    this.hazards.resetAll();
  }

  public triggerChainBlast() {
    this.hazards.triggerChainBlast();
  }

  private updatePointer(event: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private handlePointerDown = (event: PointerEvent) => {
    this.pointerDownPos.set(event.clientX, event.clientY);
  };

  private handlePointerMove = (event: PointerEvent) => {
    const now = performance.now();
    if (now - this.lastHoverRaycast < 48) return;
    this.lastHoverRaycast = now;

    this.updatePointer(event);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.hazards.hitProxies, false);
    if (hits.length > 0) {
      this.hazards.setHoveredProxy(hits[0].object);
      this.renderer.domElement.style.cursor = 'crosshair';
    } else {
      this.hazards.setHoveredProxy(null);
      this.renderer.domElement.style.cursor = 'grab';
    }
  };

  private handlePointerUp = (event: PointerEvent) => {
    // Distinguish quick click (< 6px drag) from OrbitControls drag
    const dx = event.clientX - this.pointerDownPos.x;
    const dy = event.clientY - this.pointerDownPos.y;
    if (dx * dx + dy * dy > 36) return;

    this.updatePointer(event);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.hazards.hitProxies, false);
    if (hits.length > 0) {
      this.hazards.strikeProxy(hits[0].object);
    }
  };

  private handleResize = () => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  // Software-WebGL fence pacing helper (avoids starving main thread on SwiftShader)
  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick = () => {
    if (this.disposed) return;

    const rawDelta = this.clock.getDelta();
    const delta = Math.min(rawDelta, 0.08);
    const elapsed = this.clock.getElapsedTime();

    // Smoothly damp sun elevation transitions
    this.currentSunElevation = THREE.MathUtils.damp(
      this.currentSunElevation,
      this.sunElevation,
      4.5,
      delta,
    );

    // Smooth exponential damping for camera preset transitions
    if (this.transitioning) {
      const lambda = 5.2;
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, this.targetCamPos.x, lambda, delta);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, this.targetCamPos.y, lambda, delta);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, this.targetCamPos.z, lambda, delta);

      this.controls.target.x = THREE.MathUtils.damp(this.controls.target.x, this.targetLookAt.x, lambda, delta);
      this.controls.target.y = THREE.MathUtils.damp(this.controls.target.y, this.targetLookAt.y, lambda, delta);
      this.controls.target.z = THREE.MathUtils.damp(this.controls.target.z, this.targetLookAt.z, lambda, delta);

      const nextFov = THREE.MathUtils.damp(this.camera.fov, this.targetFov, lambda, delta);
      if (Math.abs(nextFov - this.camera.fov) > 0.02) {
        this.camera.fov = nextFov;
        this.camera.updateProjectionMatrix();
      }

      if (
        this.camera.position.distanceTo(this.targetCamPos) < 0.06 &&
        this.controls.target.distanceTo(this.targetLookAt) < 0.06
      ) {
        this.transitioning = false;
      }
    }

    this.controls.update();

    // Advance quarry simulation modules
    const genFlicker = this.hazards.getGeneratorFlicker();
    this.lighting.update(this.currentSunElevation, elapsed, delta, genFlicker);
    this.structures.update(elapsed, delta, this.currentSunElevation, genFlicker);
    this.vehicles.update(elapsed, delta, this.truckSpeed, this.currentSunElevation);
    this.hazards.update(delta);

    // Apply decaying camera explosion shake strictly around render call
    let appliedShake = false;
    if (this.shakeMagnitude > 0.004) {
      this.shakeOffset.set(
        (Math.random() - 0.5) * this.shakeMagnitude,
        (Math.random() - 0.5) * this.shakeMagnitude * 0.8,
        (Math.random() - 0.5) * this.shakeMagnitude * 0.5,
      );
      this.camera.position.add(this.shakeOffset);
      appliedShake = true;
      this.shakeMagnitude = THREE.MathUtils.damp(this.shakeMagnitude, 0, 9.5, delta);
    }

    this.renderer.render(this.scene, this.camera);

    if (appliedShake) {
      this.camera.position.sub(this.shakeOffset);
    }

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.handleResize);
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.removeEventListener('pointermove', this.handlePointerMove);
    this.renderer.domElement.removeEventListener('pointerup', this.handlePointerUp);

    this.controls.dispose();
    this.lighting.dispose();
    this.terrain.dispose();
    this.structures.dispose();
    this.vehicles.dispose();
    this.hazards.dispose();
    this.materials.dispose();
    this.textures.dispose();
    this.audio.dispose();
    this.envRenderTarget?.dispose();
    this.renderer.dispose();

    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
