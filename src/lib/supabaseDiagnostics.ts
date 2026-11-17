/** Database diagnostics can contain failing rows, bind values, JWTs or player IDs.
 * Never log the error object, request arguments, URLs, headers or arbitrary text.
 * Keep only reviewed constant diagnostics; unknown text is redacted by default.
 */
const SAFE_DIAGNOSTICS = new Set([
  "UPDATE requires a WHERE clause",
  "DELETE requires a WHERE clause",
  "STALE_REVISION",
  "RETRY_CLOCK",
  "Add a WHERE clause.",
  "Use UPDATE with a WHERE clause.",
  "Use DELETE with a WHERE clause.",
]);
function diagnostic(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "string" && SAFE_DIAGNOSTICS.has(value)
    ? value
    : "[redacted: database diagnostic may contain private data]";
}
export function logSupabaseError(target: string, error: unknown): void {
  const fields =
    typeof error === "object" && error !== null
      ? (error as Record<string, unknown>)
      : {};
  const code =
    typeof fields.code === "string" &&
    /^(?:[0-9A-Z]{5}|PGRST\d{3})$/.test(fields.code)
      ? fields.code
      : "UNKNOWN";
  console.error("[Supabase]", {
    target,
    code,
    message: diagnostic(fields.message),
    hint: diagnostic(fields.hint),
    details: diagnostic(fields.details),
  });
}
export const SEAT_ROUND_WARNING =
  "Phiên xét duyệt đang tạm gián đoạn. Hồ sơ vẫn được hiển thị; hãy đồng bộ lại sau.";
export const SEAT_BOARD_WARNING =
  "Chưa đọc được bảng ghế. Bạn vẫn có thể xem hồ sơ và nhật ký.";
