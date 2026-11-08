import type { ChangeEvent, RefObject } from "react";
import ToolModuleHeading from "./ToolModuleHeading";

interface ImageInputPanelProps {
  busy: boolean;
  fileName: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onRequestUpload: () => void;
  onUploadFile: (file: File) => void;
}

export default function ImageInputPanel({
  busy,
  fileName,
  inputRef,
  onRequestUpload,
  onUploadFile,
}: ImageInputPanelProps) {
  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) {
      onUploadFile(file);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <ToolModuleHeading icon="upload" title="上传图片" />
      <button
        className="inline-flex rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium"
        onClick={onRequestUpload}
        type="button"
      >
        上传图片
      </button>
      <input
        accept="image/png,image/jpeg,image/webp"
        aria-label="上传图片"
        className="sr-only"
        disabled={busy}
        onChange={handleFile}
        ref={inputRef}
        type="file"
      />
      {fileName ? (
        <p className="mt-2 truncate text-xs text-slate-500">当前文件：{fileName}</p>
      ) : null}
      <p className="mt-2 text-xs leading-5 text-slate-500">
        仅支持完整构图；单文件不超过 10 MB。
      </p>
    </section>
  );
}
