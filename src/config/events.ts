import type { CharacterStats, Branch } from "@/types/game";
import type {
  EventDefinition,
  EventOutcome,
  PersonalEventChoice,
  PersonalEventKind,
  EventStage,
  EventRequirements,
} from "@/types/events";
import { EVENT_BALANCE as B } from "./balance";
import { ConfigurationError } from "@/lib/errors";
import { BRANCHES } from "@/types/game";
import { RANKS, STAT_BOUNDS } from "@/lib/gameConfig";
const all: Branch[] = [...BRANCHES];
function outcome(
  code: string,
  text: string,
  effects: Partial<CharacterStats> = {},
  terminal: EventOutcome["terminal"] = "SUCCESS",
  flags: EventOutcome["flags"] = [],
): EventOutcome {
  return { code, text, effects, terminal, flags };
}
function fixed(
  code: string,
  label: string,
  o: EventOutcome,
  apCost: number = B.choiceAp,
  silverCost: number = 0,
): PersonalEventChoice {
  return {
    code,
    label,
    apCost,
    silverCost,
    result: { kind: "FIXED", outcome: o },
  };
}
function contest(
  code: string,
  label: string,
  success: EventOutcome,
  failure: EventOutcome,
): PersonalEventChoice {
  return {
    code,
    label,
    apCost: B.choiceAp,
    silverCost: 0,
    result: { kind: "CHANCE", formula: B.probability, success, failure },
  };
}
function sample(
  code: string,
  group: PersonalEventKind,
  title: string,
  body: string,
  choices: PersonalEventChoice[],
  extra: Partial<EventDefinition> = {},
): EventDefinition {
  return {
    code,
    group,
    title,
    body,
    trigger: "WEEKLY",
    branches: all,
    requirements: { statuses: ["ACTIVE"] },
    weight: 1,
    cooldownGameDays: B.defaultCooldownDays,
    expiresHours: B.expiresHours[group],
    mandatory: false,
    tags: [],
    status: "SAMPLE_DRAFT",
    fictional: true,
    stages: [
      {
        code: "FIRST",
        title,
        body,
        choices,
        defaultOutcome: outcome(
          "MISSED",
          "Cơ hội trôi qua giữa những công việc thường nhật.",
          {},
          "FAILURE",
        ),
      },
    ],
    ...extra,
  };
}
const normal: [string, string, string, Partial<CharacterStats>][] = [
  [
    "OLD_BOOK",
    "Trang sách cũ",
    "Trong kho, bạn tìm thấy một bản chép kinh sử còn nhiều chỗ chú giải.",
    { int: B.rewardSmall },
  ],
  [
    "COURT_MANNERS",
    "Lễ nghi trước sân",
    "Một người giữ lễ chỉ cho bạn cách bước qua sân chầu.",
    { cha: B.rewardSmall },
  ],
  [
    "QUIET_FRIEND",
    "Chén trà cuối buổi",
    "Một đồng liêu chưa quen mời bạn ngồi lại bên chén trà.",
    { rep: B.rewardSmall },
  ],
  [
    "SMALL_ERRAND",
    "Việc nhỏ đúng lúc",
    "Một người phụ trách cần người chuyển tập sổ trước giờ đóng cửa.",
    { fav: B.rewardSmall },
  ],
  [
    "REST_GARDEN",
    "Gió mát bên hiên",
    "Giữa hai phiên trực, một khoảng hiên vắng đủ để nghỉ chân.",
    { hp: B.rewardLarge },
  ],
  [
    "COPY_REGISTER",
    "Chép lại sổ cũ",
    "Kho thư cần người chép lại những trang sổ đã mờ nét.",
    { characterSilver: B.silverReward },
  ],
  [
    "LOST_TOKEN",
    "Tấm thẻ đánh rơi",
    "Bạn nhặt được một tấm thẻ công vụ trong lối đi.",
    { rep: B.rewardSmall, int: B.rewardSmall },
  ],
  [
    "LANTERN_DUTY",
    "Đèn còn sáng",
    "Một gian phòng cuối hành lang vẫn chưa tắt đèn, giấy tờ còn ngổn ngang.",
    { fav: B.rewardSmall, cha: B.rewardSmall },
  ],
];
const events: EventDefinition[] = normal.map(([code, title, body, gain]) =>
  sample(code, "NORMAL", title, body, [
    fixed(
      "HELP",
      "Dành thời gian giúp đỡ",
      outcome(
        "HELPED",
        "Việc nhỏ được hoàn tất, để lại một ấn tượng tốt.",
        gain,
      ),
    ),
    fixed(
      "PASS",
      "Giữ việc đang làm",
      outcome("PASSED", "Bạn trở lại công việc của mình."),
      0,
    ),
  ]),
);
events.push(
  sample(
    "SEALED_ARCHIVE",
    "RARE",
    "Cánh cửa thư khố",
    "Một viên giữ kho cho phép bạn xem một tập văn thư hiếm.",
    [
      contest(
        "READ",
        "Tìm hiểu văn thư",
        outcome(
          "LEARNED",
          "Bạn hiểu thêm một điều về cách vận hành triều chính.",
          { int: B.rewardLarge },
        ),
        outcome(
          "CONFUSED",
          "Những dòng chữ khó hiểu khiến bạn mệt mỏi.",
          { hp: -B.hpLoss },
          "FAILURE",
        ),
      ),
    ],
    {
      requirements: {
        statuses: ["ACTIVE"],
        tiers: [2, 3, 4, 5],
        minimums: { int: 100 },
      },
    },
  ),
  sample(
    "CEREMONIAL_ROBE",
    "RARE",
    "Tà áo ngày lễ",
    "Một người phụ trách lễ nghi nhờ bạn giúp chuẩn bị phục sức.",
    [
      fixed(
        "PREPARE",
        "Chuẩn bị chu đáo",
        outcome("GRACE", "Dung nghi của bạn trở nên chững chạc hơn.", {
          cha: B.rewardLarge,
        }),
        B.choiceAp,
        B.silverCost,
      ),
    ],
  ),
  sample(
    "UNEXPECTED_PRAISE",
    "RARE",
    "Lời khen bất chợt",
    "Người chủ trì phiên chầu hỏi đến một việc bạn từng hoàn thành.",
    [
      fixed("BOW", "Giữ lễ đáp lời", {
        ...outcome("PRAISE", "Lời đáp vừa mực được ghi nhận.", {
          fav: B.rewardLarge,
        }),
        type: "AUDIENCE",
      }),
    ],
  ),
  sample(
    "HAREM_INVITATION",
    "RARE",
    "Lời triệu kiến sau rèm",
    "Một nữ quan mang đến lời hỏi ý về việc nhận sắc phong vào Hậu cung.",
    [
      fixed(
        "ACCEPT",
        "Chấp nhận sắc phong",
        outcome(
          "CONVERTED",
          "Bạn nhận sắc phong, bước vào một chặng đời mới.",
          {},
          "SUCCESS",
          ["CONVERT_HAREM"],
        ),
        0,
      ),
      fixed(
        "DECLINE",
        "Xin tiếp tục phụng sự Nội cung",
        outcome(
          "DECLINED",
          "Lời từ chối được tiếp nhận; bạn giữ nguyên con đường đang đi.",
        ),
        0,
      ),
    ],
    {
      branches: ["INNER_COURT"],
      tags: ["HAREM_AUDIENCE"],
      cooldownGameDays: B.haremRefusalCooldownDays,
      requirements: {
        statuses: ["ACTIVE"],
        rankIds: ["inner_2", "inner_3", "inner_4", "inner_5", "inner_6"],
        minimums: { cha: 150, int: 100 },
        maximums: { suspicion: 45 },
      },
    },
  ),
  sample(
    "BITTER_MEDICINE",
    "DANGEROUS",
    "Vị đắng trong chén",
    "Một chén nước được đặt trước cửa; mùi vị khiến bạn phải dè chừng.",
    [
      contest(
        "EXAMINE",
        "Cẩn thận kiểm tra",
        outcome("AVOIDED", "Bạn nhận ra điều bất thường trước khi quá muộn.", {
          int: B.rewardSmall,
        }),
        outcome(
          "WEAKENED",
          "Sự bất cẩn khiến bạn mất sức.",
          { hp: -B.hpLoss, fav: -B.rewardSmall },
          "FAILURE",
        ),
      ),
      fixed(
        "REFUSE",
        "Không dùng chén nước",
        outcome("REFUSED", "Bạn nhờ người dọn đi và trở lại công việc."),
        0,
      ),
    ],
    { tags: ["HARM"] },
  ),
  sample(
    "NARROW_PASSAGE",
    "DANGEROUS",
    "Lối đi khuất",
    "Một vật nặng bất ngờ rơi xuống gần lối đi của bạn.",
    [
      contest(
        "WATCH",
        "Giữ bình tĩnh quan sát",
        outcome("SAFE", "Bạn tránh được chỗ nguy hiểm.", {
          cha: B.rewardSmall,
        }),
        outcome(
          "HURT",
          "Bạn bị thương nhẹ khi tránh né.",
          { hp: -B.hpLoss },
          "FAILURE",
        ),
      ),
    ],
    { tags: ["HARM"] },
  ),
  sample(
    "WHISPERED_REPORT",
    "DANGEROUS",
    "Lời đồn bên cửa",
    "Một lời truyền miệng bất lợi về bạn đang lan qua các phiên trực.",
    [
      contest(
        "EXPLAIN",
        "Giải thích bằng chứng cứ",
        outcome("CLEAR", "Những lời đồn dần lắng xuống.", {
          rep: B.rewardSmall,
          suspicion: -B.suspicionGain,
        }),
        outcome(
          "DOUBTED",
          "Lời giải thích chưa đủ sức thuyết phục.",
          { rep: -B.rewardSmall, suspicion: B.suspicionGain },
          "FAILURE",
        ),
      ),
    ],
    { tags: ["SLANDER"] },
  ),
  sample(
    "FALSE_RECEIPT",
    "DANGEROUS",
    "Tờ biên nhận lạ",
    "Một tờ biên nhận ghi công việc bạn chưa từng nhận làm.",
    [
      contest(
        "VERIFY",
        "Đối chiếu sổ sách",
        outcome("VERIFIED", "Sự nhầm lẫn được làm rõ.", { int: B.rewardSmall }),
        outcome(
          "IMPLICATED",
          "Bạn phải gánh phần trách nhiệm còn chưa rõ.",
          { characterSilver: -B.silverCost, suspicion: B.suspicionGain },
          "FAILURE",
        ),
      ),
    ],
    { tags: ["SLANDER"] },
  ),
);
function inspection(
  code: string,
  title: string,
  branches: Branch[],
): EventDefinition {
  const failure = outcome(
    "PENALTY",
    "Bạn nhận trách phạt và một lời răn, rồi được trở về công việc.",
    {
      fav: -B.rewardSmall,
      characterSilver: -B.silverCost,
      suspicion: -B.investigationSuspicionRelief,
    },
    "FAILURE",
  );
  const def = sample(
    code,
    "DANGEROUS",
    title,
    "Bạn được yêu cầu giải trình những điều còn gây nghi ngại. Một viên giữ sổ chờ nghe lời giải thích bên những tờ ghi nhận lời đồn trong các phiên trực.",
    [
      contest(
        "DEFEND",
        "Tự biện bạch",
        outcome(
          "ACQUITTED",
          "Lời giải trình đã làm sáng tỏ phần lớn nghi ngại.",
          { rep: B.rewardSmall, suspicion: -B.investigationSuspicionRelief },
        ),
        failure,
      ),
      fixed(
        "SETTLE",
        "Chi bạc dàn xếp",
        outcome(
          "SETTLED",
          "Lời đàm tiếu lắng bớt, nhưng dấu vết của việc dàn xếp có thể còn lại.",
          { suspicion: -B.rumorSuspicionRelief },
          "SUCCESS",
          ["RUMOR_SETTLEMENT"],
        ),
        B.choiceAp,
        B.silverCost,
      ),
      fixed("ACCEPT_PENALTY", "Nhận phạt", failure, 0),
    ],
    {
      trigger: "INVESTIGATION",
      branches,
      requirements: { statuses: ["ACTIVE", "SEVERELY_ILL"] },
      mandatory: true,
      tags: ["INVESTIGATION"],
      cooldownGameDays: B.investigationCooldownDays,
    },
  );
  def.stages[0].defaultOutcome = failure;
  return def;
}
events.push(
  inspection("CENSOR_INQUIRY", "Lệnh tra xét của Đô sát viện", [
    "CIVIL",
    "MILITARY",
  ]),
  inspection("PALACE_INQUIRY", "Giấy gọi của Cung chính ty", [
    "INNER_COURT",
    "HAREM",
  ]),
);
function calamity(code: string, title: string, body: string): EventDefinition {
  const fail = outcome(
    "CALAMITY_FAILED",
    "Bạn giữ được tính mạng nhưng lâm trọng bệnh, hao hụt phân nửa ngân lượng và mất lòng tín nhiệm.",
    {},
    "FAILURE",
    ["SEVERELY_ILL"],
  );
  const second: EventStage = {
    code: "LAST",
    title: "Qua cửa cuối",
    body: "Khó khăn chưa qua hẳn. Bạn phải giữ vững tinh thần để hoàn tất việc còn lại.",
    choices: [
      contest(
        "ENDURE",
        "Dốc sức vượt qua",
        outcome("SURVIVED", "Bạn đã vượt trọn vẹn kiếp nạn."),
        fail,
      ),
    ],
    defaultOutcome: fail,
  };
  const next = {
    ...outcome(
      "CONTINUE",
      "Bạn vượt được chặng đầu, nhưng thử thách vẫn còn.",
      {},
      "NEXT",
    ),
    nextStage: "LAST",
  };
  const def = sample(
    code,
    "GREAT_CALAMITY",
    title,
    body,
    [contest("FACE", "Đối diện thử thách", next, fail)],
    {
      mandatory: true,
      calamityCode: code,
      destinyReward: 1,
      cooldownGameDays: B.calamityCooldownDays,
    },
  );
  def.stages[0].defaultOutcome = fail;
  def.stages.push(second);
  return def;
}
events.push(
  calamity(
    "FIRE_IN_STORE",
    "Lửa lớn trong kho",
    "Một gian kho bốc cháy. Bạn bị kẹt giữa khói và những lối đi bị chặn.",
  ),
  calamity(
    "NIGHT_OF_SICKNESS",
    "Đêm bệnh dữ",
    "Cơn bệnh bất ngờ ập đến đúng lúc phiên trực không thể bỏ dở.",
  ),
);
export function validateEventCatalog(
  catalog: readonly EventDefinition[],
): void {
  const validateRequirements = (requirements: EventRequirements) => {
    if (
      requirements.rankIds?.some((id) => !Object.hasOwn(RANKS, id)) ||
      requirements.tiers?.some((tier) => ![1, 2, 3, 4, 5].includes(tier)) ||
      requirements.statuses?.some(
        (status) =>
          !["DRAFT", "ACTIVE", "SEVERELY_ILL", "DECEASED", "ARCHIVED"].includes(
            status,
          ),
      ) ||
      [requirements.minimums, requirements.maximums].some((bounds) =>
        Object.entries(bounds ?? {}).some(
          ([stat, value]) =>
            !Object.hasOwn(STAT_BOUNDS, stat) || !Number.isSafeInteger(value),
        ),
      )
    )
      throw new ConfigurationError(
        "Tham chiếu điều kiện sự kiện không hợp lệ.",
      );
  };
  if (
    !Number.isInteger(B.pendingCap) ||
    B.pendingCap < 1 ||
    Object.values(B.groupWeights).some((w) => !Number.isInteger(w) || w < 0) ||
    Object.values(B.groupWeights).reduce((n, w) => n + w, 0) <= 0
  )
    throw new ConfigurationError("Cân bằng sự kiện không hợp lệ.");
  const codes = new Set<string>();
  for (const event of catalog) {
    if (
      codes.has(event.code) ||
      !event.code ||
      !event.fictional ||
      !["SAMPLE_DRAFT", "OFFICIAL"].includes(event.status) ||
      !["NORMAL", "RARE", "DANGEROUS", "GREAT_CALAMITY"].includes(
        event.group,
      ) ||
      !event.branches.length ||
      event.branches.some((b) => !BRANCHES.includes(b)) ||
      !(event.weight > 0) ||
      !Number.isFinite(event.weight) ||
      event.expiresHours <= 0 ||
      event.cooldownGameDays < 0 ||
      !event.stages.length ||
      (event.group !== "GREAT_CALAMITY" && event.destinyReward !== undefined)
    )
      throw new ConfigurationError("Kho sự kiện không hợp lệ.");
    codes.add(event.code);
    validateRequirements(event.requirements);
    const stages = new Set(event.stages.map((s) => s.code));
    if (stages.size !== event.stages.length)
      throw new ConfigurationError("Trùng giai đoạn sự kiện.");
    if (
      event.group === "GREAT_CALAMITY" &&
      (!event.calamityCode || event.destinyReward !== 1)
    )
      throw new ConfigurationError("Thiếu mã/phần thưởng Đại kiếp nạn.");
    for (const stage of event.stages) {
      if (
        !stage.choices.length ||
        new Set(stage.choices.map((c) => c.code)).size !==
          stage.choices.length ||
        stage.defaultOutcome.terminal === "NEXT" ||
        (event.mandatory && stage.defaultOutcome.terminal !== "FAILURE")
      )
        throw new ConfigurationError("Lựa chọn/kết cục mặc định không hợp lệ.");
      for (const choice of stage.choices) {
        if (choice.requirements) validateRequirements(choice.requirements);
        if (!choice.result || !["FIXED", "CHANCE"].includes(choice.result.kind))
          throw new ConfigurationError("Lựa chọn thiếu kết cục.");
        if (
          !Number.isInteger(choice.apCost) ||
          choice.apCost < 0 ||
          !Number.isInteger(choice.silverCost) ||
          choice.silverCost < 0
        )
          throw new ConfigurationError("Chi phí sự kiện không hợp lệ.");
        if (choice.result.kind === "CHANCE") {
          const f = choice.result.formula;
          if (
            f.intDivisor <= 0 ||
            f.hpDivisor <= 0 ||
            f.min < 0 ||
            f.max > 1 ||
            f.min > f.max
          )
            throw new ConfigurationError("Xác suất không hợp lệ.");
        }
      }
      const outcomes = [
        stage.defaultOutcome,
        ...stage.choices.flatMap((c) =>
          c.result.kind === "FIXED"
            ? [c.result.outcome]
            : [c.result.success, c.result.failure],
        ),
      ];
      for (const o of outcomes) {
        if (
          !o ||
          !o.text ||
          (event.group === "GREAT_CALAMITY" &&
            o.terminal === "SUCCESS" &&
            event.stages.indexOf(stage) !== event.stages.length - 1) ||
          !["SUCCESS", "FAILURE", "NEXT"].includes(o.terminal) ||
          o.flags.some(
            (f) =>
              !["SEVERELY_ILL", "CONVERT_HAREM", "RUMOR_SETTLEMENT"].includes(
                f,
              ),
          ) ||
          (o.terminal === "NEXT" &&
            (!o.nextStage ||
              !stages.has(o.nextStage) ||
              event.stages.findIndex((s) => s.code === o.nextStage) <=
                event.stages.indexOf(stage))) ||
          Object.values(o.effects).some((v) => !Number.isSafeInteger(v))
        )
          throw new ConfigurationError(
            "Tham chiếu/kết cục sự kiện không hợp lệ hoặc gây tử vong.",
          );
      }
    }
  }
}
validateEventCatalog(events);
export const EVENT_CATALOG: readonly EventDefinition[] = events;
