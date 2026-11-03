export type WorkStatus = "draft" | "completed";
export type SealShape = "square" | "rectangle" | "circle" | "custom";
export type EffectMode = "silhouette" | "outline";
export type ImageSourceKind = "upload" | "drawing";

export interface WorkImageState {
  sourceKind: ImageSourceKind | null;
  sourceDataUrl: string | null;
  shape: SealShape;
  widthMm: number;
  heightMm: number;
  backgroundColor: string | null;
  tolerance: number;
  effectMode: EffectMode;
  processingVersion: 1;
}

export function createDefaultWorkImageState(): WorkImageState {
  return {
    sourceKind: null,
    sourceDataUrl: null,
    shape: "square",
    widthMm: 25,
    heightMm: 25,
    backgroundColor: null,
    tolerance: 20,
    effectMode: "silhouette",
    processingVersion: 1,
  };
}

export interface LocalUser {
  id: string;
  phone: string;
  createdAt: string;
}

export interface WorkRecord {
  id: string;
  ownerId: string;
  name: string;
  status: WorkStatus;
  createdAt: string;
  lastSavedAt: string;
  imageState: WorkImageState;
}
