/** Pure presentation policy. Never receives account or game state. */
export type Quality = "low" | "medium" | "high";
export interface GraphicsPreference {
  mode: "auto" | "2d" | "3d";
  quality: "auto" | Quality;
}
export interface DeviceHints {
  dpr: number;
  cores?: number;
  memoryGb?: number;
  saveData?: boolean;
}
export const GRAPHICS_STORAGE_KEY = "dnk-graphics-v1";
export const DEFAULT_GRAPHICS: GraphicsPreference = {
  mode: "auto",
  quality: "auto",
};
export const QUALITY_LABELS: Record<Quality, string> = {
  low: "Thấp",
  medium: "Trung bình",
  high: "Cao",
};
export const QUALITY_CONFIG = {
  low: { dpr: 1, shadows: false },
  medium: { dpr: 1.5, shadows: false },
  high: { dpr: 1.5, shadows: true },
} as const;
export function chooseDeviceQuality(device: DeviceHints): Quality | "2d" {
  if (
    device.saveData ||
    (device.cores !== undefined && device.cores <= 2) ||
    (device.memoryGb !== undefined && device.memoryGb <= 1)
  )
    return "2d";
  if (
    (device.cores ?? 4) <= 4 ||
    (device.memoryGb ?? 4) <= 4 ||
    device.dpr > 2.5
  )
    return "low";
  if (
    (device.cores ?? 4) >= 8 &&
    (device.memoryGb ?? 4) >= 8 &&
    device.dpr <= 2
  )
    return "high";
  return "medium";
}
export function lowerQuality(quality: Quality): Quality | "2d" {
  return quality === "high" ? "medium" : quality === "medium" ? "low" : "2d";
}
export function parseGraphicsPreference(
  raw: string | null,
): GraphicsPreference {
  try {
    const value: unknown = JSON.parse(raw ?? "null");
    if (
      value &&
      typeof value === "object" &&
      "mode" in value &&
      "quality" in value &&
      ["auto", "2d", "3d"].includes(String(value.mode)) &&
      ["auto", "low", "medium", "high"].includes(String(value.quality))
    ) {
      return { mode: value.mode, quality: value.quality } as GraphicsPreference;
    }
  } catch {
    /* Local storage may be unavailable or contain an older version. */
  }
  return { ...DEFAULT_GRAPHICS };
}
export function supportsWebGL2(): boolean {
  try {
    const context = document
      .createElement("canvas")
      .getContext("webgl2", { failIfMajorPerformanceCaveat: false });
    if (!context) return false;
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}
/** Two consecutive two-second windows prevent a single GC pause changing quality. */
export function assessFrameWindow(
  quality: Quality,
  fps: number,
  slowWindows: number,
) {
  const slow = fps < (quality === "low" ? 15 : 27) ? slowWindows + 1 : 0;
  return {
    slowWindows: slow,
    next: slow >= 2 ? lowerQuality(quality) : quality,
  };
}
