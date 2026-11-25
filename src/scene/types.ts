export type CameraPresetId =
  | 'front'
  | 'left'
  | 'right'
  | 'depth'
  | 'top';

export type LightingMoodId = 'evening' | 'day' | 'night';

export type HazardKind =
  | 'oil_barrel'
  | 'wood_crate'
  | 'sandbags'
  | 'rock_pile'
  | 'generator';

export interface HazardTelemetry {
  total: number;
  destroyed: number;
  hoveredLabel: string | null;
  lastEvent: string | null;
}

export interface QuarryControlsState {
  cameraPreset: CameraPresetId;
  lightingMood: LightingMoodId;
  sunElevation: number; // 0 = night/below horizon, 0.24 = golden evening sunset, 0.85 = harsh midday
  showFighters: boolean;
  truckSpeed: number; // 0 to 2.0 multiplier
  audioEnabled: boolean;
}
