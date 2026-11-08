import { useEffect, useRef, useState, type PointerEvent } from "react";

import type { EditTool, PixelPoint } from "./binaryEditing";
import type { RgbaImage } from "./imageProcessing";
import { useFittedCanvasSize } from "./useFittedCanvasSize";

interface BinaryEditorCanvasProps {
  raster: RgbaImage | null;
  disabled: boolean;
  tool: EditTool;
  toolSize: number;
  zoom: number;
  onStrokeStart: (point: PixelPoint) => void;
  onStrokeMove: (point: PixelPoint) => void;
  onStrokeEnd: () => void;
}

export default function BinaryEditorCanvas({
  raster,
  disabled,
  tool,
  toolSize,
  zoom,
  onStrokeStart,
  onStrokeMove,
  onStrokeEnd,
}: BinaryEditorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokeActiveRef = useRef(false);
  const [cursor, setCursor] = useState<PixelPoint | null>(null);
  const { containerRef, frameStyle } = useFittedCanvasSize(
    raster ? raster.width / raster.height : 1,
    zoom / 100,
  );

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
    strokeActiveRef.current = true;
    onStrokeStart(point);
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const point = toRasterPoint(event);
    if (point) {
      setCursor(point);
    }
    if (!strokeActiveRef.current) {
      return;
    }
    if (point) {
      onStrokeMove(point);
    }
  }

  function finishStroke(event: PointerEvent<HTMLCanvasElement>) {
    if (!strokeActiveRef.current) {
      return;
    }
    strokeActiveRef.current = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    onStrokeEnd();
  }

  return (
    <section className="flex h-full min-h-0 w-full flex-col rounded-2xl border border-slate-300 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <span className="text-xs text-slate-500">
          黑色 = 保留石头；白色 = 刻掉
        </span>
        <span className="text-xs text-slate-500">
          {tool === "brush" ? "画笔" : "橡皮"} {toolSize}px · {zoom}%
        </span>
      </div>
      <div
        className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-slate-100 p-4"
        ref={containerRef}
      >
        {raster ? (
          <div
            className="relative shrink-0"
            data-testid="binary-canvas-frame"
            style={frameStyle}
          >
            <canvas
              aria-disabled={disabled}
              aria-label="黑白稿编辑画布"
              className={`block h-full w-full border border-slate-300 bg-white shadow-sm ${
                disabled ? "cursor-not-allowed" : tool === "brush" ? "cursor-crosshair" : "cursor-cell"
              }`}
              onPointerCancel={finishStroke}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishStroke}
              onPointerLeave={() => setCursor(null)}
              ref={canvasRef}
              style={{
                imageRendering: "pixelated",
                touchAction: "none",
              }}
            />
            {cursor && !disabled ? (
              <svg
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox={`0 0 ${raster.width} ${raster.height}`}
              >
                <circle
                  cx={cursor.x}
                  cy={cursor.y}
                  data-testid="binary-tool-cursor"
                  fill="none"
                  r={toolSize / 2}
                  stroke="white"
                  strokeWidth={Math.max(2, raster.width / 180)}
                />
                <circle
                  cx={cursor.x}
                  cy={cursor.y}
                  fill="none"
                  r={toolSize / 2}
                  stroke="black"
                  strokeWidth={Math.max(1, raster.width / 400)}
                />
              </svg>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-slate-500">请先生成黑白稿，再使用编辑工具</p>
        )}
      </div>
    </section>
  );
}
