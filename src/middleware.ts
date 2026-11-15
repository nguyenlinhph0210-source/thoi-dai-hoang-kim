import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
/** Refresh rotates HttpOnly cookies before server components read the request. */
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || process.env.GAME_REPOSITORY === "memory")
    return NextResponse.next();
  const access = request.cookies.get("dnk_access")?.value,
    refresh = request.cookies.get("dnk_refresh")?.value;
  if (!refresh) return NextResponse.next();
  const client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  if (access) {
    const { error } = await client.auth.getUser(access);
    if (!error) return NextResponse.next();
  }
  const { data, error } = await client.auth.refreshSession({
    refresh_token: refresh,
  });
  if (error || !data.session) {
    const response = NextResponse.next();
    response.cookies.delete("dnk_access");
    response.cookies.delete("dnk_refresh");
    return response;
  }
  request.cookies.set("dnk_access", data.session.access_token);
  request.cookies.set("dnk_refresh", data.session.refresh_token);
  const response = NextResponse.next({ request: { headers: request.headers } });
  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure:
      process.env.COOKIE_SECURE === "true" ||
      (process.env.NODE_ENV === "production" &&
        process.env.COOKIE_SECURE !== "false"),
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
  response.cookies.set("dnk_access", data.session.access_token, options);
  response.cookies.set("dnk_refresh", data.session.refresh_token, options);
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
