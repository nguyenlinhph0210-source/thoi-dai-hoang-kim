"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useProgress } from "@react-three/drei";
import type { OrbitControls as Controls } from "three-stdlib";
import { InstancedMesh, Mesh, type WebGLRenderer } from "three";
import { assessFrameWindow, QUALITY_CONFIG, type Quality } from "./quality";
import { SCENE_TRIANGLE_BUDGET, type ModelManifest } from "./assets";
import PalaceRoom from "./PalaceRoom";
import { disposeModelDecoders } from "./ModelSlot";
import type { CosmeticAppearance } from "@/types/cosmetics";
interface Props {
  appearance?: CosmeticAppearance;
  quality: Quality;
  visible: boolean;
  reducedMotion: boolean;
  onFailure: () => void;
  onQuality: (next: Quality | "2d") => void;
  onReady: () => void;
  onProgress: (value: number) => void;
  onHotspot: (text: string) => void;
}
interface Metrics {
  fps: number;
  triangles: number;
  calls: number;
  geometryTriangles: number;
  frames: number;
}
function LoadingProgress({ update }: { update: (value: number) => void }) {
  const progress = useProgress((state) => state.progress);
  useEffect(() => update(Math.max(10, progress)), [progress, update]);
  return null;
}
function Runtime({
  quality,
  visible,
  reducedMotion,
  onQuality,
  onReady,
  onFailure,
  onMetrics,
}: Props & { onMetrics: (value: Metrics) => void }) {
  const controls = useRef<Controls>(null);
  const { gl, scene, invalidate, size } = useThree();
  const motionUntil = useRef(0),
    warmUntil = useRef(0),
    dragging = useRef(false),
    ready = useRef(false);
  const wasContinuous = useRef(true);
  const sample = useRef({ start: 0, frames: 0, slow: 0, total: 0 });
  useEffect(() => {
    // Allow the projection and HTML hotspot positions to settle after a viewport resize.
    warmUntil.current = Math.max(warmUntil.current, performance.now() + 200);
    if (visible) invalidate();
  }, [size.width, size.height, visible, invalidate]);
  useEffect(() => {
    const now = performance.now();
    warmUntil.current = now + 4500;
    motionUntil.current = reducedMotion ? 0 : now + 6000;
    sample.current = {
      start: now,
      frames: 0,
      slow: 0,
      total: sample.current.total,
    };
    wasContinuous.current = true;
    if (visible) invalidate();
  }, [visible, quality, reducedMotion, invalidate]);
  useEffect(() => {
    const canvas = gl.domElement;
    gl.info.autoReset = false;
    const lost = (event: Event) => {
      event.preventDefault();
      onFailure();
    };
    canvas.addEventListener("webglcontextlost", lost);
    return () => {
      canvas.removeEventListener("webglcontextlost", lost);
      gl.info.autoReset = true;
    };
  }, [gl, onFailure]);
  useFrame(() => {
    if (!visible) return;
    const now = performance.now(),
      current = sample.current;
    // Demand-idle time is not a slow frame; only measure a continuous drawing window.
    if (!wasContinuous.current) {
      current.start = now;
      current.frames = 0;
      current.slow = 0;
    }
    current.frames++;
    current.total++;
    if (!ready.current) {
      ready.current = true;
      onReady();
    }
    if (controls.current) {
      controls.current.autoRotate =
        !reducedMotion && !dragging.current && now < motionUntil.current;
      controls.current.autoRotateSpeed = 0.08 * Math.sin(now / 1800);
    }
    if (now - current.start >= 2000) {
      let geometryTriangles = 0;
      scene.traverse((object) => {
        if (object instanceof Mesh)
          geometryTriangles +=
            ((object.geometry.index?.count ??
              object.geometry.getAttribute("position")?.count ??
              0) /
              3) *
            (object instanceof InstancedMesh ? object.count : 1);
      });
      if (geometryTriangles >= SCENE_TRIANGLE_BUDGET) {
        onFailure();
        return;
      }
      const fps = (current.frames * 1000) / (now - current.start);
      onMetrics({
        fps: Math.round(fps * 10) / 10,
        triangles: gl.info.render.triangles,
        calls: gl.info.render.calls,
        geometryTriangles,
        frames: current.total,
      });
      const assessment = assessFrameWindow(quality, fps, current.slow);
      current.start = now;
      current.frames = 0;
      current.slow = assessment.slowWindows;
      if (assessment.next !== quality) {
        current.slow = 0;
        onQuality(assessment.next);
      }
    }
    // Only warm-up, gestures and a short settling drift request new frames.
    // A truly stationary view consumes no animation frames; hidden tabs use frameloop=never.
    wasContinuous.current =
      dragging.current ||
      now < warmUntil.current ||
      (!reducedMotion && now < motionUntil.current);
    if (wasContinuous.current) invalidate();
    gl.info.reset(); // Count all passes of the next frame, including High-quality shadows.
  });
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableDamping={false}
      target={[0, 1.35, -0.6]}
      minDistance={7.5}
      maxDistance={13}
      minPolarAngle={0.9}
      maxPolarAngle={1.43}
      minAzimuthAngle={-0.48}
      maxAzimuthAngle={0.48}
      autoRotateSpeed={0.08}
      rotateSpeed={0.45}
      zoomSpeed={0.6}
      onStart={() => {
        dragging.current = true;
      }}
      onEnd={() => {
        dragging.current = false;
        motionUntil.current = reducedMotion ? 0 : performance.now() + 3000;
        invalidate();
      }}
    />
  );
}
export default function PalaceCanvas(props: Props) {
  const renderer = useRef<WebGLRenderer | null>(null);
  useEffect(
    () => () => {
      if (renderer.current) disposeModelDecoders(renderer.current);
    },
    [],
  );
  const [manifest, setManifest] = useState<ModelManifest | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [debug, setDebug] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setDebug(
      process.env.NODE_ENV === "development" &&
        new URLSearchParams(location.search).get("debug3d") === "1",
    );
    void fetch("/models/manifest.json", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("MODEL_MANIFEST_UNAVAILABLE");
        const value = (await response.json()) as ModelManifest;
        if (
          !Array.isArray(value.available) ||
          value.available.some((id) => typeof id !== "string")
        )
          throw new Error("MODEL_MANIFEST_INVALID");
        setManifest(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) props.onFailure();
      });
    return () => controller.abort();
  }, [props.onFailure]);
  if (!manifest) return null;
  return (
    <>
      <Canvas
        onCreated={(state) => {
          renderer.current = state.gl;
        }}
        className="palace-canvas"
        frameloop={props.visible ? "demand" : "never"}
        dpr={[1, QUALITY_CONFIG[props.quality].dpr]}
        shadows={props.quality === "high" ? "soft" : false}
        camera={{ position: [0, 4.1, 10.5], fov: 49, near: 0.1, far: 45 }}
        gl={{
          antialias: props.quality !== "low",
          alpha: false,
          powerPreference: "low-power",
        }}
        fallback={<span>Trình duyệt không hiển thị được cảnh 3D.</span>}
      >
        <color attach="background" args={["#d9c9aa"]} />
        <hemisphereLight args={["#fff1d0", "#594132", 2.1]} />
        <directionalLight
          position={[3, 7, 4]}
          intensity={2.3}
          color="#ffe1ac"
          castShadow={props.quality === "high"}
          shadow-mapSize={[512, 512]}
          shadow-camera-left={-7}
          shadow-camera-right={7}
          shadow-camera-top={6}
          shadow-camera-bottom={-6}
          shadow-bias={-0.002}
        />
        <LoadingProgress update={props.onProgress} />
        <Suspense fallback={null}>
          <PalaceRoom
            appearance={props.appearance}
            available={manifest.available}
            onHotspot={props.onHotspot}
          />
          <Runtime {...props} onMetrics={setMetrics} />
        </Suspense>
      </Canvas>
      {debug && (
        <output
          className="palace-debug"
          data-testid="3d-metrics"
          data-metrics={JSON.stringify(metrics)}
        >
          {metrics
            ? `${metrics.fps} FPS · ${metrics.geometryTriangles} tam giác hình học · ${metrics.triangles} tam giác vẽ · ${metrics.calls} draw call · ${metrics.frames} khung`
            : "Đang đo cảnh…"}
        </output>
      )}
    </>
  );
}
