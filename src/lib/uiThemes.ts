export const UI_THEME_IDS = [
  "system",
  "graphite",
  "carbon",
  "slate",
  "oled-black",
  "light",
  "midnight",
  "forest",
  "aubergine",
] as const;

export type UiThemeId = (typeof UI_THEME_IDS)[number];

export type UiThemeDescriptor = {
  id: UiThemeId;
  name: string;
  description: string;
  swatches: readonly [string, string, string];
  dark: boolean | "system";
};

export const UI_THEMES: readonly UiThemeDescriptor[] = [
  {
    id: "system",
    name: "System",
    description: "Follow the operating system appearance.",
    swatches: ["#F7F7F8", "#20242B", "#356DF3"],
    dark: "system",
  },
  {
    id: "graphite",
    name: "Graphite",
    description: "Balanced neutral dark surfaces with a crisp blue accent.",
    swatches: ["#1C1C1C", "#242424", "#4F8EF7"],
    dark: true,
  },
  {
    id: "carbon",
    name: "Carbon",
    description: "Deeper neutral blacks with a violet-blue accent.",
    swatches: ["#121212", "#1B1B1B", "#7C8CFF"],
    dark: true,
  },
  {
    id: "slate",
    name: "Slate",
    description: "Professional blue-gray workspace for long sessions.",
    swatches: ["#20242B", "#2A3039", "#5B9CF6"],
    dark: true,
  },
  {
    id: "oled-black",
    name: "OLED Black",
    description: "True black, high contrast and minimal glow.",
    swatches: ["#000000", "#0A0A0A", "#5B8CFF"],
    dark: true,
  },
  {
    id: "light",
    name: "Light",
    description: "Clean professional light surfaces and restrained contrast.",
    swatches: ["#F7F7F8", "#FFFFFF", "#356DF3"],
    dark: false,
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Ink-blue surfaces with a clear cyan-blue accent.",
    swatches: ["#0B1020", "#141B2D", "#58A6FF"],
    dark: true,
  },
  {
    id: "forest",
    name: "Forest",
    description: "Low-saturation green-black surfaces for calm focus.",
    swatches: ["#101713", "#1A251E", "#55C88A"],
    dark: true,
  },
  {
    id: "aubergine",
    name: "Aubergine",
    description: "Muted plum surfaces with a soft violet accent.",
    swatches: ["#171119", "#241A28", "#B084F5"],
    dark: true,
  },
] as const;

export function isUiThemeId(value: string | null): value is UiThemeId {
  return UI_THEME_IDS.includes(value as UiThemeId);
}
