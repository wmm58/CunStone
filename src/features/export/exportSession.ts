let exportWorkIds: string[] = [];

export function setExportWorkIds(ids: readonly string[]): void {
  exportWorkIds = [...new Set(ids)];
}

export function peekExportWorkIds(): string[] {
  return [...exportWorkIds];
}

export function takeExportWorkIds(): string[] {
  const ids = peekExportWorkIds();
  exportWorkIds = [];
  return ids;
}
