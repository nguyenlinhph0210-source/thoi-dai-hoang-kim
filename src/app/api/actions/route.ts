import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/server/auth";
import { gameRepository } from "@/lib/server/backend";
import { isActionCode } from "@/config/actions";
import { isGameRuleError } from "@/lib/characterGenerator";
import { publicLog } from "@/lib/publicState";
export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Nguồn yêu cầu không hợp lệ.", retryable: false },
      { status: 403 },
    );
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
    typeof body !== "object" ||
    !body ||
    !("code" in body) ||
    !isActionCode(body.code) ||
    !("key" in body) ||
    typeof body.key !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      body.key,
    )
  )
    return NextResponse.json(
      { error: "Hành động hoặc mã yêu cầu không hợp lệ.", retryable: false },
      { status: 400 },
    );
  try {
    const result = await gameRepository().act(user.id, body.code, body.key);
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
          : "Chưa rõ kết quả. Thử lại bằng cùng mã yêu cầu.",
        retryable: !known || /kết nối|đồng thời|cấu hình/.test(error.message),
      },
      { status: known ? 400 : 503 },
    );
  }
}

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      url.host === request.headers.get("host")
    );
  } catch {
    return false;
  }
}
