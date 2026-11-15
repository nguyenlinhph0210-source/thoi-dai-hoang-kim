import { redirect } from "next/navigation";
import { requireUser } from "@/lib/server/auth";
import { gameRepository } from "@/lib/server/backend";
import { gameView, publicLog } from "@/lib/publicState";
import { LOG_PAGE_SIZE } from "@/config/balance";
import MainStage from "@/components/MainStage";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export default async function Home() {
  const user = await requireUser();
  const repo = gameRepository();
  const state = await repo.readState(user.id);
  if (!state.character || state.character.status === "DRAFT")
    redirect("/setup");
  const logs = await repo.logs(user.id, 0);
  return (
    <MainStage
      initialState={gameView(state)}
      initialJournal={{
        logs: logs.slice(0, LOG_PAGE_SIZE).map(publicLog),
        page: 0,
        hasMore: logs.length > LOG_PAGE_SIZE,
      }}
    />
  );
}
