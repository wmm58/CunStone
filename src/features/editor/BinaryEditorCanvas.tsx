import { useEffect, useRef, type PointerEvent } from "react";

import type { EditTool, PixelPoint } from "./binaryEditing";
import type { RgbaImage } from "./imageProcessing";

interface BinaryEditorCanvasProps {
  raster: RgbaImage | null;
  disabled: boolean;
  tool: EditTool;
  zoom: number;
  onStrokeStart: (point: PixelPoint) => void;
  onStrokeMove: (point: PixelPoint) => void;
  onStrokeEnd: () => void;
}

export default function BinaryEditorCanvas({
  raster,
  disabled,
  tool,
  zoom,
  onStrokeStart,
  onStrokeMove,
  onStrokeEnd,
}: BinaryEditorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !raster) {
      return;
    }

    canvas.width = raster.width;
    canvas.height = raster.height;
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }
    const imageData = context.createImageData(raster.width, raster.height);
    imageData.data.set(raster.data);
    context.putImageData(imageData, 0, 0);
  }, [raster]);

  function toRasterPoint(event: PointerEvent<HTMLCanvasElement>): PixelPoint | null {
    if (!raster) {
      return null;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }
    return {
      x: Math.min(
        raster.width - 1,
        Math.max(0, Math.floor(((event.clientX - rect.left) / rect.width) * raster.width)),
      ),
      y: Math.min(
        raster.height - 1,
        Math.max(0, Math.floor(((event.clientY - rect.top) / rect.height) * raster.height)),
      ),
    };
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (disabled || !raster) {
      return;
    }
    const point = toRasterPoint(event);
    if (!point) {
      return;
    }
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drawingRef.current = true;
    onStrokeStart(point);
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) {
      return;
    }
    const point = toRasterPoint(event);
    if (point) {
      onStrokeMove(point);
    }
  }

  function finishStroke(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) {
      return;
    }
    drawingRef.current = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    onStrokeEnd();
  }

  return (
    <section className="rounded-2xl border border-slate-300 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <span className="text-xs text-slate-500">
          黑色 = 保留石头；白色 = 刻掉
        </span>
        <span className="text-xs text-slate-500">{zoom}%</span>
      </div>
      <div className="flex min-h-96 items-center justify-center overflow-auto bg-slate-100 p-4">
        {raster ? (
          <canvas
            aria-disabled={disabled}
            aria-label="黑白稿编辑画布"
            className={`shrink-0 border border-slate-300 bg-white shadow-sm ${
              disabled ? "cursor-not-allowed" : tool === "brush" ? "cursor-crosshair" : "cursor-cell"
            }`}
            onPointerCancel={finishStroke}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishStroke}
            ref={canvasRef}
            style={{
              height: `${(raster.height * zoom) / 100}px`,
              imageRendering: "pixelated",
              touchAction: "none",
              width: `${(raster.width * zoom) / 100}px`,
            }}
          />
        ) : (
          <p className="text-sm text-slate-500">请先生成黑白稿，再使用编辑工具</p>
        )}
      </div>
    </section>
  );
}
