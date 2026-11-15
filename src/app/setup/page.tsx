import { redirect } from "next/navigation";
import { requireUser } from "@/lib/server/auth";
import { gameRepository } from "@/lib/server/backend";
import { publicState } from "@/lib/publicState";
import CharacterSetupScreen from "@/components/CharacterSetupScreen";
export const dynamic = "force-dynamic";
export default async function Setup() {
  const user = await requireUser();
  const state = await gameRepository().readState(user.id);
  if (
    state.character &&
    ["ACTIVE", "SEVERELY_ILL"].includes(state.character.status)
  )
    redirect("/");
  return <CharacterSetupScreen initialState={publicState(state)} />;
}
