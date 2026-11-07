import { useEffect, useState, type ChangeEvent } from "react";

import type { WorkImageState } from "../../domain/types";
import {
  applyRecommendation,
  isValidSealDimension,
  recommendationsForShape,
  selectShape,
} from "./sealOptions";

interface ImagePreparationPanelProps {
  imageState: WorkImageState;
  sourceAvailable: boolean;
  fileName: string;
  busy: boolean;
  onRequestChange: (next: WorkImageState) => void;
  onUploadFile: (file: File) => void;
  onStartDrawing: () => void;
}

export default function ImagePreparationPanel({
  imageState,
  sourceAvailable,
  fileName,
  busy,
  onRequestChange,
  onUploadFile,
  onStartDrawing,
}: ImagePreparationPanelProps) {
  const [widthInput, setWidthInput] = useState(String(imageState.widthMm));
  const [heightInput, setHeightInput] = useState(String(imageState.heightMm));
  const [error, setError] = useState("");

  useEffect(() => {
    setWidthInput(String(imageState.widthMm));
    setHeightInput(String(imageState.heightMm));
  }, [imageState.heightMm, imageState.widthMm]);

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) {
      onUploadFile(file);
    }
  }

  function handleShape(shape: WorkImageState["shape"]) {
    const next = selectShape(imageState, shape);
    setWidthInput(String(next.widthMm));
    setHeightInput(String(next.heightMm));
    setError("");
    onRequestChange(next);
  }

  function handleRecommendation(widthMm: number, heightMm: number) {
    setWidthInput(String(widthMm));
    setHeightInput(String(heightMm));
    setError("");
    onRequestChange(applyRecommendation(imageState, widthMm, heightMm));
  }

  function commitDimensions() {
    const width = Number(widthInput);
    const height = Number(heightInput);
    if (!isValidSealDimension(width) || !isValidSealDimension(height)) {
      setError("尺寸需在 10–100 mm 之间");
      return;
    }
    setError("");
    onRequestChange({ ...imageState, widthMm: width, heightMm: height });
  }

  function updateDimension(dimension: "width" | "height", value: string) {
    if (dimension === "width") {
      setWidthInput(value);
      if (imageState.shape === "square" || imageState.shape === "circle") {
        setHeightInput(value);
      }
    } else {
      setHeightInput(value);
      if (imageState.shape === "square" || imageState.shape === "circle") {
        setWidthInput(value);
      }
    }
  }

  return (
    <>
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">
          01 外形与实际尺寸
        </h3>
        <div className="grid grid-cols-2 gap-1.5">
          {(["square", "rectangle", "circle", "custom"] as const).map((shape) => (
            <button
              aria-pressed={imageState.shape === shape}
              className={
                imageState.shape === shape
                  ? "rounded-md bg-slate-950 px-2 py-1.5 text-xs font-semibold text-white"
                  : "rounded-md border border-slate-300 px-2 py-1.5 text-xs"
              }
              disabled={busy}
              key={shape}
              onClick={() => handleShape(shape)}
              type="button"
            >
              {shapeLabel(shape)}
            </button>
          ))}
        </div>
        {recommendationsForShape(imageState.shape).length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {recommendationsForShape(imageState.shape).map((option) => (
              <button
                className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                disabled={busy}
                key={option.label}
                onClick={() => handleRecommendation(option.widthMm, option.heightMm)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="text-xs text-slate-600">
            宽 (mm)
            <input
              aria-label="宽 (mm)"
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
              disabled={busy}
              inputMode="decimal"
              onBlur={commitDimensions}
              onChange={(event) => updateDimension("width", event.target.value)}
              value={widthInput}
            />
          </label>
          <label className="text-xs text-slate-600">
            高 (mm)
            <input
              aria-label="高 (mm)"
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
              disabled={busy}
              inputMode="decimal"
              onBlur={commitDimensions}
              onChange={(event) => updateDimension("height", event.target.value)}
              value={heightInput}
            />
          </label>
        </div>
        {error ? (
          <p className="mt-2 text-xs text-red-700" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">
          02 输入完整画面
        </h3>
        <div className="flex flex-wrap gap-2">
          <label className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium">
            上传图片
            <input
              accept="image/png,image/jpeg,image/webp"
              aria-label="上传图片"
              className="sr-only"
              disabled={busy}
              onChange={handleFile}
              type="file"
            />
          </label>
          <button
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium"
            disabled={busy}
            onClick={onStartDrawing}
            type="button"
          >
            手绘画布
          </button>
        </div>
        {fileName ? (
          <p className="mt-2 truncate text-xs text-slate-500">
            当前文件：{fileName}
          </p>
        ) : null}
        <p className="mt-2 text-xs leading-5 text-slate-500">
          仅支持完整构图；单文件不超过 10 MB。
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">
          03 纯色背景去除
        </h3>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span>已选背景色</span>
          <span
            className="h-4 w-4 rounded border border-slate-300"
            style={{ backgroundColor: imageState.backgroundColor ?? "#ffffff" }}
          />
          <span>{imageState.backgroundColor ?? "未选择"}</span>
        </div>
        {imageState.backgroundColor ? (
          <button
            className="mt-2 text-xs font-medium text-slate-700 underline"
            disabled={busy}
            onClick={() => onRequestChange({ ...imageState, backgroundColor: null })}
            type="button"
          >
            重新点选背景
          </button>
        ) : null}
        <label className="mt-3 block text-xs text-slate-600">
          背景容差 {imageState.tolerance}
          <input
            aria-label="背景容差"
            className="mt-1 w-full accent-slate-900"
            disabled={busy || !sourceAvailable}
            max={100}
            min={0}
            onChange={(event) =>
              onRequestChange({
                ...imageState,
                tolerance: Number(event.target.value),
              })
            }
            type="range"
            value={imageState.tolerance}
          />
        </label>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          在输入画布点击背景取样。残留边缘可在黑白稿编辑中使用橡皮修整。
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">
          04 效果与适配
        </h3>
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
        <p className="mt-3 text-xs leading-5 text-slate-500">
          本地自动缩放、居中、锐化和外形裁切；不包含透视校正。
        </p>
      </section>
    </>
  );
}

function shapeLabel(shape: WorkImageState["shape"]): string {
  return {
    square: "正方形",
    rectangle: "长方形",
    circle: "圆形",
    custom: "自定义",
  }[shape];
}
