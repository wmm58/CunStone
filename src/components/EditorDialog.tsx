import type { ReactNode } from "react";

interface EditorDialogProps {
  actions: ReactNode;
  children: ReactNode;
  title: string;
}

export default function EditorDialog({
  actions,
  children,
  title,
}: EditorDialogProps) {
  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
      role="dialog"
      aria-label={title}
    >
      <section className="w-full max-w-md rounded-2xl border border-slate-300 bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold tracking-[0.02em] text-slate-950">
          {title}
        </h2>
        <div className="mt-3 text-sm leading-6 text-slate-600">{children}</div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">{actions}</div>
      </section>
    </div>
  );
}

export const dialogSecondaryButtonClass =
  "rounded-lg border border-slate-300 px-4 py-2 text-sm";
export const dialogPrimaryButtonClass =
  "rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white";
