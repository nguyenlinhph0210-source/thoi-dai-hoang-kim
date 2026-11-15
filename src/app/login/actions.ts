"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  LOCAL_COOKIE,
  cookieOptions,
} from "@/lib/server/auth";
import {
  authClient,
  localBackend,
  localLogin,
  localRegister,
  repositoryMode,
} from "@/lib/server/backend";
export async function authenticate(
  form: FormData,
): Promise<{ error?: string; message?: string; success?: boolean }> {
  const email = String(form.get("email") ?? "")
      .trim()
      .toLowerCase(),
    password = String(form.get("password") ?? ""),
    mode = form.get("mode");
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    password.length < 8 ||
    password.length > 128 ||
    email.length > 254
  )
    return { error: "Nhập email hợp lệ và mật khẩu từ 8 đến 128 ký tự." };
  if (mode !== "signup" && mode !== "signin")
    return { error: "Yêu cầu không hợp lệ." };
  try {
    if (repositoryMode() === "memory") {
      const token =
        mode === "signup"
          ? localRegister(email, password)
          : localLogin(email, password);
      cookies().set(LOCAL_COOKIE, token, cookieOptions());
    } else {
      const client = authClient();
      const { data, error } =
        mode === "signup"
          ? await client.auth.signUp({ email, password })
          : await client.auth.signInWithPassword({ email, password });
      if (error)
        return {
          error:
            mode === "signup"
              ? "Không thể đăng ký. Kiểm tra email, mật khẩu hoặc thử lại sau."
              : "Email, mật khẩu không đúng hoặc email chưa xác nhận.",
        };
      if (!data.session)
        return {
          message: "Đã gửi yêu cầu đăng ký. Hãy xác nhận email rồi đăng nhập.",
        };
      cookies().set(ACCESS_COOKIE, data.session.access_token, cookieOptions());
      cookies().set(
        REFRESH_COOKIE,
        data.session.refresh_token,
        cookieOptions(),
      );
    }
  } catch {
    return {
      error:
        "Không thể đăng nhập hoặc đăng ký. Kiểm tra thông tin và cấu hình máy chủ.",
    };
  }
  return { success: true };
}
export async function logout() {
  if (repositoryMode() === "memory") {
    const token = cookies().get(LOCAL_COOKIE)?.value;
    if (token) localBackend().sessions.delete(token);
  } else {
    const access = cookies().get(ACCESS_COOKIE)?.value,
      refresh = cookies().get(REFRESH_COOKIE)?.value;
    if (access && refresh) {
      const client = authClient();
      await client.auth.setSession({
        access_token: access,
        refresh_token: refresh,
      });
      await client.auth.signOut({ scope: "local" });
    }
  }
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, LOCAL_COOKIE])
    cookies().delete(name);
  redirect("/login");
}
