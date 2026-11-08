import type { BackgroundRemovalRule } from "../../domain/types";
import ToolModuleHeading from "./ToolModuleHeading";

interface BackgroundRemovalPanelProps {
  activeRuleId: string | null;
  busy: boolean;
  rules: BackgroundRemovalRule[];
  onActivateRule: (id: string) => void;
  onAddRule: () => void;
  onRemoveRule: (id: string) => void;
  onToleranceChange: (id: string, tolerance: number) => void;
}

export default function BackgroundRemovalPanel({
  activeRuleId,
  busy,
  rules,
  onActivateRule,
  onAddRule,
  onRemoveRule,
  onToleranceChange,
}: BackgroundRemovalPanelProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <ToolModuleHeading icon="background" title="纯色背景去除" />
      <p className="mb-3 text-xs leading-5 text-slate-500">
        点击背景区域指定要移除的颜色
      </p>
      <div className="space-y-2">
        {rules.map((rule, index) => (
          <div
            className={
              rule.id === activeRuleId
                ? "rounded-lg border border-slate-900 bg-slate-50 p-2"
                : "rounded-lg border border-slate-200 p-2"
            }
            key={rule.id}
          >
            <div className="flex items-center gap-2">
              <button
                aria-label={`选择背景颜色规则 ${index + 1}`}
                aria-pressed={rule.id === activeRuleId}
                className="flex min-w-0 flex-1 items-center gap-2 text-left text-xs"
                disabled={busy}
                onClick={() => onActivateRule(rule.id)}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 rounded border border-slate-300"
                  style={{ backgroundColor: rule.color ?? "#ffffff" }}
                />
                <span className="truncate">
                  {rule.color ? rule.color.toUpperCase() : "待点选颜色"}
                </span>
                {rule.id === activeRuleId ? (
                  <span className="shrink-0 text-[10px] text-slate-500">当前</span>
                ) : null}
              </button>
              <button
                aria-label={`删除背景颜色规则 ${index + 1}`}
                className="rounded border border-slate-300 px-2 py-0.5 text-xs"
                disabled={busy}
                onClick={() => onRemoveRule(rule.id)}
                type="button"
              >
                −
              </button>
            </div>
            <label className="mt-2 block text-[11px] text-slate-600">
              颜色 {index + 1} 容差 {rule.tolerance}
              <input
                aria-label={`颜色 ${index + 1} 容差`}
                className="mt-1 w-full accent-slate-900"
                disabled={busy}
                max={100}
                min={0}
                onChange={(event) =>
                  onToleranceChange(rule.id, Number(event.target.value))
                }
                type="range"
                value={rule.tolerance}
              />
            </label>
          </div>
        ))}
      </div>
      <button
        className="mt-3 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
        disabled={busy || rules.length >= 10}
        onClick={onAddRule}
        type="button"
      >
        添加待选颜色
      </button>
    </section>
  );
}
