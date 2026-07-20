export type DeviceFamily = "iOS" | "Android" | "Tablet" | "Desktop";

export interface DevicePreset {
  id: string;
  label: string;
  width: number;
  height: number;
  family: DeviceFamily;
  safeAreaTop: number;
  safeAreaBottom: number;
  statusBarHeight: number;
  hasNotch: boolean;
  platform: "android" | "ios" | "desktop";
  category: "phone" | "tablet" | "foldable" | "desktop" | "custom";
  scale?: number;
}

export type DevicePresetId = string;

export const devicePresets: Record<DevicePresetId, DevicePreset> = {
  "compact-android": {
    id: "compact-android",
    label: "Compact Android",
    width: 360,
    height: 740,
    family: "Android",
    safeAreaTop: 24,
    safeAreaBottom: 16,
    statusBarHeight: 24,
    hasNotch: false,
    platform: "android",
    category: "phone",
  },
  "pixel-7": {
    id: "pixel-7",
    label: "Pixel 7",
    width: 412,
    height: 892,
    family: "Android",
    safeAreaTop: 28,
    safeAreaBottom: 16,
    statusBarHeight: 28,
    hasNotch: true,
    platform: "android",
    category: "phone",
  },
  "samsung-s24": {
    id: "samsung-s24",
    label: "Galaxy S24",
    width: 393,
    height: 851,
    family: "Android",
    safeAreaTop: 28,
    safeAreaBottom: 16,
    statusBarHeight: 28,
    hasNotch: true,
    platform: "android",
    category: "phone",
  },
  "samsung-s24-ultra": {
    id: "samsung-s24-ultra",
    label: "Galaxy S24 Ultra",
    width: 430,
    height: 932,
    family: "Android",
    safeAreaTop: 32,
    safeAreaBottom: 16,
    statusBarHeight: 32,
    hasNotch: true,
    platform: "android",
    category: "phone",
  },
  "iphone-16-pro": {
    id: "iphone-16-pro",
    label: "iPhone 16 Pro",
    width: 390,
    height: 844,
    family: "iOS",
    safeAreaTop: 47,
    safeAreaBottom: 34,
    statusBarHeight: 47,
    hasNotch: true,
    platform: "ios",
    category: "phone",
  },
  "iphone-16-pro-max": {
    id: "iphone-16-pro-max",
    label: "iPhone 16 Pro Max",
    width: 430,
    height: 932,
    family: "iOS",
    safeAreaTop: 47,
    safeAreaBottom: 34,
    statusBarHeight: 47,
    hasNotch: true,
    platform: "ios",
    category: "phone",
  },
  "foldable": {
    id: "foldable",
    label: "Foldable",
    width: 412,
    height: 914,
    family: "Android",
    safeAreaTop: 24,
    safeAreaBottom: 16,
    statusBarHeight: 24,
    hasNotch: false,
    platform: "android",
    category: "foldable",
  },
  "ipad-pro": {
    id: "ipad-pro",
    label: "iPad Pro 13\"",
    width: 768,
    height: 1024,
    family: "Tablet",
    safeAreaTop: 24,
    safeAreaBottom: 20,
    statusBarHeight: 24,
    hasNotch: false,
    platform: "ios",
    category: "tablet",
  },
  "pixel-tablet": {
    id: "pixel-tablet",
    label: "Pixel Tablet",
    width: 820,
    height: 1180,
    family: "Tablet",
    safeAreaTop: 24,
    safeAreaBottom: 16,
    statusBarHeight: 24,
    hasNotch: false,
    platform: "android",
    category: "tablet",
  },
  "desktop-1280": {
    id: "desktop-1280",
    label: "Desktop 1280",
    width: 1280,
    height: 800,
    family: "Desktop",
    safeAreaTop: 0,
    safeAreaBottom: 0,
    statusBarHeight: 0,
    hasNotch: false,
    platform: "desktop",
    category: "desktop",
  },
  "desktop-1440": {
    id: "desktop-1440",
    label: "Desktop 1440",
    width: 1440,
    height: 900,
    family: "Desktop",
    safeAreaTop: 0,
    safeAreaBottom: 0,
    statusBarHeight: 0,
    hasNotch: false,
    platform: "desktop",
    category: "desktop",
  },
};

export const deviceFamilies: DeviceFamily[] = ["iOS", "Android", "Tablet", "Desktop"];

export type PreviewOrientation = "portrait" | "landscape";

export function isDevicePresetId(id: string | null | undefined): id is DevicePresetId {
  if (!id || typeof id !== "string") return false;
  return id in devicePresets;
}

export function getDevicePreset(id: string): DevicePreset | undefined {
  return devicePresets[id];
}

export function getDeviceOrientationDimensions(
  preset: DevicePreset,
  orientation: PreviewOrientation,
): { width: number; height: number } {
  if (orientation === "landscape") {
    return { width: preset.height, height: preset.width };
  }
  return { width: preset.width, height: preset.height };
}

export type SimulationOverlay =
  | "safe-area"
  | "keyboard-open"
  | "dark-mode"
  | "slow-network"
  | "offline"
  | "reduced-motion"
  | "text-scaling"
  | "touch-targets"
  | "overflow";

export interface DeviceLabState {
  selectedPreset: string;
  orientation: PreviewOrientation;
  customWidth: number;
  customHeight: number;
  activeOverlays: SimulationOverlay[];
  textScaleFactor: number;
  networkLatencyMs: number;
}

export const DEFAULT_DEVICE_PRESET: DevicePresetId = "iphone-16-pro";

export const DEVICE_PRESETS_ARRAY: DevicePreset[] = Object.values(devicePresets);
