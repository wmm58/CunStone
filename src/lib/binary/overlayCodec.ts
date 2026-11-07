const PIXELS_PER_BYTE = 4;
const MAX_OVERLAY_DIMENSION = 512;

export function encodeOverlay(
  overlay: Uint8Array,
  width: number,
  height: number,
): string {
  if (!isValidDimensions(width, height) || overlay.length !== width * height) {
    throw new Error("invalid-overlay-size");
  }

  const packed = new Uint8Array(Math.ceil(overlay.length / PIXELS_PER_BYTE));
  for (let index = 0; index < overlay.length; index += 1) {
    const value = overlay[index];
    if (value !== 0 && value !== 1 && value !== 2) {
      throw new Error("invalid-overlay-value");
    }
    packed[Math.floor(index / PIXELS_PER_BYTE)] |=
      value << ((index % PIXELS_PER_BYTE) * 2);
  }

  return bytesToBase64(packed);
}

export function decodeOverlay(
  data: string,
  width: number,
  height: number,
): Uint8Array | null {
  if (!isValidDimensions(width, height) || typeof data !== "string") {
    return null;
  }

  const expectedLength = Math.ceil((width * height) / PIXELS_PER_BYTE);
  const packed = base64ToBytes(data);
  if (!packed || packed.length !== expectedLength) {
    return null;
  }

  const overlay = new Uint8Array(width * height);
  for (let index = 0; index < overlay.length; index += 1) {
    const value =
      (packed[Math.floor(index / PIXELS_PER_BYTE)] >>
        ((index % PIXELS_PER_BYTE) * 2)) &
      0b11;
    if (value === 3) {
      return null;
    }
    overlay[index] = value;
  }

  return overlay;
}

export function isValidPackedOverlay(
  data: string,
  width: number,
  height: number,
): boolean {
  return decodeOverlay(data, width, height) !== null;
}

function isValidDimensions(width: number, height: number): boolean {
  return (
    Number.isInteger(width) &&
    Number.isInteger(height) &&
    width > 0 &&
    height > 0 &&
    width <= MAX_OVERLAY_DIMENSION &&
    height <= MAX_OVERLAY_DIMENSION
  );
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return globalThis.btoa(binary);
}

function base64ToBytes(data: string): Uint8Array | null {
  try {
    const binary = globalThis.atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}
