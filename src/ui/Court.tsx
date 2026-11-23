import type { HTMLAttributes, ReactNode } from "react";

export type CourtSymbol = "lantern" | "fan" | "seal" | "hairpin" | "jade";
const paths: Record<CourtSymbol, ReactNode> = {
  lantern: (
    <>
      <path d="M12 2v4M8 5h8M7 7h10l2 5-2 6H7l-2-6zM8 19h8M12 19v4M9 8v8m6-8v8" />
      <path d="M7 12h10" />
    </>
  ),
  fan: (
    <>
      <path d="M3 13a10 10 0 0 1 18 0l-9 9zM12 22V5M12 22 6 8m6 14 6-14M3 13l9 4 9-4" />
    </>
  ),
  seal: (
    <>
      <path d="M4 10h16v11H4zM8 10V7a4 4 0 0 1 8 0v3M7 14h10M9 14v4h6v-4" />
      <path d="M2 23h20" />
    </>
  ),
  hairpin: (
    <>
      <path d="m4 22 11-13M8 22l9-12M14 7c-6-1-3-7 0-4 0-5 6-4 5 0 5-1 6 5 1 5-1 5-6 4-6-1z" />
      <circle cx="17" cy="5" r="1" />
    </>
  ),
  jade: (
    <>
      <path d="M12 1v5m-5 2 5-3 5 3 2 6-7 7-7-7zM12 21v3M9 11l3-2 3 2v4l-3 3-3-3z" />
    </>
  ),
};
export function CourtIcon({
  symbol,
  className = "",
}: {
  symbol: CourtSymbol;
  className?: string;
}) {
  return (
    <svg
      className={`court-icon ${className}`}
      viewBox="0 0 24 26"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[symbol]}
    </svg>
  );
}
export function Ornament({ className = "" }: { className?: string }) {
  return (
    <div className={`court-ornament ${className}`} aria-hidden="true">
      <span />
      <svg viewBox="0 0 90 20" fill="none" stroke="currentColor">
        <path d="M1 10h18c10 0 6-10 13-6l13 12L58 4c7-4 3 6 13 6h18M27 10l7 6L45 5l11 11 7-6" />
        <path d="m40 10 5-5 5 5-5 5z" />
      </svg>
      <span />
    </div>
  );
}
export function CourtFrame({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return (
    <section {...props} className={`court-frame ${className}`}>
      {children}
    </section>
  );
}
