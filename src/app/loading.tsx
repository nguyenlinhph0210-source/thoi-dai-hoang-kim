import { CourtFrame, CourtIcon, Ornament } from "@/ui/Court";
export default function Loading() {
  return (
    <main className="auth-shell site-shell" role="status">
      <CourtFrame className="court-loading">
        <CourtIcon symbol="lantern" />
        <Ornament />
        <p>Đang mở cổng kinh thành…</p>
        <progress aria-label="Đang tải" />
      </CourtFrame>
    </main>
  );
}
