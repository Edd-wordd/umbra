import type { CamerasSnapshot } from "./types";

export function createSampleCamerasSnapshot(now = Date.now()): CamerasSnapshot {
  return {
    cameras: [
      { id: "device:camera:front", label: "Front Camera", location: "front", status: "online", streamUrl: "rtsp://front.local/stream", lastSeenAt: now - 30_000 },
      { id: "device:camera:garage", label: "Garage Camera", location: "garage", status: "offline", streamUrl: "rtsp://garage.local/stream", lastSeenAt: now - 42 * 60_000 },
      { id: "device:camera:backyard", label: "Backyard Camera", location: "backyard", status: "online", streamUrl: "rtsp://backyard.local/stream", lastSeenAt: now - 45_000 },
    ],
    snapshots: [{ id: "snapshot:camera:front:last", cameraId: "device:camera:front", at: now - 5 * 60_000, path: "/captures/front-last.jpg" }],
  };
}
