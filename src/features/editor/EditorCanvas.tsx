import { useEffect, useRef, type MouseEvent } from "react";

import type { RgbaImage } from "./imageProcessing";

export type CanvasMode = "input" | "binary";

interface EditorCanvasProps {
  mode: CanvasMode;
  cutout: RgbaImage | null;
  binary: RgbaImage | null;
  onModeChange: (mode: CanvasMode) => void;
  onBackgroundSample: (x: number, y: number) => void;
}

export default function EditorCanvas({
  mode,
  cutout,
  binary,
  onModeChange,
  onBackgroundSample,
}: EditorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRaster = mode === "input" ? cutout : binary;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activeRaster) {
      return;
    }

    canvas.width = activeRaster.width;
    canvas.height = activeRaster.height;
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }
    const imageData = context.createImageData(activeRaster.width, activeRaster.height);
    imageData.data.set(activeRaster.data);
    context.putImageData(imageData, 0, 0);
  }, [activeRaster]);

  function handleClick(event: MouseEvent<HTMLCanvasElement>) {
    if (mode !== "input" || !cutout) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * cutout.width);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * cutout.height);
    if (x >= 0 && y >= 0 && x < cutout.width && y < cutout.height) {
      onBackgroundSample(x, y);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-300 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
        <div className="flex gap-1">
          <button
            className={
              mode === "input"
                ? "rounded-md bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white"
                : "rounded-md border border-slate-300 px-3 py-1.5 text-xs"
            }
            onClick={() => onModeChange("input")}
            type="button"
          >
            输入 / 去底
          </button>
          <button
            className={
              mode === "binary"
                ? "rounded-md bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white"
                : "rounded-md border border-slate-300 px-3 py-1.5 text-xs"
            }
            disabled={!binary}
            onClick={() => onModeChange("binary")}
            type="button"
          >
            黑白稿
          </button>
        </div>
        <span className="text-xs text-slate-500">
          {mode === "input" ? "点击背景区域指定要移除的颜色" : "黑白稿仅用于检查效果"}
        </span>
      </div>

      <div
        className="flex min-h-96 items-center justify-center overflow-auto p-4"
        style={{
          backgroundColor: "#f1f5f9",
          backgroundImage:
            mode === "input"
              ? "linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)"
              : undefined,
          backgroundPosition:
            mode === "input" ? "0 0, 0 8px, 8px -8px, -8px 0" : undefined,
          backgroundSize: mode === "input" ? "16px 16px" : undefined,
        }}
      >
        {activeRaster ? (
          <canvas
            aria-label="编辑画布"
            className={`max-h-[65vh] max-w-full cursor-crosshair border border-slate-300 shadow-sm ${
              mode === "binary" ? "bg-white" : "bg-transparent"
            }`}
            onClick={handleClick}
            ref={canvasRef}
          />
        ) : (
          <p className="text-sm text-slate-500">请上传图片或完成手绘</p>
        )}
      </div>
    </section>
  );
}
