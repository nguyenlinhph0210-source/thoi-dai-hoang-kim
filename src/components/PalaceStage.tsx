"use client";
import dynamic from "next/dynamic";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Settings2 } from "lucide-react";
import PalaceIllustration from "./PalaceIllustration";
import SceneErrorBoundary from "./SceneErrorBoundary";
import {
  chooseDeviceQuality,
  DEFAULT_GRAPHICS,
  GRAPHICS_STORAGE_KEY,
  parseGraphicsPreference,
  QUALITY_LABELS,
  supportsWebGL2,
  type GraphicsPreference,
  type Quality,
} from "@/3d/quality";

// No three/fiber/drei import anywhere above this conditional, client-only boundary.
const PalaceCanvas = dynamic(() => import("@/3d/PalaceCanvas"), { ssr: false });
function PalaceStage({ active }: { active: boolean }) {
  const root = useRef<HTMLElement>(null);
  const [preference, setPreference] =
    useState<GraphicsPreference>(DEFAULT_GRAPHICS);
  const [quality, setQuality] = useState<Quality | "2d">("2d");
  const [initialized, setInitialized] = useState(false),
    [reason, setReason] = useState("");
  const [visible, setVisible] = useState(false),
    [reducedMotion, setReducedMotion] = useState(false);
  const [ready, setReady] = useState(false),
    [progress, setProgress] = useState(0);
  const [caption, setCaption] = useState(""),
    [generation, setGeneration] = useState(0);
  const configure = useCallback((next: GraphicsPreference) => {
    const hints = navigator as Navigator & {
      deviceMemory?: number;
      connection?: { saveData?: boolean };
    };
    const automatic = chooseDeviceQuality({
      dpr: window.devicePixelRatio || 1,
      cores: navigator.hardwareConcurrency,
      memoryGb: hints.deviceMemory,
      saveData: hints.connection?.saveData,
    });
    let level =
      next.mode === "2d"
        ? ("2d" as const)
        : next.quality === "auto"
          ? automatic
          : next.quality;
    if (next.mode === "3d" && level === "2d") level = "low";
    let notice =
      next.mode === "auto" && level === "2d"
        ? "Thiết bị đang dùng nền 2D để tiết kiệm tài nguyên."
        : "";
    if (level !== "2d" && !supportsWebGL2()) {
      level = "2d";
      notice = "Thiết bị chưa hỗ trợ WebGL 2. Bạn vẫn chơi đầy đủ ở chế độ 2D.";
    }
    setQuality(level);
    setReason(notice);
    setReady(false);
    setProgress(0);
    setCaption("");
    setGeneration((n) => n + 1);
  }, []);
  useEffect(() => {
    let value = DEFAULT_GRAPHICS;
    try {
      value = parseGraphicsPreference(
        localStorage.getItem(GRAPHICS_STORAGE_KEY),
      );
    } catch {
      /* private mode */
    }
    setPreference(value);
    configure(value);
    setInitialized(true);
  }, [configure]);
  useEffect(() => {
    const desktop = matchMedia("(min-width: 1024px)"),
      motion = matchMedia("(prefers-reduced-motion: reduce)");
    let intersecting = true;
    const update = () => {
      setVisible(
        document.visibilityState === "visible" &&
          (desktop.matches || active) &&
          intersecting,
      );
      setReducedMotion(motion.matches);
    };
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => {
            intersecting = entry.isIntersecting;
            update();
          });
    if (root.current) observer?.observe(root.current);
    update();
    desktop.addEventListener("change", update);
    motion.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer?.disconnect();
      desktop.removeEventListener("change", update);
      motion.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [active]);
  const select = (value: string) => {
    const next: GraphicsPreference =
      value === "auto"
        ? { mode: "auto", quality: "auto" }
        : value === "2d"
          ? { mode: "2d", quality: "auto" }
          : { mode: "3d", quality: value as Quality };
    setPreference(next);
    configure(next);
    try {
      localStorage.setItem(GRAPHICS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* Settings still apply this session. */
    }
  };
  const failure = useCallback(() => {
    // Static diagnostic only: no exception object, URL, account or device information.
    console.error("[graphics] SCENE_UNAVAILABLE: switched to 2D");
    setQuality("2d");
    setReady(false);
    setReason("Cảnh 3D chưa khả dụng. Bạn vẫn chơi đầy đủ ở chế độ 2D.");
  }, []);
  const adapt = useCallback((next: Quality | "2d") => {
    setQuality(next);
    setReason(
      next === "2d"
        ? "Đã chuyển nền 2D để giữ trải nghiệm mượt."
        : "Đã giảm chất lượng cảnh để giữ trải nghiệm mượt.",
    );
  }, []);
  const markReady = useCallback(() => {
    setReady(true);
    setProgress(100);
  }, []);
  const mode = quality === "2d" ? "2d" : "3d";
  const selected =
    preference.mode === "auto"
      ? "auto"
      : preference.mode === "2d"
        ? "2d"
        : preference.quality;
  return (
    <section
      ref={root}
      className="palace-stage"
      aria-label="Cung viện của bạn"
      data-testid="palace-stage"
      data-mode={mode}
    >
      <div className="palace-viewport">
        <div className="palace-flat" aria-hidden="true">
          <PalaceIllustration />
        </div>
        {initialized && mode === "3d" && (
          <SceneErrorBoundary key={generation} onFailure={failure}>
            <PalaceCanvas
              quality={quality as Quality}
              visible={visible}
              reducedMotion={reducedMotion}
              onFailure={failure}
              onQuality={adapt}
              onReady={markReady}
              onProgress={setProgress}
              onHotspot={setCaption}
            />
          </SceneErrorBoundary>
        )}
        {initialized && mode === "3d" && !ready && (
          <div className="palace-loading" role="status">
            <span>Đang mở cửa cung viện…</span>
            <progress
              aria-label="Tiến độ tải cảnh"
              max={100}
              value={progress}
            />
          </div>
        )}
        <div className="palace-title">
          <span className="eyebrow">MỘT GÓC YÊN GIỮA CHỐN CUNG ĐÌNH</span>
          <h2>Cung viện của bạn</h2>
          <p>
            {mode === "3d"
              ? "Kéo để ngắm nhìn · Véo hoặc cuộn để đổi khoảng cách"
              : "Nền 2D · Mọi hành động vẫn luôn sẵn sàng"}
          </p>
        </div>
      </div>
      <div className="palace-toolbar">
        <details>
          <summary>
            <Settings2 size={14} /> Cài đặt đồ họa
          </summary>
          <label>
            Nền cung viện
            <select
              aria-label="Chất lượng đồ họa"
              value={selected}
              onChange={(e) => select(e.target.value)}
            >
              <option value="auto">Tự động theo thiết bị</option>
              <option value="2d">Chế độ 2D</option>
              {Object.entries(QUALITY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  3D · {label}
                </option>
              ))}
            </select>
          </label>
          <small>
            Hiện tại:{" "}
            {mode === "2d"
              ? "2D"
              : `3D · ${QUALITY_LABELS[quality as Quality]}`}
            . Lựa chọn được lưu trên thiết bị này.
          </small>
        </details>
      </div>
      {(reason || caption) && (
        <p className="palace-caption" role="status">
          {caption || reason}
        </p>
      )}
    </section>
  );
}
export default memo(PalaceStage);
