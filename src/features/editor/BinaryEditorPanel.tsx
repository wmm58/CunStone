import type {
  BorderStyle,
  CarvingMode,
  SealOrientation,
  WorkBinaryEditState,
} from "../../domain/types";
import {
  BORDER_MARGIN_STEP_MM,
  MAX_BORDER_MARGIN_MM,
  MIN_BORDER_MARGIN_MM,
} from "../../domain/types";
import type { EditTool } from "./binaryEditing";
import ToolModuleHeading from "./ToolModuleHeading";

interface BinaryEditorPanelProps {
  binaryState: WorkBinaryEditState;
  disabled: boolean;
  tool: EditTool;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  onChange: (next: WorkBinaryEditState) => void;
  onToolChange: (tool: EditTool) => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
}

export default function BinaryEditorPanel({
  binaryState,
  disabled,
  tool,
  canUndo,
  canRedo,
  zoom,
  onChange,
  onToolChange,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onZoomFit,
}: BinaryEditorPanelProps) {
  return (
    <>
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <ToolModuleHeading icon="brush" title="手绘" />
        {disabled ? (
          <p className="mb-3 text-xs text-amber-700">
            请先生成黑白稿，再使用编辑工具
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            aria-pressed={tool === "brush"}
            className={tool === "brush" ? activeButtonClass : buttonClass}
            disabled={disabled}
            onClick={() => onToolChange("brush")}
            type="button"
          >
            画笔
          </button>
          <button
            aria-pressed={tool === "eraser"}
            className={tool === "eraser" ? activeButtonClass : buttonClass}
            disabled={disabled}
            onClick={() => onToolChange("eraser")}
            type="button"
          >
            橡皮
          </button>
          <button
            className={buttonClass}
            disabled={disabled || !canUndo}
            onClick={onUndo}
            type="button"
          >
            撤销
          </button>
          <button
            className={buttonClass}
            disabled={disabled || !canRedo}
            onClick={onRedo}
            type="button"
          >
            重做
          </button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <button className={buttonClass} disabled={disabled} onClick={onZoomOut} type="button">
            缩小
          </button>
          <button className={buttonClass} disabled={disabled} onClick={onZoomIn} type="button">
            放大
          </button>
          <button className={buttonClass} disabled={disabled} onClick={onZoomFit} type="button">
            适应视图
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">当前缩放 {zoom}%</p>
        {tool === "brush" ? (
          <label className="mt-3 block text-xs text-slate-600">
            画笔大小 {binaryState.brushSize} px
            <input
              aria-label="画笔大小"
              className="mt-1 w-full accent-slate-900"
              disabled={disabled}
              max={32}
              min={1}
              onChange={(event) =>
                onChange({
                  ...binaryState,
                  brushSize: clamp(Number(event.target.value), 1, 32),
                })
              }
              type="range"
              value={binaryState.brushSize}
            />
          </label>
        ) : (
          <label className="mt-3 block text-xs text-slate-600">
            橡皮大小 {binaryState.eraserSize} px
            <input
              aria-label="橡皮大小"
              className="mt-1 w-full accent-slate-900"
              disabled={disabled}
              max={32}
              min={1}
              onChange={(event) =>
                onChange({
                  ...binaryState,
                  eraserSize: clamp(Number(event.target.value), 1, 32),
                })
              }
              type="range"
              value={binaryState.eraserSize}
            />
          </label>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <ToolModuleHeading icon="seal" title="阴 / 阳刻与边框" />
        <div className="grid grid-cols-2 gap-1.5">
          {(
            [
              ["yang", "阳刻"],
              ["yin", "阴刻"],
            ] as const
          ).map(([value, label]) => (
            <button
              aria-pressed={binaryState.carvingMode === value}
              className={
                binaryState.carvingMode === value ? activeButtonClass : buttonClass
              }
              disabled={disabled}
              key={value}
              onClick={() =>
                onChange({ ...binaryState, carvingMode: value as CarvingMode })
              }
              type="button"
            >
              {label}
            </button>
          ))}
          {(
            [
              ["normal", "正常方向"],
              ["mirror", "左右镜像"],
            ] as const
          ).map(([value, label]) => (
            <button
              aria-pressed={binaryState.orientation === value}
              className={
                binaryState.orientation === value ? activeButtonClass : buttonClass
              }
              disabled={disabled}
              key={value}
              onClick={() =>
                onChange({
                  ...binaryState,
                  orientation: value as SealOrientation,
                })
              }
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          {(
            [
              ["none", "无边框"],
              ["single", "单线"],
              ["double", "双线"],
            ] as const
          ).map(([value, label]) => (
            <button
              aria-pressed={binaryState.borderStyle === value}
              className={
                binaryState.borderStyle === value ? activeButtonClass : buttonClass
              }
              disabled={disabled}
              key={value}
              onClick={() =>
                onChange({
                  ...binaryState,
                  borderStyle: value as BorderStyle,
                })
              }
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
        <label className="mt-3 block text-xs text-slate-600">
          边框粗细 {binaryState.borderThickness}
          <input
            aria-label="边框粗细"
            className="mt-1 w-full accent-slate-900"
            disabled={disabled || binaryState.borderStyle === "none"}
            max={8}
            min={1}
            onChange={(event) =>
              onChange({
                ...binaryState,
                borderThickness: clamp(Number(event.target.value), 1, 8),
              })
            }
            type="range"
            value={binaryState.borderThickness}
          />
        </label>
        <label className="mt-3 block text-xs text-slate-600">
          外边距 {binaryState.borderMarginMm} mm
          <input
            aria-label="边框外边距"
            className="mt-1 w-full accent-slate-900"
            disabled={disabled || binaryState.borderStyle === "none"}
            max={MAX_BORDER_MARGIN_MM}
            min={MIN_BORDER_MARGIN_MM}
            onChange={(event) =>
              onChange({
                ...binaryState,
                borderMarginMm: clampMargin(Number(event.target.value)),
              })
            }
            step={BORDER_MARGIN_STEP_MM}
            type="range"
            value={binaryState.borderMarginMm}
          />
        </label>
      </section>
    </>
  );
}

const buttonClass =
  "rounded-md border border-slate-300 px-2 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50";
const activeButtonClass =
  "rounded-md bg-slate-950 px-2 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50";

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}

function clampMargin(value: number): number {
  const clamped = Math.min(
    MAX_BORDER_MARGIN_MM,
    Math.max(MIN_BORDER_MARGIN_MM, Number.isFinite(value) ? value : 0),
  );
  return Math.round(clamped * 10) / 10;
}
