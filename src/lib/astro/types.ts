export interface AstroDevice {
  id: string;
  label: string;
  kind: "pi" | "mount" | "camera";
  status: "connected" | "disconnected" | "unknown";
}

export interface AstroTarget {
  id: string;
  label: string;
  status: "visible" | "upcoming" | "not_visible";
  bestAt?: number;
  altitude?: number;
}

export interface AstroSession {
  id: string;
  targetId: string;
  title: string;
  status: "captured" | "imported" | "logged" | "needs_import";
  capturedAt: number;
  lights: number;
  darks: number;
  flats: number;
  bias: number;
  imageSetId?: string;
}

export interface AstroSnapshot {
  devices: AstroDevice[];
  targets: AstroTarget[];
  sessions: AstroSession[];
}
