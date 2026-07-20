export type DeviceFamily = "iOS" | "Android" | "Tablet" | "Desktop";
export type PreviewOrientation = "portrait" | "landscape";

export const deviceFamilies = ["iOS", "Android", "Tablet", "Desktop"] as const;

export const devicePresets = {
  "iphone-se": {
    label: "iPhone SE",
    width: 375,
    height: 667,
    native: "750 x 1334",
    family: "iOS",
  },
  "iphone-13-mini": {
    label: "iPhone 13 mini",
    width: 375,
    height: 812,
    native: "1080 x 2340",
    family: "iOS",
  },
  "iphone-14-pro-max": {
    label: "iPhone 14 Pro Max",
    width: 430,
    height: 932,
    native: "1290 x 2796",
    family: "iOS",
  },
  "iphone-15": {
    label: "iPhone 15",
    width: 393,
    height: 852,
    native: "1179 x 2556",
    family: "iOS",
  },
  "iphone-15-pro": {
    label: "iPhone 15 Pro",
    width: 393,
    height: 852,
    native: "1179 x 2556",
    family: "iOS",
  },
  "iphone-16e": {
    label: "iPhone 16e",
    width: 390,
    height: 844,
    native: "1170 x 2532",
    family: "iOS",
  },
  "iphone-16-pro": {
    label: "iPhone 16 Pro",
    width: 402,
    height: 874,
    native: "1206 x 2622",
    family: "iOS",
  },
  "iphone-16-pro-max": {
    label: "iPhone 16 Pro Max",
    width: 440,
    height: 956,
    native: "1320 x 2868",
    family: "iOS",
  },
  "pixel-8": {
    label: "Google Pixel 8",
    width: 412,
    height: 915,
    native: "1080 x 2400",
    family: "Android",
  },
  "pixel-7": {
    label: "Google Pixel 7",
    width: 412,
    height: 915,
    native: "1080 x 2400",
    family: "Android",
  },
  "pixel-9-pro": {
    label: "Google Pixel 9 Pro",
    width: 412,
    height: 923,
    native: "1280 x 2856",
    family: "Android",
  },
  "pixel-9-pro-xl": {
    label: "Google Pixel 9 Pro XL",
    width: 448,
    height: 998,
    native: "1344 x 2992",
    family: "Android",
  },
  "pixel-fold": {
    label: "Google Pixel Fold",
    width: 736,
    height: 920,
    native: "2208 x 1840",
    family: "Android",
  },
  "galaxy-s23": {
    label: "Samsung Galaxy S23",
    width: 360,
    height: 780,
    native: "1080 x 2340",
    family: "Android",
  },
  "galaxy-s24": {
    label: "Samsung Galaxy S24",
    width: 360,
    height: 780,
    native: "1080 x 2340",
    family: "Android",
  },
  "galaxy-s24-ultra": {
    label: "Samsung S24 Ultra",
    width: 384,
    height: 832,
    native: "1440 x 3120",
    family: "Android",
  },
  "galaxy-a55": {
    label: "Samsung Galaxy A55",
    width: 480,
    height: 1040,
    native: "1080 x 2340",
    family: "Android",
  },
  "galaxy-z-flip6": {
    label: "Galaxy Z Flip6",
    width: 412,
    height: 1004,
    native: "1080 x 2640",
    family: "Android",
  },
  "galaxy-z-fold5": {
    label: "Galaxy Z Fold5",
    width: 904,
    height: 1086,
    native: "1812 x 2176",
    family: "Android",
  },
  "ipad-mini": {
    label: "iPad mini",
    width: 744,
    height: 1133,
    native: "1488 x 2266",
    family: "Tablet",
  },
  "ipad-pro-11": {
    label: "iPad Pro 11",
    width: 834,
    height: 1194,
    native: "1668 x 2388",
    family: "Tablet",
  },
  "ipad-pro-13": {
    label: "iPad Pro 13",
    width: 1032,
    height: 1376,
    native: "2064 x 2752",
    family: "Tablet",
  },
  "ipad-11": {
    label: "iPad (11th generation)",
    width: 820,
    height: 1180,
    native: "1640 x 2360",
    family: "Tablet",
  },
  "galaxy-tab-s9": {
    label: "Galaxy Tab S9",
    width: 800,
    height: 1280,
    native: "1600 x 2560",
    family: "Tablet",
  },
  "surface-pro-9": {
    label: "Surface Pro 9",
    width: 960,
    height: 1440,
    native: "1920 x 2880",
    family: "Tablet",
  },
  "desktop-1024": {
    label: "Compact desktop",
    width: 1024,
    height: 768,
    native: "1024 x 768",
    family: "Desktop",
  },
  desktop: {
    label: "Responsive",
    width: 1280,
    height: 800,
    native: "1440 x 900",
    family: "Desktop",
  },
  "desktop-1440": {
    label: "Desktop 1440",
    width: 1440,
    height: 900,
    native: "1440 x 900",
    family: "Desktop",
  },
  "desktop-1920": {
    label: "Desktop 1920",
    width: 1920,
    height: 1080,
    native: "1920 x 1080",
    family: "Desktop",
  },
} as const satisfies Record<
  string,
  {
    label: string;
    width: number;
    height: number;
    native: string;
    family: DeviceFamily;
  }
>;

export type DevicePresetId = keyof typeof devicePresets;

export function isDevicePresetId(value: unknown): value is DevicePresetId {
  return typeof value === "string" && value in devicePresets;
}
