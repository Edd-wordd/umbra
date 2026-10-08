export interface CameraSource {
  id: string;
  label: string;
  location: string;
  status: "online" | "offline" | "unreachable";
  streamUrl?: string;
  lastSeenAt?: number;
}

export interface CameraSnapshotEvent {
  id: string;
  cameraId: string;
  at: number;
  path?: string;
}

export interface CamerasSnapshot {
  cameras: CameraSource[];
  snapshots: CameraSnapshotEvent[];
}
