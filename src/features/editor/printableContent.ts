import { applyManualOverlay } from "./binaryEditing";
import type { RgbaImage } from "./imageProcessing";

export function hasPrintableBlackContent(
  sourceDataUrl: string | null,
  base: RgbaImage | null,
  overlay: Uint8Array | null,
): boolean {
  if (!sourceDataUrl || !base) {
    return false;
  }

  const combined = overlay
    ? applyManualOverlay(base, overlay)
    : { ...base, data: new Uint8ClampedArray(base.data) };
  for (let offset = 0; offset < combined.data.length; offset += 4) {
    if (
      combined.data[offset + 3] > 0 &&
      combined.data[offset] < 128 &&
      combined.data[offset + 1] < 128 &&
      combined.data[offset + 2] < 128
    ) {
      return true;
    }
  }
  return false;
}
