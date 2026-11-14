"use client";
import { useState } from "react";
import { Landmark, Loader2 } from "lucide-react";
import { authenticate } from "@/app/login/actions";
export default function AuthScreen({ local }: { local: boolean }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [result, setResult] = useState<{ error?: string; message?: string }>(
    {},
  );
  const [pending, setPending] = useState(false);
  return (
    <main className="site-shell auth-shell">
      <section className="auth-card">
        <Landmark size={40} />
        <span className="eyebrow">HOÀNG TRIỀU ĐẠI KHÁNH</span>
        <h1>ĐẠI NỘI KÝ</h1>
        <p>Một kiếp người · Vạn lối đi</p>
        <h2>{mode === "signin" ? "Đăng nhập" : "Đăng ký tài khoản"}</h2>
        {local && (
          <p className="local-note">
            Chế độ local: mỗi người có tài khoản riêng. Dữ liệu chỉ giữ trong bộ
            nhớ của máy chủ hiện tại.
          </p>
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            form.set("mode", mode);
            setPending(true);
            void (async () => {
              try {
                const data = await authenticate(form);
                if (data?.success) {
                  window.location.assign("/");
                  return;
                }
                if (data) setResult(data);
              } catch {
                setResult({ error: "Không thể kết nối. Vui lòng thử lại." });
              } finally {
                setPending(false);
              }
            })();
          }}
        >
          <label>
            Email
            <input
              required
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
            />
          </label>
          <label>
            Mật khẩu
            <input
              required
              name="password"
              type="password"
              minLength={8}
              maxLength={128}
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
            />
          </label>
          <button className="primary-button" disabled={pending}>
            {pending && <Loader2 size={16} className="spin" />}
            {mode === "signin" ? "Đăng nhập" : "Tạo tài khoản"}
          </button>
        </form>
        {result.error && (
          <p className="error-message" role="alert">
            {result.error}
          </p>
        )}
        {result.message && <p role="status">{result.message}</p>}
        <button
          type="button"
          className="auth-switch"
          disabled={pending}
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setResult({});
          }}
        >
          {mode === "signin"
            ? "Chưa có tài khoản? Đăng ký"
            : "Đã có tài khoản? Đăng nhập"}
        </button>
      </section>
    </main>
  );
}
