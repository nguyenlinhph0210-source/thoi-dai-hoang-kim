"use server";
import { BRANCHES, type PublicSetupState } from "@/types/game";
import { isGameRuleError, type SetupCommand } from "@/lib/characterGenerator";
import { requireUser } from "@/lib/server/auth";
import { gameRepository } from "@/lib/server/backend";
import { publicState } from "@/lib/publicState";
export type SetupResult =
  | { ok: true; state: PublicSetupState }
  | { ok: false; error: string };
export async function setupAction(
  command: SetupCommand,
  revision: number,
  requestId: string,
): Promise<SetupResult> {
  const user = await requireUser();
  if (
    !command ||
    !["BEGIN", "REROLL", "CONFIRM"].includes(command.type) ||
    (command.type === "BEGIN" && !BRANCHES.includes(command.branch)) ||
    !Number.isSafeInteger(revision) ||
    revision < 0 ||
    !isUuid(requestId)
  )
    return { ok: false, error: "Yêu cầu không hợp lệ." };
  try {
    return {
      ok: true,
      state: publicState(
        await gameRepository().setup(user.id, command, revision, requestId),
      ),
    };
  } catch (error) {
    return {
      ok: false,
      error: isGameRuleError(error)
        ? error.message
        : "Không thể lưu thân phận. Vui lòng thử lại.",
    };
  }
}
function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
