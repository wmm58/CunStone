export type WorkStatus = "draft" | "completed";

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
}
