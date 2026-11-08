import type { WorkImageState } from "../../domain/types";
import EffectPanel from "./EffectPanel";
import ShapeSizePanel from "./ShapeSizePanel";

interface BinaryPreparationPanelProps {
  busy: boolean;
  imageState: WorkImageState;
  sourceAvailable: boolean;
  onRequestChange: (next: WorkImageState) => void;
}

export default function BinaryPreparationPanel({
  busy,
  imageState,
  sourceAvailable,
  onRequestChange,
}: BinaryPreparationPanelProps) {
  return (
    <>
      <ShapeSizePanel
        busy={busy}
        imageState={imageState}
        onRequestChange={onRequestChange}
      />
      <EffectPanel
        busy={busy}
        imageState={imageState}
        onRequestChange={onRequestChange}
      />
      {!sourceAvailable ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          上传并生成黑白基础稿后才能使用黑白稿编辑工具。
        </p>
      ) : null}
    </>
  );
}
