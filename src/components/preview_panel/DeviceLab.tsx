import { useMemo } from "react";
import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import {
  Smartphone,
  Tablet,
  Monitor,
  RotateCw,
  Sun,
  Moon,
  WifiOff,
  Gauge,
  Type,
  Hand,
  Maximize2,
  Keyboard,
} from "lucide-react";

import {
  getDevicePreset,
  getDeviceOrientationDimensions,
  type DevicePreset,
  type SimulationOverlay,
  type DeviceLabState,
} from "@/lib/devicePresets";
import { DEFAULT_DEVICE_PRESET } from "@/lib/devicePresets";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { deviceFamilies } from "@/lib/devicePresets";
import { devicePresets as presetsMap } from "@/lib/devicePresets";

const deviceLabStateAtom = atomWithStorage<DeviceLabState>(
  "caide-device-lab-state",
  {
    selectedPreset: DEFAULT_DEVICE_PRESET,
    orientation: "portrait",
    customWidth: 400,
    customHeight: 800,
    activeOverlays: [],
    textScaleFactor: 1,
    networkLatencyMs: 0,
  },
);

export { deviceLabStateAtom };

interface DeviceFrameProps {
  children: React.ReactNode;
  preset: DevicePreset;
  orientation: "portrait" | "landscape";
  activeOverlays: SimulationOverlay[];
  textScaleFactor: number;
  className?: string;
}

export function DeviceFrame({
  children,
  preset,
  orientation,
  activeOverlays,
  textScaleFactor,
  className,
}: DeviceFrameProps) {
  const dims = getDeviceOrientationDimensions(preset, orientation);
  const hasNotch = preset.hasNotch;
  const hasSafeArea = activeOverlays.includes("safe-area");
  const hasKeyboard = activeOverlays.includes("keyboard-open");
  const isDark = activeOverlays.includes("dark-mode");
  const showTouchTargets = activeOverlays.includes("touch-targets");
  const showOverflow = activeOverlays.includes("overflow");

  const frameStyle: React.CSSProperties = {
    width: `${dims.width}px`,
    height: hasKeyboard ? `${dims.height - 340}px` : `${dims.height}px`,
    transition: "width 0.2s, height 0.2s",
    fontSize: `${textScaleFactor * 100}%`,
    position: "relative",
    overflow: "auto",
    ...(isDark ? { background: "#1a1a2e", color: "#e0e0e0" } : {}),
  };

  return (
    <div
      className={cn(
        "caide-device-frame relative rounded-3xl border-2 border-gray-300 dark:border-gray-600 shadow-xl overflow-hidden bg-white dark:bg-gray-950 flex-shrink-0",
        hasNotch && "pt-[var(--notch-height)]",
        className,
      )}
      style={
        {
          "--notch-height": `${preset.statusBarHeight}px`,
          width: `${dims.width}px`,
          maxWidth: "100%",
        } as React.CSSProperties
      }
      data-device-preset={preset.id}
      data-orientation={orientation}
    >
      {hasNotch && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-[var(--notch-height)] bg-black rounded-b-2xl z-10 flex items-center justify-center gap-1">
          <div className="w-2 h-2 rounded-full bg-gray-700" />
        </div>
      )}

      {hasSafeArea && (
        <>
          <div className="absolute top-0 left-0 right-0 h-[env(safe-area-inset-top)] bg-black/5 z-10 pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 h-[env(safe-area-inset-bottom)] bg-black/5 z-10 pointer-events-none" />
          <div className="absolute top-0 right-0 w-2 h-4 bg-green-500/30 rounded-bl z-20" />
        </>
      )}

      {showTouchTargets && (
        <div className="absolute inset-0 z-20 pointer-events-none">
          <svg className="w-full h-full opacity-20">
            <defs>
              <pattern
                id="touch-grid"
                width="44"
                height="44"
                patternUnits="userSpaceOnUse"
              >
                <circle
                  cx="22"
                  cy="22"
                  r="20"
                  fill="none"
                  stroke="red"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#touch-grid)" />
          </svg>
        </div>
      )}

      {showOverflow && (
        <div className="absolute bottom-2 right-2 z-20 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
          OV
        </div>
      )}

      <div style={frameStyle} className="caide-device-content">
        {children}
      </div>
    </div>
  );
}

interface OverlayButtonProps {
  overlay: SimulationOverlay;
  active: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  label: string;
}

function OverlayButton({
  overlay,
  active,
  onToggle,
  icon,
  label,
}: OverlayButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={onToggle}
            data-active={active}
            aria-pressed={active}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs border transition-colors",
              active
                ? "bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300"
                : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-750",
            )}
          />
        }
      >
        {icon}
        <span className="hidden sm:inline">{label}</span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

interface DeviceLabProps {
  selectedPreset: string;
  onPresetChange: (preset: string) => void;
  orientation: "portrait" | "landscape";
  onOrientationChange: (o: "portrait" | "landscape") => void;
  activeOverlays: SimulationOverlay[];
  onOverlayToggle: (overlay: SimulationOverlay) => void;
  textScaleFactor: number;
  onTextScaleChange: (v: number) => void;
  networkLatencyMs: number;
  onNetworkLatencyChange: (v: number) => void;
  customWidth: number;
  customHeight: number;
  onCustomWidthChange: (v: number) => void;
  onCustomHeightChange: (v: number) => void;
}

