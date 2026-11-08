import { useEffect, useState } from "react";

import type { WorkImageState } from "../../domain/types";
import {
  isValidSealDimension,
  sanitizeDimensionInput,
  selectShape,
} from "./sealOptions";
import ToolModuleHeading from "./ToolModuleHeading";

interface ShapeSizePanelProps {
  busy: boolean;
  imageState: WorkImageState;
  onRequestChange: (next: WorkImageState) => void;
}

export default function ShapeSizePanel({
  busy,
  imageState,
  onRequestChange,
}: ShapeSizePanelProps) {
  const [widthInput, setWidthInput] = useState(String(imageState.widthMm));
  const [heightInput, setHeightInput] = useState(String(imageState.heightMm));
  const [error, setError] = useState("");

  useEffect(() => {
    setWidthInput(String(imageState.widthMm));
    setHeightInput(String(imageState.heightMm));
  }, [imageState.heightMm, imageState.widthMm]);

  function handleShape(shape: WorkImageState["shape"]) {
    const next = selectShape(imageState, shape);
    setWidthInput(String(next.widthMm));
    setHeightInput(String(next.heightMm));
    setError("");
    onRequestChange(next);
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
    const sanitized = sanitizeDimensionInput(value);
    if (dimension === "width") {
      setWidthInput(sanitized);
      if (imageState.shape === "square" || imageState.shape === "circle") {
        setHeightInput(sanitized);
      }
    } else {
      setHeightInput(sanitized);
      if (imageState.shape === "square" || imageState.shape === "circle") {
        setWidthInput(sanitized);
      }
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <ToolModuleHeading icon="shape" title="外形与尺寸" />
      <div className="grid grid-cols-3 gap-1.5">
        {(["square", "rectangle", "circle"] as const).map((shape) => (
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
  );
}

function shapeLabel(shape: WorkImageState["shape"]): string {
  return {
    square: "正方形",
    rectangle: "长方形",
    circle: "圆形",
  }[shape];
}
