import { cookies } from 'next/headers';
import CharacterSetupScreen from '@/components/CharacterSetupScreen';
import { readSetup, SESSION_COOKIE } from '@/lib/server/setupStore';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export default async function Home() {
  const initialState = await readSetup(cookies().get(SESSION_COOKIE)?.value);
  return <CharacterSetupScreen initialState={initialState} />;
}