export function DeviceLab({
  selectedPreset,
  onPresetChange,
  orientation,
  onOrientationChange,
  activeOverlays,
  onOverlayToggle,
  textScaleFactor,
  onTextScaleChange,
  networkLatencyMs,
  onNetworkLatencyChange,
  customWidth,
  customHeight,
  onCustomWidthChange,
  onCustomHeightChange,
}: DeviceLabProps) {
  const categories = useMemo(() => {
    const cats = new Map<string, DevicePreset[]>();
    const catOrder = ["phone", "foldable", "tablet", "desktop", "custom"];
    for (const cat of catOrder) cats.set(cat, []);
    for (const [id, entry] of Object.entries(presetsMap)) {
      const p = getDevicePreset(id);
      if (!p) continue;
      const list = cats.get(p.category) ?? [];
      list.push(p);
      cats.set(p.category, list);
    }
    for (const [, list] of cats) {
      list.sort((a, b) => a.width - b.width);
    }
    return cats;
  }, []);

  const overlayConfig: {
    key: SimulationOverlay;
    icon: React.ReactNode;
    label: string;
  }[] = [
    { key: "safe-area", icon: <Maximize2 size={13} />, label: "Safe area" },
    { key: "keyboard-open", icon: <Keyboard size={13} />, label: "Keyboard" },
    {
      key: "dark-mode",
      icon: activeOverlays.includes("dark-mode") ? (
        <Moon size={13} />
      ) : (
        <Sun size={13} />
      ),
      label: "Dark mode",
    },
    { key: "slow-network", icon: <Gauge size={13} />, label: "Slow net" },
    { key: "offline", icon: <WifiOff size={13} />, label: "Offline" },
    {
      key: "reduced-motion",
      icon: <Monitor size={13} />,
      label: "Reduced motion",
    },
    { key: "text-scaling", icon: <Type size={13} />, label: "Text scale" },
    {
      key: "touch-targets",
      icon: <Hand size={13} />,
      label: "Touch targets",
    },
    {
      key: "overflow",
      icon: <Maximize2 size={13} />,
      label: "Overflow detect",
    },
  ];

  return (
    <div className="caide-device-lab p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Device Lab
        </h3>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-400">
            {orientation === "portrait" ? "Portrait" : "Landscape"}
          </span>
          <button
            type="button"
            onClick={() =>
              onOrientationChange(
                orientation === "portrait" ? "landscape" : "portrait",
              )
            }
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
            aria-label="Toggle orientation"
          >
            <RotateCw size={13} />
          </button>
        </div>
      </div>

      <ToggleGroup
        value={[selectedPreset]}
        onValueChange={(value) => {
          if (value && value.length > 0) {
            onPresetChange(value[value.length - 1]);
          }
        }}
        variant="outline"
        className="flex-wrap"
      >
        {[...categories.entries()].map(([cat, presets]) => (
          <div key={cat} className="flex flex-wrap gap-1">
            {presets.map((preset) => (
              <ToggleGroupItem
                key={preset.id}
                value={preset.id}
                aria-label={preset.label}
                className="text-[11px] px-2 py-1 h-auto"
              >
                {preset.category === "tablet" ? (
                  <Tablet size={13} className="mr-1" />
                ) : (
                  <Smartphone size={13} className="mr-1" />
                )}
                <span className="hidden sm:inline">{preset.label}</span>
              </ToggleGroupItem>
            ))}
          </div>
        ))}
      </ToggleGroup>

      <div className="flex flex-wrap gap-1">
        {overlayConfig.map((cfg) => (
          <OverlayButton
            key={cfg.key}
            overlay={cfg.key}
            active={activeOverlays.includes(cfg.key)}
            onToggle={() => onOverlayToggle(cfg.key)}
            icon={cfg.icon}
            label={cfg.label}
          />
        ))}
      </div>

      {(activeOverlays.includes("text-scaling") ||
        activeOverlays.includes("slow-network")) && (
        <div className="space-y-2 pt-1 border-t border-gray-200 dark:border-gray-700">
          {activeOverlays.includes("text-scaling") && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-500 w-16 shrink-0">
                Text: {Math.round(textScaleFactor * 100)}%
              </span>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={textScaleFactor}
                onChange={(e) => onTextScaleChange(Number(e.target.value))}
                className="flex-1 h-1.5 accent-blue-500"
                aria-label="Text scale factor"
              />
            </div>
          )}
          {activeOverlays.includes("slow-network") && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-500 w-16 shrink-0">
                Latency: {networkLatencyMs}ms
              </span>
              <input
                type="range"
                min="0"
                max="5000"
                step="100"
                value={networkLatencyMs}
                onChange={(e) => onNetworkLatencyChange(Number(e.target.value))}
                className="flex-1 h-1.5 accent-blue-500"
                aria-label="Network latency"
              />
            </div>
          )}
        </div>
      )}

      {selectedPreset === "custom" && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Input
            type="number"
            placeholder="W"
            value={customWidth}
            onChange={(e) => onCustomWidthChange(Number(e.target.value))}
            className="h-7 w-16 text-xs"
            aria-label="Custom width"
          />
          <span>x</span>
          <Input
            type="number"
            placeholder="H"
            value={customHeight}
            onChange={(e) => onCustomHeightChange(Number(e.target.value))}
            className="h-7 w-16 text-xs"
            aria-label="Custom height"
          />
        </div>
      )}
    </div>
  );
}
