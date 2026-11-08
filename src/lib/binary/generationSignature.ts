import type { WorkImageState } from "../../domain/types";

export function createGenerationSignature(state: WorkImageState): string {
  const ruleSignature = state.backgroundRules
    .filter((rule) => rule.color !== null)
    .map((rule) => `${rule.color}:${rule.tolerance}`)
    .sort()
    .join("|");
  const source = [
    state.sourceDataUrl ?? "",
    state.shape,
    state.widthMm,
    state.heightMm,
    ruleSignature,
    state.effectMode,
    state.outlineThickness,
    state.sharpenAmount,
    state.outerMarginMm,
    state.processingVersion,
  ].join("\u001f");

  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < source.length; index += 1) {
    const code = source.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }

  return `${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0)
    .toString(16)
    .padStart(8, "0")}`;
}
