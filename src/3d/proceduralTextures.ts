"use client";
import { useEffect, useMemo } from "react";
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";
import type { Quality } from "./quality";
type Entry = { texture: CanvasTexture; references: number };
const cache = new Map<string, Entry>();
export function proceduralTextureKey(
  kind: "wood" | "silk",
  code: string,
  quality: Quality,
  color: string,
  accent: string,
  pattern: string,
) {
  return [
    kind,
    code,
    quality === "low" ? 128 : 256,
    color,
    accent,
    pattern,
  ].join(":");
}
function create(
  kind: "wood" | "silk",
  size: number,
  code: string,
  color: string,
  accent: string,
  pattern: string,
) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("PROCEDURAL_TEXTURE_UNAVAILABLE");
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  let seed = [...code].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 19);
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  if (kind === "wood") {
    ctx.lineWidth = 0.6;
    for (let i = 0; i < 75; i++) {
      const y = random() * size;
      ctx.strokeStyle = i % 2 ? "#dfbb7d22" : "#24190e22";
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(
        size * 0.3,
        y + random() * 8,
        size * 0.7,
        y - random() * 8,
        size,
        y,
      );
      ctx.stroke();
    }
    ctx.strokeStyle = "#29180e33";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, size, size);
  } else {
    ctx.strokeStyle = accent;
    ctx.lineWidth = size / 220;
    ctx.globalAlpha = 0.55;
    const step = size / 4;
    for (let x = 0; x < size; x += step)
      for (let y = 0; y < size; y += step) {
        ctx.beginPath();
        const cx = x + step / 2,
          cy = y + step / 2;
        if (pattern === "DIAMOND") {
          ctx.moveTo(cx, cy - step * 0.25);
          ctx.lineTo(cx + step * 0.2, cy);
          ctx.lineTo(cx, cy + step * 0.25);
          ctx.lineTo(cx - step * 0.2, cy);
          ctx.closePath();
        } else if (pattern === "WAVES") {
          ctx.moveTo(x, cy);
          ctx.bezierCurveTo(
            x + step * 0.3,
            cy - step * 0.3,
            x + step * 0.6,
            cy + step * 0.3,
            x + step,
            cy,
          );
        } else {
          ctx.arc(cx, cy, step * 0.15, 0, Math.PI * 1.5);
          ctx.moveTo(cx, cy + step * 0.14);
          ctx.lineTo(cx, cy + step * 0.28);
        }
        ctx.stroke();
      }
    ctx.globalAlpha = 0.06;
    ctx.strokeStyle = "#fff2cc";
    ctx.lineWidth = 0.5;
    for (let y = 0; y < size; y += 3) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.anisotropy = 1;
  texture.name = `procedural:${kind}:${code}:${size}`;
  if (kind === "wood") texture.repeat.set(6, 6);
  return texture;
}
function prune() {
  for (const [key, row] of cache) {
    if (cache.size <= 48) break;
    if (row.references === 0) {
      row.texture.dispose();
      cache.delete(key);
    }
  }
}
/** Cached by code/resolution/palette; no generation inside useFrame. */
export function useProceduralTexture(
  kind: "wood" | "silk",
  code: string,
  quality: Quality,
  color: string,
  accent = "#d2b174",
  pattern = "BORDER",
) {
  const key = proceduralTextureKey(kind, code, quality, color, accent, pattern);
  const entry = useMemo(() => {
    let row = cache.get(key);
    if (!row) {
      row = {
        texture: create(
          kind,
          quality === "low" ? 128 : 256,
          code,
          color,
          accent,
          pattern,
        ),
        references: 0,
      };
      cache.set(key, row);
    }
    return row;
  }, [key, kind, code, quality, color, accent, pattern]);
  useEffect(() => {
    entry.references++;
    prune();
    return () => {
      entry.references--;
      prune();
    };
  }, [entry]);
  return entry.texture;
}
export function disposeUnusedProceduralTextures() {
  for (const [key, row] of cache)
    if (row.references === 0) {
      row.texture.dispose();
      cache.delete(key);
    }
}
