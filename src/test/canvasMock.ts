import { vi } from "vitest";

export function installCanvasMock(options?: {
  width?: number;
  height?: number;
  dataUrl?: string;
}) {
  const width = options?.width ?? 2;
  const height = options?.height ?? 2;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let offset = 0; offset < pixels.length; offset += 4) {
    pixels.set([255, 255, 255, 255], offset);
  }

  const context = {
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    createImageData: vi.fn((width: number, height: number) => ({
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4),
    })),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    putImageData: vi.fn(),
    getImageData: vi.fn(() => ({ width, height, data: pixels })),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
  } as unknown as CanvasRenderingContext2D;

  const getContext = vi
    .spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockReturnValue(context);
  const toDataURL = vi
    .spyOn(HTMLCanvasElement.prototype, "toDataURL")
    .mockReturnValue(options?.dataUrl ?? "data:image/webp;base64,c2FtcGxl");

  return {
    context,
    restore() {
      getContext.mockRestore();
      toDataURL.mockRestore();
    },
  };
}
