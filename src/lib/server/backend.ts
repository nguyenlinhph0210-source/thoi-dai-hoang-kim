import "server-only";
import { createClient } from "@supabase/supabase-js";
import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { InMemoryGameRepository } from "@/lib/repositories/InMemoryGameRepository";
import { SupabaseGameRepository } from "@/lib/repositories/SupabaseGameRepository";
import type { GameRepository } from "@/lib/repositories/GameRepository";
interface Identity {
  id: string;
  salt: string;
  hash: Buffer;
}
interface LocalBackend {
  repository: InMemoryGameRepository;
  identities: Map<string, Identity>;
  sessions: Map<string, string>;
}
const globalBackend = globalThis as typeof globalThis & {
  __daiNoiLocal?: LocalBackend;
};
export function localBackend(): LocalBackend {
  return (globalBackend.__daiNoiLocal ??= {
    repository: new InMemoryGameRepository(),
    identities: new Map(),
    sessions: new Map(),
  });
}
export function repositoryMode(): "memory" | "supabase" {
  if (process.env.GAME_REPOSITORY === "memory") {
    if (
      process.env.NODE_ENV === "production" &&
      process.env.ALLOW_IN_MEMORY !== "true"
    )
      throw new Error("Chế độ local cần ALLOW_IN_MEMORY=true.");
    return "memory";
  }
  return process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY
    ? "supabase"
    : "memory";
}
export function authClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Thiếu cấu hình Supabase Auth.");
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
export function gameRepository(): GameRepository {
  if (repositoryMode() === "memory") return localBackend().repository;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    throw new Error("Thiếu cấu hình Supabase phía máy chủ.");
  return new SupabaseGameRepository(
    createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }),
  );
}
export function localRegister(email: string, password: string): string {
  const store = localBackend();
  if (store.identities.has(email)) throw new Error("Email đã được sử dụng.");
  const id = randomUUID(),
    salt = randomBytes(16).toString("hex");
  store.identities.set(email, {
    id,
    salt,
    hash: scryptSync(password, salt, 64),
  });
  store.repository.registerAccount(id);
  return localLogin(email, password);
}
export function localLogin(email: string, password: string): string {
  const store = localBackend();
  const user = store.identities.get(email);
  const hash = scryptSync(password, user?.salt ?? "unrecognized-user", 64);
  if (!user || !timingSafeEqual(hash, user.hash))
    throw new Error("Email hoặc mật khẩu không đúng.");
  const token = randomBytes(32).toString("hex");
  store.sessions.set(token, user.id);
  return token;
}
