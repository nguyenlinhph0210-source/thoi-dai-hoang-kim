"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

export const SHEET_LEVELS = ["collapsed", "half", "full"] as const;
export type SheetLevel = (typeof SHEET_LEVELS)[number];
export function sheetLevelAfterDrag(level: SheetLevel, dy: number): SheetLevel {
  const index = SHEET_LEVELS.indexOf(level);
  return Math.abs(dy) < 35
    ? level
    : SHEET_LEVELS[Math.max(0, Math.min(2, index + (dy < 0 ? 1 : -1)))];
}
/** Drag is confined to the handle; scrolling contents never steals the camera gesture. */
export default function ScrollSheet({
  children,
  activeKey,
  previewCode,
}: {
  children: ReactNode;
  activeKey: string;
  previewCode?: string;
}) {
  const [level, setLevel] = useState<SheetLevel>("collapsed");
  const start = useRef<number | null>(null);
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setLevel(activeKey === "stage" ? "collapsed" : "half");
    content.current?.scrollTo({ top: 0 });
  }, [activeKey]);
  useEffect(() => {
    if (previewCode) {
      setLevel("collapsed");
      content.current?.scrollTo({ top: 0 });
    }
  }, [previewCode]);
  return (
    <div className="scroll-sheet" data-level={level} data-testid="scroll-sheet">
      <div
        className="sheet-grip"
        onPointerDown={(e) => {
          // Buttons keep their own pointer/click target; capture only an actual drag on the handle.
          if (e.target instanceof Element && e.target.closest("button")) return;
          e.preventDefault(); // Native text dragging must not cancel an upward gesture.
          start.current = e.clientY;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerUp={(e) => {
          const origin = start.current;
          if (origin !== null) {
            const delta = e.clientY - origin;
            setLevel((v) => sheetLevelAfterDrag(v, delta));
          }
          start.current = null;
        }}
        onPointerCancel={() => {
          start.current = null;
        }}
      >
        <span aria-hidden="true" className="sheet-grip-line" />
        <span className="sheet-label">Cuộn thư trong viện</span>
        <div className="sheet-levels" aria-label="Độ mở cuộn thư">
          {SHEET_LEVELS.map((v, i) => (
            <button
              key={v}
              aria-pressed={level === v}
              onClick={() => setLevel(v)}
            >
              {["Thu gọn", "Mở nửa", "Mở đầy"][i]}
            </button>
          ))}
        </div>
      </div>
      <div className="sheet-content" ref={content}>
        {children}
      </div>
    </div>
  );
}
