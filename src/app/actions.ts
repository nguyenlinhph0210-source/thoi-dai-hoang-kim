'use server';
import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { BRANCHES, type PublicSetupState } from '@/types/game';
import { GameRuleError, type SetupCommand } from '@/lib/characterGenerator';
import { isUuid, mutateSetup, SESSION_COOKIE } from '@/lib/server/setupStore';

export type SetupResult = { ok: true; state: PublicSetupState } | { ok: false; error: string };
export async function setupAction(command: SetupCommand, revision: number, requestId: string): Promise<SetupResult> {
  if (!command || !['BEGIN', 'REROLL', 'CONFIRM'].includes(command.type) || (command.type === 'BEGIN' && !BRANCHES.includes(command.branch))) return { ok: false, error: 'Nhánh phát triển không hợp lệ.' };
  const cookie = cookies().get(SESSION_COOKIE)?.value;
  const session = isUuid(cookie) ? cookie : randomUUID();
  try {
    const state = await mutateSetup(session, revision, requestId, command);
    cookies().set(SESSION_COOKIE, session, { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true', path: '/', maxAge: 60 * 60 * 24 * 365 });
    return { ok: true, state };
  } catch (error) {
    if (error instanceof GameRuleError) return { ok: false, error: error.message };
    console.error('Character setup failed', error instanceof Error ? error.message : 'Unknown error');
    return { ok: false, error: 'Không thể lưu thân phận. Vui lòng thử lại.' };
  }
}
