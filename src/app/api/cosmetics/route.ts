import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/server/auth";
import { gameRepository } from "@/lib/server/backend";
import { parseCosmeticCommand } from "@/lib/cosmeticEngine";
import { isGameRuleError } from "@/lib/characterGenerator";
import { publicLog } from "@/lib/publicState";
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const parsed = new URL(origin);
      if (
        !["http:", "https:"].includes(parsed.protocol) ||
        parsed.host !== request.headers.get("host")
      )
        throw new Error("Origin");
    } catch {
      return NextResponse.json(
        { error: "Nguồn yêu cầu không hợp lệ.", retryable: false },
        { status: 403 },
      );
    }
  }
  const user = await currentUser();
  if (!user)
    return NextResponse.json(
      { error: "Bạn cần đăng nhập.", retryable: false },
      { status: 401 },
    );
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Yêu cầu không hợp lệ.", retryable: false },
      { status: 400 },
    );
  }
  if (
    !body ||
    typeof body !== "object" ||
    !("command" in body) ||
    !("key" in body) ||
    typeof body.key !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      body.key,
    ) ||
    !("revision" in body) ||
    typeof body.revision !== "number" ||
    !Number.isSafeInteger(body.revision) ||
    body.revision < 0
  )
    return NextResponse.json(
      { error: "Thao tác Hậu cung không hợp lệ.", retryable: false },
      { status: 400 },
    );
  const command = parseCosmeticCommand(body.command);
  if (!command)
    return NextResponse.json(
      { error: "Mã y phục hoặc cung viện không hợp lệ.", retryable: false },
      { status: 400 },
    );
  try {
    const result = await gameRepository().cosmeticAction(
      user.id,
      command,
      body.revision,
      body.key,
    );
    return NextResponse.json(
      { message: result.message, log: publicLog(result.log) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const known = isGameRuleError(error);
    return NextResponse.json(
      {
        error: known
          ? error.message
          : "Chưa rõ kết quả. Hãy thử lại cùng yêu cầu.",
        retryable: !known || /kết nối|đồng thời|cấu hình/.test(error.message),
      },
      { status: known ? 400 : 503 },
    );
  }
}
