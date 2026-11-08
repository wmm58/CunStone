import type { RefObject } from "react";

import type { BackgroundRemovalRule } from "../../domain/types";
import BackgroundRemovalPanel from "./BackgroundRemovalPanel";
import ImageCropPanel from "./ImageCropPanel";
import ImageEraserPanel from "./ImageEraserPanel";
import ImageInputPanel from "./ImageInputPanel";
import type { ImageCanvasTool } from "./imageEditingTypes";

interface InputEditingPanelProps {
  activeRuleId: string | null;
  activeTool: ImageCanvasTool;
  busy: boolean;
  eraserSize: number;
  fileName: string;
  inputRef: RefObject<HTMLInputElement | null>;
  rules: BackgroundRemovalRule[];
  onActivateRule: (id: string) => void;
  onAddRule: () => void;
  onRemoveRule: (id: string) => void;
  onRequestUpload: () => void;
  onSelectTool: (tool: ImageCanvasTool) => void;
  onEraserSizeChange: (size: number) => void;
  onToleranceChange: (id: string, tolerance: number) => void;
  onUploadFile: (file: File) => void;
}

export default function InputEditingPanel(props: InputEditingPanelProps) {
  return (
    <>
      <ImageInputPanel
        busy={props.busy}
        fileName={props.fileName}
        inputRef={props.inputRef}
        onRequestUpload={props.onRequestUpload}
        onUploadFile={props.onUploadFile}
      />
      <BackgroundRemovalPanel
        activeRuleId={props.activeRuleId}
        busy={props.busy}
        onActivateRule={props.onActivateRule}
        onAddRule={props.onAddRule}
        onRemoveRule={props.onRemoveRule}
        onToleranceChange={props.onToleranceChange}
        rules={props.rules}
      />
      <ImageCropPanel
        activeTool={props.activeTool}
        busy={props.busy}
        onSelectTool={props.onSelectTool}
      />
      <ImageEraserPanel
        activeTool={props.activeTool}
        busy={props.busy}
        eraserSize={props.eraserSize}
        onSelectTool={() => props.onSelectTool("eraser")}
        onSizeChange={props.onEraserSizeChange}
      />
    </>
  );
}
