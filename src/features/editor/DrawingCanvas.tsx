import { useEffect, useRef, useState, type PointerEvent } from "react";

interface DrawingCanvasProps {
  onCommit: (dataUrl: string) => void;
  onCancel: () => void;
}

const CANVAS_SIZE = 512;
const BRUSH_WIDTH = 3;

export default function DrawingCanvas({ onCommit, onCancel }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    clearCanvas();
  }, []);

  function getContext() {
    return canvasRef.current?.getContext("2d") ?? null;
  }

  function clearCanvas() {
    const context = getContext();
    if (!context) {
      return;
    }
    context.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    context.strokeStyle = "#000000";
    context.lineWidth = BRUSH_WIDTH;
    context.lineCap = "round";
    setReady(false);
  }

  function toCanvasPoint(event: PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * CANVAS_SIZE,
      y: ((event.clientY - rect.top) / rect.height) * CANVAS_SIZE,
    };
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    const context = getContext();
    if (!context) {
      return;
    }
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drawingRef.current = true;
    lastPointRef.current = toCanvasPoint(event);
    context.beginPath();
    context.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    context.lineTo(lastPointRef.current.x + 0.01, lastPointRef.current.y + 0.01);
    context.stroke();
    setReady(true);
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || !lastPointRef.current) {
      return;
    }
    const context = getContext();
    if (!context) {
      return;
    }
    const next = toCanvasPoint(event);
    context.beginPath();
    context.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    context.lineTo(next.x, next.y);
    context.stroke();
    lastPointRef.current = next;
  }

  function handlePointerUp(event: PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = false;
    lastPointRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  function handleCommit() {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    onCommit(canvas.toDataURL("image/png"));
  }

  return (
    <section className="rounded-xl border border-slate-300 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">手绘画布</h3>
          <p className="text-xs text-slate-500">固定线宽黑色画笔，画完后再使用。</p>
        </div>
        <div className="flex gap-2">
          <button
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            onClick={clearCanvas}
            type="button"
          >
            清空重画
          </button>
          <button
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            onClick={onCancel}
            type="button"
          >
            取消手绘
          </button>
          <button
            className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white"
            disabled={!ready}
            onClick={handleCommit}
            type="button"
          >
            使用手绘稿
          </button>
        </div>
      </div>
      <div className="flex justify-center rounded-xl bg-slate-100 p-4">
        <canvas
          aria-label="手绘画布"
          className="max-h-[60vh] max-w-full cursor-crosshair border border-slate-300 bg-white"
          height={CANVAS_SIZE}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          ref={canvasRef}
          style={{ touchAction: "none" }}
          width={CANVAS_SIZE}
        />
      </div>
    </section>
  );
}
