import type { ImageCanvasTool } from "./imageEditingTypes";
import ToolModuleHeading from "./ToolModuleHeading";

interface ImageCropPanelProps {
  activeTool: ImageCanvasTool;
  busy: boolean;
  onSelectTool: (tool: "crop" | "perspective") => void;
}

export default function ImageCropPanel({
  activeTool,
  busy,
  onSelectTool,
}: ImageCropPanelProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <ToolModuleHeading icon="crop" title="裁剪" />
      <div className="grid grid-cols-2 gap-1.5">
        <button
          aria-pressed={activeTool === "crop"}
          className={
            activeTool === "crop" ? activeClass : inactiveClass
          }
          disabled={busy}
          onClick={() => onSelectTool("crop")}
          type="button"
        >
          裁剪
        </button>
        <button
          aria-pressed={activeTool === "perspective"}
          className={
            activeTool === "perspective" ? activeClass : inactiveClass
          }
          disabled={busy}
          onClick={() => onSelectTool("perspective")}
          type="button"
        >
          透视裁剪
        </button>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        裁剪：拖拽框选区域；透视裁剪：依次点击左上、右上、右下、左下四个角。
      </p>
    </section>
  );
}

const activeClass =
  "rounded-md bg-slate-950 px-2 py-1.5 text-xs font-semibold text-white";
const inactiveClass =
  "rounded-md border border-slate-300 px-2 py-1.5 text-xs";
