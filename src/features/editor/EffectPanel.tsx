import {
  MAX_OUTER_MARGIN_MM,
  MIN_OUTER_MARGIN_MM,
  OUTER_MARGIN_STEP_MM,
  type WorkImageState,
} from "../../domain/types";
import ToolModuleHeading from "./ToolModuleHeading";

interface EffectPanelProps {
  busy: boolean;
  imageState: WorkImageState;
  onRequestChange: (next: WorkImageState) => void;
}

export default function EffectPanel({
  busy,
  imageState,
  onRequestChange,
}: EffectPanelProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <ToolModuleHeading icon="effect" title="效果与适配" />
      <div className="grid grid-cols-2 gap-1.5">
        <button
          aria-pressed={imageState.effectMode === "silhouette"}
          className={
            imageState.effectMode === "silhouette"
              ? "rounded-md bg-slate-950 px-2 py-1.5 text-xs font-semibold text-white"
              : "rounded-md border border-slate-300 px-2 py-1.5 text-xs"
          }
          disabled={busy}
          onClick={() => onRequestChange({ ...imageState, effectMode: "silhouette" })}
          type="button"
        >
          实心剪影
        </button>
        <button
          aria-pressed={imageState.effectMode === "outline"}
          className={
            imageState.effectMode === "outline"
              ? "rounded-md bg-slate-950 px-2 py-1.5 text-xs font-semibold text-white"
              : "rounded-md border border-slate-300 px-2 py-1.5 text-xs"
          }
          disabled={busy}
          onClick={() => onRequestChange({ ...imageState, effectMode: "outline" })}
          type="button"
        >
          轮廓线稿
        </button>
      </div>
      <label className="mt-3 block text-xs text-slate-600">
        锐化大小 {imageState.sharpenAmount}
        <input
          aria-label="锐化大小"
          className="mt-1 w-full accent-slate-900"
          disabled={busy}
          max={8}
          min={0}
          onChange={(event) =>
            onRequestChange({
              ...imageState,
              sharpenAmount: Math.min(
                8,
                Math.max(0, Math.round(Number(event.target.value))),
              ),
            })
          }
          type="range"
          value={imageState.sharpenAmount}
        />
      </label>
      <label className="mt-3 block text-xs text-slate-600">
        外边距 {imageState.outerMarginMm} mm
        <input
          aria-label="图片外边距"
          className="mt-1 w-full accent-slate-900"
          disabled={busy}
          max={MAX_OUTER_MARGIN_MM}
          min={MIN_OUTER_MARGIN_MM}
          onChange={(event) =>
            onRequestChange({
              ...imageState,
              outerMarginMm: clampMargin(Number(event.target.value)),
            })
          }
          step={OUTER_MARGIN_STEP_MM}
          type="range"
          value={imageState.outerMarginMm}
        />
      </label>
      {imageState.effectMode === "outline" ? (
        <label className="mt-3 block text-xs text-slate-600">
          轮廓粗细 {imageState.outlineThickness}
          <input
            aria-label="轮廓粗细"
            className="mt-1 w-full accent-slate-900"
            disabled={busy}
            max={8}
            min={1}
            onChange={(event) =>
              onRequestChange({
                ...imageState,
                outlineThickness: Math.min(
                  8,
                  Math.max(1, Math.round(Number(event.target.value))),
                ),
              })
            }
            type="range"
            value={imageState.outlineThickness}
          />
        </label>
      ) : null}
      <p className="mt-3 text-xs leading-5 text-slate-500">
        本地自动缩放、居中、锐化和外形裁切；不包含透视校正。
      </p>
    </section>
  );
}

function clampMargin(value: number): number {
  const clamped = Math.min(
    MAX_OUTER_MARGIN_MM,
    Math.max(MIN_OUTER_MARGIN_MM, Number.isFinite(value) ? value : 0),
  );
  return Math.round(clamped * 10) / 10;
}
