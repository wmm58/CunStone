import { useEffect, useRef, type MouseEvent } from "react";

import type { RgbaImage } from "./imageProcessing";

interface EditorCanvasProps {
  cutout: RgbaImage | null;
  onBackgroundSample: (x: number, y: number) => void;
}

export default function EditorCanvas({
  cutout,
  onBackgroundSample,
}: EditorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !cutout) {
      return;
    }

    canvas.width = cutout.width;
    canvas.height = cutout.height;
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }
    const imageData = context.createImageData(cutout.width, cutout.height);
    imageData.data.set(cutout.data);
    context.putImageData(imageData, 0, 0);
  }, [cutout]);

  function handleClick(event: MouseEvent<HTMLCanvasElement>) {
    if (!cutout) {
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
        <span className="text-xs font-medium text-slate-700">输入 / 去底画布</span>
        <span className="text-xs text-slate-500">
          点击背景区域指定要移除的颜色
        </span>
      </div>
      <div
        className="flex min-h-96 items-center justify-center overflow-auto p-4"
        style={{
          backgroundColor: "#f1f5f9",
          backgroundImage:
            "linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)",
          backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
          backgroundSize: "16px 16px",
        }}
      >
        {cutout ? (
          <canvas
            aria-label="编辑画布"
            className="max-h-[65vh] max-w-full cursor-crosshair border border-slate-300 bg-transparent shadow-sm"
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
