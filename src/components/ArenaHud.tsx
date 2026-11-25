import React, { useState } from 'react';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Flame,
  Image as ImageIcon,
  RotateCcw,
  Sun,
  Truck,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type {
  CameraPresetId,
  HazardTelemetry,
  LightingMoodId,
  QuarryControlsState,
} from '../scene/types';

interface ArenaHudProps {
  controls: QuarryControlsState;
  telemetry: HazardTelemetry;
  dockOpen: boolean;
  onToggleDock: () => void;
  onSelectCamera: (id: CameraPresetId) => void;
  onSelectLightingMood: (mood: LightingMoodId) => void;
  onSunElevationChange: (elev: number) => void;
  onToggleFighters: () => void;
  onCycleTruckSpeed: () => void;
  onToggleAudio: () => void;
  onTriggerChainBlast: () => void;
  onResetHazards: () => void;
}

const CAMERA_TABS: Array<{ id: CameraPresetId; label: string }> = [
  { id: 'front', label: 'Front' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
  { id: 'depth', label: '3/4 Depth' },
  { id: 'top', label: 'Top Map' },
];

const LIGHTING_TABS: Array<{ id: LightingMoodId; label: string }> = [
  { id: 'evening', label: 'Evening' },
  { id: 'day', label: 'Day' },
  { id: 'night', label: 'Night' },
];

export const ArenaHud: React.FC<ArenaHudProps> = ({
  controls,
  telemetry,
  dockOpen,
  onToggleDock,
  onSelectCamera,
  onSelectLightingMood,
  onSunElevationChange,
  onToggleFighters,
  onCycleTruckSpeed,
  onToggleAudio,
  onTriggerChainBlast,
  onResetHazards,
}) => {
  const [showRefSheet, setShowRefSheet] = useState(false);
  const [refImgError, setRefImgError] = useState(false);

  const truckSpeedLabel =
    controls.truckSpeed === 0
      ? 'Paused'
      : controls.truckSpeed > 1.5
        ? '2x'
        : '1x';

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between">
      {/* Top-Left Minimal Title Lockup (Unboxed metadata, zero pills, zero pulsing dots) */}
      <div className="flex items-start justify-between p-5">
        <div
          className="pointer-events-auto px-4 py-2.5 rounded-md border border-[#f3ece2]/12"
          style={{ backgroundColor: 'rgba(15, 13, 11, 0.84)' }}
        >
          <h1 className="font-display text-2xl font-bold tracking-wide text-[#f7f0e6] leading-none">
            The KGF Quarry
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-[#c7baa8]">
            <span>Arena 03</span>
            <span aria-hidden="true" className="text-[#786b5c]">·</span>
            <span className="font-mono-tabular">36m × 15m</span>
            <span aria-hidden="true" className="text-[#786b5c]">·</span>
            <span>Drag to orbit, click hazards to destroy</span>
            {telemetry.destroyed > 0 && (
              <>
                <span aria-hidden="true" className="text-[#786b5c]">·</span>
                <span className="font-mono-tabular text-[#f59e0b]">
                  {telemetry.destroyed}/{telemetry.total} destroyed
                </span>
              </>
            )}
          </div>
        </div>

        {/* Single discreet Reference Sheet comparison button top-right */}
        <button
          type="button"
          onClick={() => setShowRefSheet(true)}
          className="pointer-events-auto inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-[#ede3d4] rounded-md border border-[#f3ece2]/14 hover:border-[#f59e0b]/60 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#f59e0b]"
          style={{ backgroundColor: 'rgba(15, 13, 11, 0.84)' }}
        >
          <ImageIcon className="w-3.5 h-3.5 text-[#f59e0b]" />
          <span>Design Sheet</span>
        </button>
      </div>

      {/* Bottom Unified Collapsible Control Dock (Zero Viewport Occlusion) */}
      <div className="flex flex-col items-center pb-5 px-3">
        {/* Contextual hover / combat action readout */}
        {(telemetry.hoveredLabel || telemetry.lastEvent) && (
          <div
            className="mb-2 px-3.5 py-1.5 rounded border border-[#f3ece2]/12 text-xs tracking-wide text-[#f3ece2] transition-opacity duration-150"
            style={{ backgroundColor: 'rgba(15, 13, 11, 0.88)' }}
          >
            {telemetry.hoveredLabel ? (
              <span>
                <span className="text-[#f59e0b] font-medium">Click to strike:</span>{' '}
                {telemetry.hoveredLabel}
              </span>
            ) : (
              <span className="text-[#d6c9b8]">{telemetry.lastEvent}</span>
            )}
          </div>
        )}

        {/* Collapse / Expand Drawer Handle */}
        <button
          type="button"
          onClick={onToggleDock}
          className="pointer-events-auto inline-flex items-center gap-1.5 px-3.5 py-1 text-[11px] font-medium text-[#d6c9b8] hover:text-white border border-b-0 border-[#f3ece2]/14 rounded-t-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#f59e0b]"
          style={{ backgroundColor: 'rgba(15, 13, 11, 0.9)' }}
          aria-expanded={dockOpen}
        >
          {dockOpen ? (
            <>
              <ChevronDown className="w-3.5 h-3.5 text-[#f59e0b]" />
              <span>Hide Controls (H)</span>
            </>
          ) : (
            <>
              <ChevronUp className="w-3.5 h-3.5 text-[#f59e0b]" />
              <span>Show Controls (H)</span>
            </>
          )}
        </button>

        {/* Main Horizontal Control Dock */}
        <div
          className={`pointer-events-auto w-full max-w-[940px] rounded-lg border border-[#f3ece2]/14 px-4 py-3 transition-all duration-200 ${
            dockOpen
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-6 pointer-events-none h-0 py-0 overflow-hidden border-0'
          }`}
          style={{ backgroundColor: 'rgba(15, 13, 11, 0.9)' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2.5">
            {/* Zone 1: Camera Angles (Panels A, B, C, D & Map Overview) */}
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs text-[#a89a87] whitespace-nowrap shrink-0">
                <Camera className="w-3.5 h-3.5 text-[#f59e0b]" />
                <span>Angle</span>
              </span>
              <div className="flex items-center gap-1 p-0.5 rounded bg-[#ffffff]/6 border border-[#f3ece2]/10">
                {CAMERA_TABS.map((tab) => {
                  const active = controls.cameraPreset === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => onSelectCamera(tab.id)}
                      className={`px-2.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#f59e0b] ${
                        active
                          ? 'bg-[#f59e0b] text-[#14100c]'
                          : 'text-[#d8ccbc] hover:text-white hover:bg-[#ffffff]/8'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Zone 2: Dynamic Lighting Mood + Sun Elevation Slider */}
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 text-xs text-[#a89a87] whitespace-nowrap shrink-0">
                <Sun className="w-3.5 h-3.5 text-[#f59e0b]" />
                <span>Lighting</span>
              </span>
              <div className="flex items-center gap-1 p-0.5 rounded bg-[#ffffff]/6 border border-[#f3ece2]/10">
                {LIGHTING_TABS.map((tab) => {
                  const active = controls.lightingMood === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => onSelectLightingMood(tab.id)}
                      className={`px-2.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#f59e0b] ${
                        active
                          ? 'bg-[#f59e0b] text-[#14100c]'
                          : 'text-[#d8ccbc] hover:text-white hover:bg-[#ffffff]/8'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={controls.sunElevation}
                onChange={(e) => onSunElevationChange(parseFloat(e.target.value))}
                aria-label="Sun elevation"
                className="quarry-slider w-20"
              />
            </div>

            {/* Zone 3: Combat Hazards, Moving Trucks, Fighter Scale & Audio */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onTriggerChainBlast}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-[#991b1b] hover:bg-[#b91c1c] text-[#fef2f2] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#f59e0b]"
                title="Detonate an explosive fuel barrel chain reaction (Space)"
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Detonate</span>
              </button>

              <button
                type="button"
                onClick={onResetHazards}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border border-[#f3ece2]/15 text-[#e5dacb] hover:text-white hover:border-[#f3ece2]/35 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#f59e0b]"
                title="Restore all destructible hazards (R)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>

              <button
                type="button"
                onClick={onToggleFighters}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#f59e0b] ${
                  controls.showFighters
                    ? 'bg-[#f59e0b]/20 border-[#f59e0b] text-[#fde68a]'
                    : 'border-[#f3ece2]/15 text-[#d8ccbc] hover:text-white'
                }`}
                title="Toggle 1.8m fighter scale mannequins (F)"
              >
                <Users className="w-3.5 h-3.5" />
                <span>1.8m Scale</span>
              </button>

              <button
                type="button"
                onClick={onCycleTruckSpeed}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border border-[#f3ece2]/15 text-[#d8ccbc] hover:text-white hover:border-[#f3ece2]/35 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#f59e0b]"
                title="Cycle haul truck speed"
              >
                <Truck className="w-3.5 h-3.5 text-[#f59e0b]" />
                <span className="font-mono-tabular">{truckSpeedLabel}</span>
              </button>

              <button
                type="button"
                onClick={onToggleAudio}
                className={`inline-flex items-center justify-center p-1.5 rounded border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#f59e0b] ${
                  controls.audioEnabled
                    ? 'bg-[#f59e0b]/20 border-[#f59e0b] text-[#fde68a]'
                    : 'border-[#f3ece2]/15 text-[#b5a795] hover:text-white'
                }`}
                aria-label={controls.audioEnabled ? 'Mute sound effects' : 'Enable sound effects'}
                title={controls.audioEnabled ? 'Mute quarry audio' : 'Enable quarry audio'}
              >
                {controls.audioEnabled ? (
                  <Volume2 className="w-4 h-4" />
                ) : (
                  <VolumeX className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Reference Sheet Modal (User's original attached design sheet for side-by-side verification) */}
      {showRefSheet && (
        <div
          className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center p-6"
          style={{ backgroundColor: 'rgba(10, 9, 8, 0.88)' }}
          onClick={() => setShowRefSheet(false)}
        >
          <div
            className="relative max-w-5xl w-full rounded-lg border border-[#f3ece2]/18 overflow-hidden"
            style={{ backgroundColor: '#141210' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#f3ece2]/12">
              <div className="flex items-center gap-3">
                <span className="font-display text-lg font-semibold text-[#f7f0e6]">
                  Arena 03 Reference Design Sheet
                </span>
                <span className="text-xs text-[#a89a87]">
                  Panels A–D, Colour Moods &amp; Key Measurements
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowRefSheet(false)}
                className="p-1.5 rounded text-[#c7baa8] hover:text-white hover:bg-[#ffffff]/10 transition-colors cursor-pointer"
                aria-label="Close reference design sheet"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-[#0c0b0a]">
              {!refImgError ? (
                <img
                  src="/assets/aistudio/image_30a23bf1.png"
                  alt="Arena 03: The KGF Quarry Fighting Game 3D Environment Design Sheet"
                  referrerPolicy="no-referrer"
                  onError={() => setRefImgError(true)}
                  className="max-h-[76vh] w-auto object-contain rounded"
                />
              ) : (
                <div className="py-16 px-8 text-center text-sm text-[#a89a87]">
                  Reference sheet image unavailable.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
