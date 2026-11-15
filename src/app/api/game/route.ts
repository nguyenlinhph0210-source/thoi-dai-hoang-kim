import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/server/auth";
import { gameRepository } from "@/lib/server/backend";
import { gameView, publicLog } from "@/lib/publicState";
import { LOG_PAGE_SIZE } from "@/config/balance";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const user = await currentUser();
  if (!user)
    return NextResponse.json({ error: "Bạn cần đăng nhập." }, { status: 401 });
  const page = Number(request.nextUrl.searchParams.get("page") ?? 0);
  if (!Number.isSafeInteger(page) || page < 0 || page > 100000)
    return NextResponse.json(
      { error: "Trang nhật ký không hợp lệ." },
      { status: 400 },
    );
  try {
    const repo = gameRepository();
    const state = await repo.readState(user.id);
    const logs = await repo.logs(user.id, page);
    return NextResponse.json(
      {
        state: gameView(state),
        journal: {
          logs: logs.slice(0, LOG_PAGE_SIZE).map(publicLog),
          hasMore: logs.length > LOG_PAGE_SIZE,
          page,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Không thể đọc dữ liệu triều đình." },
      { status: 503 },
    );
  }
}
