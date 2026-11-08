import type { ImageCanvasTool } from "./imageEditingTypes";
import ToolModuleHeading from "./ToolModuleHeading";

interface ImageEraserPanelProps {
  activeTool: ImageCanvasTool;
  busy: boolean;
  eraserSize: number;
  onSelectTool: () => void;
  onSizeChange: (size: number) => void;
}

export default function ImageEraserPanel({
  activeTool,
  busy,
  eraserSize,
  onSelectTool,
  onSizeChange,
}: ImageEraserPanelProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <ToolModuleHeading icon="eraser" title="橡皮" />
      <button
        aria-pressed={activeTool === "eraser"}
        className={
          activeTool === "eraser"
            ? "rounded-md bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white"
            : "rounded-md border border-slate-300 px-3 py-1.5 text-xs"
        }
        disabled={busy}
        onClick={onSelectTool}
        type="button"
      >
        使用橡皮
      </button>
      <label className="mt-3 block text-xs text-slate-600">
        橡皮大小 {eraserSize} px
        <input
          aria-label="图片橡皮大小"
          className="mt-1 w-full accent-slate-900"
          disabled={busy || activeTool !== "eraser"}
          max={80}
          min={1}
          onChange={(event) =>
            onSizeChange(
              Math.min(80, Math.max(1, Math.round(Number(event.target.value)))),
            )
          }
          type="range"
          value={eraserSize}
        />
      </label>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        在画布拖拽擦除不需要的图片区域，透明区域不会进入黑白稿。
      </p>
    </section>
  );
}
