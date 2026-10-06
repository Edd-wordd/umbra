"use client";

import { useLayoutEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { FRAME } from "@/lib/theme/tokens";
import CoreScene, { type CoreSceneProps } from "./CoreScene";

/** 1 world unit = 1 px of the 1920x1080 reference frame, scaled to fit. */
function FitToFrame() {
  const get = useThree((s) => s.get);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  useLayoutEffect(() => {
    const { camera, invalidate } = get();
    camera.zoom = Math.min(width / FRAME.width, height / FRAME.height);
    camera.updateProjectionMatrix();
    invalidate();
  }, [get, width, height]);
  return null;
}

/**
 * The single WebGL canvas for the core (and, in Phase 5, the orrery).
 * Loaded client-only via next/dynamic (ssr: false).
 */
export default function CoreCanvas(props: CoreSceneProps) {
  return (
    <Canvas
      orthographic
      frameloop="demand"
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 100], zoom: 1, near: 0.1, far: 1000 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      aria-hidden
    >
      <FitToFrame />
      <CoreScene {...props} />
    </Canvas>
  );
}
