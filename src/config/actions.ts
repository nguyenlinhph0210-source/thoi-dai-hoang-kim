import type { Branch, CharacterStats } from "@/types/game";
import { ACTION_BALANCE } from "./balance";
export type ActionCode = keyof typeof ACTION_BALANCE;
export interface ActionDefinition {
  code: ActionCode;
  name: string;
  branchNames?: Partial<Record<Branch, string>>;
  description: string;
  type: "AUDIENCE" | "NORMAL";
  meritGain: number;
  apCost: number;
  silverCost: number;
  hpCost: number;
  gains: Partial<CharacterStats>;
  dailyCap: number;
}
export const ACTIONS: Record<ActionCode, ActionDefinition> = {
  APPLY: {
    code: "APPLY",
    name: "Nộp đơn",
    description: "Xin xét thăng phẩm.",
    type: "NORMAL",
    ...ACTION_BALANCE.APPLY,
  },
  WITHDRAW: {
    code: "WITHDRAW",
    name: "Rút đơn",
    description: "Rút đơn đang chờ, miễn phí.",
    type: "NORMAL",
    ...ACTION_BALANCE.WITHDRAW,
  },
  EXAM: {
    code: "EXAM",
    name: "Khảo hạch",
    description:
      "Khảo nghiệm năng lực cho phẩm mục tiêu. Thành công có hiệu lực 60 ngày game.",
    type: "NORMAL",
    ...ACTION_BALANCE.EXAM,
  },
  STUDY: {
    code: "STUDY",
    name: "Học kinh sử",
    branchNames: { INNER_COURT: "Học cung quy", HAREM: "Học cung quy" },
    description: "Mài giũa tài học, thấu hiểu phép tắc triều đình.",
    type: "NORMAL",
    ...ACTION_BALANCE.STUDY,
  },
  SOCIALIZE: {
    code: "SOCIALIZE",
    name: "Giao thiệp",
    description: "Kết giao bằng hữu, bồi đắp thanh danh.",
    type: "NORMAL",
    ...ACTION_BALANCE.SOCIALIZE,
  },
  AUDIENCE: {
    code: "AUDIENCE",
    name: "Diện kiến",
    branchNames: { INNER_COURT: "Thỉnh an", HAREM: "Thỉnh an" },
    description: "Giữ trọn lễ nghi, gây dựng lòng tín nhiệm.",
    type: "AUDIENCE",
    ...ACTION_BALANCE.AUDIENCE,
  },
  ETIQUETTE: {
    code: "ETIQUETTE",
    name: "Rèn nghi thái",
    description: "Chỉnh trang dung nghi, trau dồi phong thái.",
    type: "NORMAL",
    ...ACTION_BALANCE.ETIQUETTE,
  },
  WORK: {
    code: "WORK",
    name: "Làm việc",
    description: "Dốc sức phụng sự để nhận thêm ngân lượng.",
    type: "NORMAL",
    ...ACTION_BALANCE.WORK,
  },
  REST: {
    code: "REST",
    name: "Nghỉ ngơi",
    description: "Tĩnh dưỡng thân tâm, hồi phục thể lực.",
    type: "NORMAL",
    ...ACTION_BALANCE.REST,
  },
  RUMOR: {
    code: "RUMOR",
    name: "Dẹp tin đồn",
    description:
      "Chi bạc dẹp lời đàm tiếu; quyền thế thấp sẽ để lại tì vết lâu dài.",
    type: "NORMAL",
    ...ACTION_BALANCE.RUMOR,
  },
  TREAT: {
    code: "TREAT",
    name: "Điều trị",
    description: "Một lần chữa trị. Cần đủ năm lần để hết trọng bệnh.",
    type: "NORMAL",
    ...ACTION_BALANCE.TREAT,
  },
};
export function isActionCode(value: unknown): value is ActionCode {
  return typeof value === "string" && Object.hasOwn(ACTIONS, value);
}
