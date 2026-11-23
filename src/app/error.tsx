"use client";
import { CourtIcon, Ornament } from "@/ui/Court";
export default function ErrorScreen({ reset }: { reset: () => void }) {
  return (
    <main className="auth-shell site-shell">
      <section className="auth-card">
        <CourtIcon symbol="seal" className="auth-seal" />
        <h1>Chưa thể vào triều</h1>
        <Ornament />
        <p>
          Chưa thể mở sổ trong viện. Hãy kiểm tra kết nối và thử lại sau ít
          phút.
        </p>
        <button className="primary-button" onClick={reset}>
          Thử lại
        </button>
        <a href="/login">Về đăng nhập</a>
      </section>
    </main>
  );
}
