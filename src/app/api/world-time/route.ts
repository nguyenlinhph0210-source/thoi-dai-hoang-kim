import { NextResponse } from "next/server";
import { currentUser } from "@/lib/server/auth";
import { gameRepository } from "@/lib/server/backend";
import { getWorldTime } from "@/lib/worldClock";
export const dynamic = "force-dynamic";
export async function GET() {
  const user = await currentUser();
  if (!user)
    return NextResponse.json({ error: "Bạn cần đăng nhập." }, { status: 401 });
  try {
    const state = await gameRepository().readState(user.id);
    const serverNow = state.serverNow,
      seasonStart = Date.parse(state.season.seasonStartTimestamp);
    return NextResponse.json(
      {
        serverNow,
        seasonStart,
        worldTime: getWorldTime(serverNow, seasonStart),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Chưa đọc được đồng hồ thế giới." },
      { status: 503 },
    );
  }
}
