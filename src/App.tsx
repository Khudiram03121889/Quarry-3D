import { useCallback, useEffect, useRef, useState } from 'react';
import { QuarrySceneController } from './scene/QuarryScene';
import { ArenaHud } from './components/ArenaHud';
import type {
  CameraPresetId,
  HazardTelemetry,
  LightingMoodId,
  QuarryControlsState,
} from './scene/types';

const MOOD_ELEVATION: Record<LightingMoodId, number> = {
  evening: 0.24,
  day: 0.86,
  night: 0.03,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<QuarrySceneController | null>(null);

  const [contextLost, setContextLost] = useState(false);
  const [dockOpen, setDockOpen] = useState(true);
  const [controls, setControls] = useState<QuarryControlsState>({
    cameraPreset: 'front',
    lightingMood: 'evening',
    sunElevation: MOOD_ELEVATION.evening,
    showFighters: false,
    truckSpeed: 1.0,
    audioEnabled: false,
  });

  const [telemetry, setTelemetry] = useState<HazardTelemetry>({
    total: 18,
    destroyed: 0,
    hoveredLabel: null,
    lastEvent: null,
  });

  // Mount Three.js WebGL scene once into isolated ref container
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const sceneController = new QuarrySceneController(mount, {
      onTelemetryChange: (next) => {
        setTelemetry(next);
      },
      onContextLostChange: (lost) => {
        setContextLost(lost);
      },
    });
    controllerRef.current = sceneController;

    return () => {
      sceneController.dispose();
      controllerRef.current = null;
    };
  }, []);

  const handleSelectCamera = useCallback((id: CameraPresetId) => {
    setControls((prev) => ({ ...prev, cameraPreset: id }));
    controllerRef.current?.setCameraPreset(id);
  }, []);

  const handleSelectLightingMood = useCallback((mood: LightingMoodId) => {
    const elev = MOOD_ELEVATION[mood];
    setControls((prev) => ({ ...prev, lightingMood: mood, sunElevation: elev }));
    controllerRef.current?.setSunElevation(elev);
  }, []);

  const handleSunElevationChange = useCallback((elev: number) => {
    const mood: LightingMoodId =
      elev < 0.12 ? 'night' : elev < 0.52 ? 'evening' : 'day';
    setControls((prev) => ({ ...prev, lightingMood: mood, sunElevation: elev }));
    controllerRef.current?.setSunElevation(elev);
  }, []);

  const handleToggleFighters = useCallback(() => {
    setControls((prev) => {
      const next = !prev.showFighters;
      controllerRef.current?.setShowFighters(next);
      return { ...prev, showFighters: next };
    });
  }, []);

  const handleCycleTruckSpeed = useCallback(() => {
    setControls((prev) => {
      const next = prev.truckSpeed === 1.0 ? 2.0 : prev.truckSpeed === 2.0 ? 0 : 1.0;
      controllerRef.current?.setTruckSpeed(next);
      return { ...prev, truckSpeed: next };
    });
  }, []);

  const handleToggleAudio = useCallback(() => {
    setControls((prev) => {
      const next = !prev.audioEnabled;
      controllerRef.current?.setAudioEnabled(next);
      return { ...prev, audioEnabled: next };
    });
  }, []);

  const handleTriggerChainBlast = useCallback(() => {
    controllerRef.current?.triggerChainBlast();
  }, []);

  const handleResetHazards = useCallback(() => {
    controllerRef.current?.resetHazards();
  }, []);

  // Convenient keyboard shortcuts for inspecting angles & testing combat hazards
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === 'h') {
        setDockOpen((o) => !o);
      } else if (key === '1') {
        handleSelectCamera('front');
      } else if (key === '2') {
        handleSelectCamera('left');
      } else if (key === '3') {
        handleSelectCamera('right');
      } else if (key === '4') {
        handleSelectCamera('depth');
      } else if (key === '5') {
        handleSelectCamera('top');
      } else if (key === 'r') {
        handleResetHazards();
      } else if (key === 'f') {
        handleToggleFighters();
      } else if (e.code === 'Space') {
        e.preventDefault();
        handleTriggerChainBlast();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleSelectCamera,
    handleResetHazards,
    handleToggleFighters,
    handleTriggerChainBlast,
  ]);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#0e0c0a]">
      {/* Dedicated isolated WebGL canvas mount container */}
      <div
        ref={canvasMountRef}
        className="w-full h-full"
        aria-label="The KGF Quarry 3D Fighting Game Arena Viewport"
      />

      {/* Graceful fallback overlay if WebGL context is ever suspended */}
      {contextLost && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-6"
          style={{ backgroundColor: 'rgba(14, 12, 10, 0.92)' }}
        >
          <div className="max-w-md rounded-lg border border-[#f3ece2]/15 bg-[#181512] p-6 text-center">
            <h2 className="font-display text-2xl font-bold text-[#f7f0e6]">
              WebGL Context Interrupted
            </h2>
            <p className="mt-2 text-sm text-[#c7baa8]">
              Hardware graphics context was temporarily paused. Reload or restore the
              tab to resume rendering the KGF Quarry arena.
            </p>
          </div>
        </div>
      )}

      {/* Sibling semantic HUD overlay */}
      <ArenaHud
        controls={controls}
        telemetry={telemetry}
        dockOpen={dockOpen}
        onToggleDock={() => setDockOpen((o) => !o)}
        onSelectCamera={handleSelectCamera}
        onSelectLightingMood={handleSelectLightingMood}
        onSunElevationChange={handleSunElevationChange}
        onToggleFighters={handleToggleFighters}
        onCycleTruckSpeed={handleCycleTruckSpeed}
        onToggleAudio={handleToggleAudio}
        onTriggerChainBlast={handleTriggerChainBlast}
        onResetHazards={handleResetHazards}
      />
    </main>
  );
}
