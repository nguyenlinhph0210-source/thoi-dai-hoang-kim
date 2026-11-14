import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authClient, localBackend, repositoryMode } from "./backend";
export const ACCESS_COOKIE = "dnk_access";
export const REFRESH_COOKIE = "dnk_refresh";
export const LOCAL_COOKIE = "dnk_local_session";
export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure:
      process.env.COOKIE_SECURE === "true" ||
      (process.env.NODE_ENV === "production" &&
        process.env.COOKIE_SECURE !== "false"),
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}
export async function currentUser(): Promise<{ id: string } | null> {
  if (repositoryMode() === "memory") {
    const session = cookies().get(LOCAL_COOKIE)?.value;
    const id = session ? localBackend().sessions.get(session) : undefined;
    return id ? { id } : null;
  }
  const token = cookies().get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  const { data, error } = await authClient().auth.getUser(token);
  return error || !data.user ? null : { id: data.user.id };
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
