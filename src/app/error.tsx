"use client";
export default function ErrorScreen({ reset }: { reset: () => void }) {
  return (
    <main className="auth-shell site-shell">
      <section className="auth-card">
        <h1>Chưa thể vào triều</h1>
        <p>
          Không thể đọc dữ liệu. Hãy kiểm tra kết nối, biến môi trường và thứ tự
          migration trong README.
        </p>
        <button className="primary-button" onClick={reset}>
          Thử lại
        </button>
        <a href="/login">Về đăng nhập</a>
      </section>
    </main>
  );
}
