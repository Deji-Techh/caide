import { useState } from "react";
import { Check, ChevronDown, Monitor, Smartphone, Tablet } from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  deviceFamilies,
  devicePresets,
  type DeviceFamily,
  type DevicePresetId,
} from "@/lib/devicePresets";
import { cn } from "@/lib/utils";

const familyIcons = {
  iOS: Smartphone,
  Android: Smartphone,
  Tablet,
  Desktop: Monitor,
} satisfies Record<DeviceFamily, typeof Smartphone>;

export function DevicePresetPicker({
  value,
  onValueChange,
  dimensions,
  ariaLabel = "Preview device",
  variant = "toolbar",
}: {
  value: DevicePresetId;
  onValueChange: (value: DevicePresetId) => void;
  dimensions?: { width: number; height: number };
  ariaLabel?: string;
  variant?: "toolbar" | "settings";
}) {
  const [open, setOpen] = useState(false);
  const selected = devicePresets[value];
  const SelectedIcon = familyIcons[selected.family];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={ariaLabel}
        className={cn(
          "caide-device-picker-trigger",
          variant === "settings" && "is-settings",
        )}
      >
        <SelectedIcon />
        <span>
          <strong>{selected.label}</strong>
          <small>
            {dimensions?.width ?? selected.width} x{" "}
            {dimensions?.height ?? selected.height}
          </small>
        </span>
        <ChevronDown className="caide-device-picker-chevron" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={7}
        className="caide-device-picker-popover"
      >
        <Command>
          <CommandInput placeholder="Search devices..." />
          <CommandList className="caide-device-picker-list">
            <CommandEmpty>No matching device.</CommandEmpty>
            {deviceFamilies.map((family) => {
              const FamilyIcon = familyIcons[family];
              return (
                <CommandGroup key={family} heading={family}>
                  {Object.entries(devicePresets)
                    .filter(([, device]) => device.family === family)
                    .map(([id, device]) => {
                      const presetId = id as DevicePresetId;
                      const isSelected = presetId === value;
                      return (
                        <CommandItem
                          key={presetId}
                          value={`${device.label} ${device.family} ${device.width} ${device.height}`}
                          onSelect={() => {
                            onValueChange(presetId);
                            setOpen(false);
                          }}
                          className="caide-device-picker-option"
                        >
                          <FamilyIcon />
                          <span>
                            <strong>{device.label}</strong>
                            <small>
                              {device.width} x {device.height} CSS px
                            </small>
                          </span>
                          {isSelected && <Check className="is-selected" />}
                        </CommandItem>
                      );
                    })}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
