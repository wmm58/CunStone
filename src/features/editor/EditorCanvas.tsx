import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from "react";

import {
  cropRaster,
  eraseRasterStroke,
  perspectiveCropRaster,
  type CropRect,
  type RasterPoint,
} from "./imageEditOperations";
import type { ImageCanvasTool } from "./imageEditingTypes";
import type { RgbaImage } from "./imageProcessing";
import { useFittedCanvasSize } from "./useFittedCanvasSize";

interface EditorCanvasProps {
  cutout: RgbaImage | null;
  eraserSize: number;
  tool: ImageCanvasTool;
  onBackgroundSample: (x: number, y: number) => void;
  onCommitRaster: (raster: RgbaImage) => void;
  onRequestUpload: () => void;
}

interface SelectionStart {
  x: number;
  y: number;
}

export default function EditorCanvas({
  cutout,
  eraserSize,
  tool,
  onBackgroundSample,
  onCommitRaster,
  onRequestUpload,
}: EditorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cropStartRef = useRef<SelectionStart | null>(null);
  const eraseLastRef = useRef<RasterPoint | null>(null);
  const erasePreviewRef = useRef<RgbaImage | null>(null);
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [perspectivePoints, setPerspectivePoints] = useState<RasterPoint[]>([]);
  const [erasePreview, setErasePreview] = useState<RgbaImage | null>(null);
  const [cursor, setCursor] = useState<RasterPoint | null>(null);
  const displayedRaster = erasePreview ?? cutout;
  const { containerRef, frameStyle } = useFittedCanvasSize(
    displayedRaster ? displayedRaster.width / displayedRaster.height : 1,
  );

  useEffect(() => {
    setCropRect(null);
    setPerspectivePoints([]);
    setErasePreview(null);
    erasePreviewRef.current = null;
    eraseLastRef.current = null;
  }, [cutout, tool]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !displayedRaster) {
      return;
    }
    canvas.width = displayedRaster.width;
    canvas.height = displayedRaster.height;
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }
    const imageData = context.createImageData(
      displayedRaster.width,
      displayedRaster.height,
    );
    imageData.data.set(displayedRaster.data);
    context.putImageData(imageData, 0, 0);
  }, [displayedRaster]);

  function toRasterPoint(
    event: MouseEvent<HTMLCanvasElement> | PointerEvent<HTMLCanvasElement>,
  ): RasterPoint | null {
    if (!displayedRaster) {
      return null;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }
    return {
      x: Math.min(
        displayedRaster.width - 1,
        Math.max(
          0,
          Math.floor(
            ((event.clientX - rect.left) / rect.width) * displayedRaster.width,
          ),
        ),
      ),
      y: Math.min(
        displayedRaster.height - 1,
        Math.max(
          0,
          Math.floor(
            ((event.clientY - rect.top) / rect.height) * displayedRaster.height,
          ),
        ),
      ),
    };
  }

  function handleClick(event: MouseEvent<HTMLCanvasElement>) {
    if (tool === "sample") {
      const point = toRasterPoint(event);
      if (point) {
        onBackgroundSample(point.x, point.y);
      }
      return;
    }
    if (tool === "perspective" && perspectivePoints.length < 4) {
      const point = toRasterPoint(event);
      if (point) {
        setPerspectivePoints((current) => [...current, point]);
      }
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (!displayedRaster) {
      return;
    }
    const point = toRasterPoint(event);
    if (!point) {
      return;
    }
    setCursor(point);
    if (tool === "crop") {
      event.currentTarget.setPointerCapture?.(event.pointerId);
      cropStartRef.current = point;
      setCropRect({ x: point.x, y: point.y, width: 0, height: 0 });
      return;
    }
    if (tool === "eraser") {
      event.currentTarget.setPointerCapture?.(event.pointerId);
      eraseLastRef.current = point;
      const next = eraseRasterStroke(
        displayedRaster,
        point,
        point,
        eraserSize,
      );
      erasePreviewRef.current = next;
      setErasePreview(next);
    }
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const point = toRasterPoint(event);
    if (!point) {
      return;
    }
    setCursor(point);

    if (tool === "crop" && cropStartRef.current) {
      const start = cropStartRef.current;
      setCropRect(normalizeRect(start, point));
      return;
    }

    if (
      tool === "eraser" &&
      eraseLastRef.current &&
      erasePreviewRef.current
    ) {
      const next = eraseRasterStroke(
        erasePreviewRef.current,
        eraseLastRef.current,
        point,
        eraserSize,
      );
      eraseLastRef.current = point;
      erasePreviewRef.current = next;
      setErasePreview(next);
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (tool === "crop") {
      const point = toRasterPoint(event);
      if (cropStartRef.current && point) {
        setCropRect(normalizeRect(cropStartRef.current, point));
      }
      cropStartRef.current = null;
      return;
    }
    if (tool === "eraser" && erasePreviewRef.current) {
      onCommitRaster(erasePreviewRef.current);
      erasePreviewRef.current = null;
      eraseLastRef.current = null;
      setErasePreview(null);
    }
  }

  function applyCrop() {
    if (!displayedRaster || !cropRect || cropRect.width < 1 || cropRect.height < 1) {
      return;
    }
    onCommitRaster(cropRaster(displayedRaster, cropRect));
    setCropRect(null);
  }

  function applyPerspective() {
    if (!displayedRaster || perspectivePoints.length !== 4) {
      return;
    }
    onCommitRaster(
      perspectiveCropRaster(displayedRaster, [
        perspectivePoints[0],
        perspectivePoints[1],
        perspectivePoints[2],
        perspectivePoints[3],
      ]),
    );
    setPerspectivePoints([]);
  }

  function cancelSelection() {
    setCropRect(null);
    setPerspectivePoints([]);
  }

  return (
    <section className="flex h-full min-h-0 w-full flex-col rounded-2xl border border-slate-300 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
        <span className="text-xs font-medium text-slate-700">
          {toolInstruction(tool, eraserSize)}
        </span>
        {tool === "crop" && cropRect ? (
          <SelectionActions
            applyLabel="应用裁剪"
            disabled={cropRect.width < 1 || cropRect.height < 1}
            onApply={applyCrop}
            onCancel={cancelSelection}
          />
        ) : null}
        {tool === "perspective" ? (
          <SelectionActions
            applyLabel="应用透视裁剪"
            disabled={perspectivePoints.length !== 4}
            onApply={applyPerspective}
            onCancel={cancelSelection}
          />
        ) : null}
      </div>
      <div
        className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4"
        ref={containerRef}
        style={{
          backgroundColor: "#f1f5f9",
          backgroundImage:
            "linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)",
          backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
          backgroundSize: "16px 16px",
        }}
      >
        {displayedRaster ? (
          <div
            className="relative shrink-0"
            data-testid="editor-canvas-frame"
            style={frameStyle}
          >
            <canvas
              aria-label="编辑画布"
              className={toolCursorClass(tool)}
              onClick={handleClick}
              onPointerDown={handlePointerDown}
              onPointerLeave={() => setCursor(null)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              ref={canvasRef}
              style={{ touchAction: "none" }}
            />
            <SelectionOverlay
              cropRect={cropRect}
              cursor={cursor}
              height={displayedRaster.height}
              perspectivePoints={perspectivePoints}
              tool={tool}
              toolSize={eraserSize}
              width={displayedRaster.width}
            />
          </div>
        ) : (
          <button
            aria-label="点击画布中心上传图片"
            className="flex min-h-64 w-full max-w-xl flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white/80 px-6 py-10 text-center text-slate-600 transition hover:border-slate-500"
            onClick={onRequestUpload}
            type="button"
          >
            <span className="text-base font-semibold">点击画布中心上传图片</span>
            <span className="mt-2 text-xs text-slate-500">
              PNG / JPEG / WebP，单文件不超过 10 MB
            </span>
          </button>
        )}
      </div>
    </section>
  );
}

function SelectionActions({
  applyLabel,
  disabled,
  onApply,
  onCancel,
}: {
  applyLabel: string;
  disabled: boolean;
  onApply: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex gap-2">
      <button
        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs"
        onClick={onCancel}
        type="button"
      >
        取消
      </button>
      <button
        className="rounded-md bg-slate-950 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
        disabled={disabled}
        onClick={onApply}
        type="button"
      >
        {applyLabel}
      </button>
    </div>
  );
}

function SelectionOverlay({
  cropRect,
  cursor,
  height,
  perspectivePoints,
  tool,
  toolSize,
  width,
}: {
  cropRect: CropRect | null;
  cursor: RasterPoint | null;
  height: number;
  perspectivePoints: RasterPoint[];
  tool: ImageCanvasTool;
  toolSize: number;
  width: number;
}) {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${width} ${height}`}
    >
      {cropRect ? (
        <rect
          fill="rgba(15, 23, 42, 0.12)"
          height={cropRect.height}
          stroke="#0f172a"
          strokeDasharray="4 3"
          strokeWidth={Math.max(1, width / 300)}
          width={cropRect.width}
          x={cropRect.x}
          y={cropRect.y}
        />
      ) : null}
      {perspectivePoints.length > 0 ? (
        <>
          <polyline
            fill="rgba(15, 23, 42, 0.08)"
            points={perspectivePoints.map((point) => `${point.x},${point.y}`).join(" ")}
            stroke="#0f172a"
            strokeDasharray="4 3"
            strokeWidth={Math.max(1, width / 300)}
          />
          {perspectivePoints.map((point, index) => (
            <g key={`${point.x}-${point.y}-${index}`}>
              <circle
                cx={point.x}
                cy={point.y}
                fill="#0f172a"
                r={Math.max(3, width / 120)}
              />
              <text
                fill="white"
                fontSize={Math.max(8, width / 60)}
                textAnchor="middle"
                x={point.x}
                y={point.y + Math.max(3, width / 170)}
              >
                {index + 1}
              </text>
            </g>
          ))}
        </>
      ) : null}
      {tool === "eraser" && cursor ? (
        <>
          <circle
            cx={cursor.x}
            cy={cursor.y}
            data-testid="image-eraser-cursor"
            fill="none"
            r={toolSize / 2}
            stroke="white"
            strokeWidth={Math.max(2, width / 180)}
          />
          <circle
            cx={cursor.x}
            cy={cursor.y}
            fill="none"
            r={toolSize / 2}
            stroke="black"
            strokeWidth={Math.max(1, width / 400)}
          />
        </>
      ) : null}
    </svg>
  );
}

function normalizeRect(start: RasterPoint, end: RasterPoint): CropRect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

function toolInstruction(tool: ImageCanvasTool, eraserSize: number): string {
  if (tool === "crop") return "拖拽鼠标框选要保留的裁剪区域";
  if (tool === "perspective") return "依次点击 4 个角：左上、右上、右下、左下";
  if (tool === "eraser") return `橡皮大小 ${eraserSize}px · 在画布拖拽擦除`;
  return "取色模式：点击画布选择要移除的背景颜色";
}

function toolCursorClass(tool: ImageCanvasTool): string {
  const cursor =
    tool === "sample"
      ? "cursor-crosshair"
      : tool === "crop"
        ? "cursor-crosshair"
        : tool === "perspective"
          ? "cursor-copy"
          : "cursor-none";
  return `block h-full w-full border border-slate-300 bg-transparent shadow-sm ${cursor}`;
}
