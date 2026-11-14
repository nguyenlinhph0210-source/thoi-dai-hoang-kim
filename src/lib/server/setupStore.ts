import 'server-only';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createAccount, GameRuleError, transitionSetup, type SetupCommand } from '@/lib/characterGenerator';
import { DEMO_SEASON_ID } from '@/lib/gameConfig';
import type { PublicSetupState, SetupState } from '@/types/game';

// M1 local demonstration only. For multiple application instances use the SQL RPC.
const directory = process.env.GAME_DATA_DIR ?? join(process.cwd(), '.data', 'setup');
export const SESSION_COOKIE = 'dai-noi-ky-session';
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
export function publicState(state: SetupState): PublicSetupState {
  if (!state.character) return { account: state.account, character: null, revision: state.revision };
  const { suspicion: hiddenSuspicion, suspicionFloor: hiddenFloor, ...character } = state.character;
  void hiddenSuspicion;
  void hiddenFloor;
  return { account: state.account, character, revision: state.revision };
}
export async function readSetup(session: string | undefined): Promise<PublicSetupState | null> {
  if (!isUuid(session)) return null;
  try { return publicState(JSON.parse(await readFile(join(directory, `${session}.json`), 'utf8')) as SetupState); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}

export async function mutateSetup(session: string, expectedRevision: number, requestId: string, command: SetupCommand): Promise<PublicSetupState> {
  if (!isUuid(session) || !isUuid(requestId) || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new GameRuleError('Yêu cầu không hợp lệ.');
  await mkdir(directory, { recursive: true });
  const lock = join(directory, `${session}.lock`);
  const deadline = Date.now() + 5000;
  while (true) {
    try { await mkdir(lock); break; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      if (Date.now() > deadline) throw new GameRuleError('Yêu cầu trước đang xử lý. Vui lòng thử lại.');
      await new Promise(resolve => setTimeout(resolve, 25));
    }
  }
  const file = join(directory, `${session}.json`);
  try {
    let state: SetupState;
    try { state = JSON.parse(await readFile(file, 'utf8')) as SetupState; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      state = { account: createAccount(session), character: null, revision: 0, processedRequests: [] };
    }
    if (state.processedRequests.includes(requestId)) return publicState(state);
    if (state.revision !== expectedRevision) throw new GameRuleError('Dữ liệu đã thay đổi ở cửa sổ khác. Hãy tải lại trang.');
    const now = new Date().toISOString();
    const next = transitionSetup(state, command, { id: randomUUID(), accountId: session, seasonId: DEMO_SEASON_ID, now, gameYear: 1, random: () => randomBytes(4).readUInt32BE() / 0x100000000 });
    next.revision = state.revision + 1;
    next.processedRequests = [...state.processedRequests.slice(-127), requestId];
    const temporary = `${file}.${randomUUID()}.tmp`;
    try { await writeFile(temporary, JSON.stringify(next), { mode: 0o600 }); await rename(temporary, file); }
    finally { await rm(temporary, { force: true }); }
    return publicState(next);
  } finally { await rm(lock, { recursive: true, force: true }); }
}
