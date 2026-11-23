"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Crown,
  Landmark,
  Loader2,
  LogOut,
  ScrollText,
  Shield,
  Sparkles,
  UserRound,
} from "lucide-react";
import { ACTIONS, isActionCode, type ActionCode } from "@/config/actions";
import { AP_CAP, MS_PER_GAME_DAY, START_REIGN_YEAR } from "@/config/balance";
import { getWorldTime } from "@/lib/worldClock";
import { msUntilApGrant, utc7Date } from "@/lib/ap";
import { BRANCH_INFO, RANKS, statLabel } from "@/lib/gameConfig";
import { logout } from "@/app/login/actions";
import type { GameView, LogPage } from "@/types/runtime";
import ReadWarnings from "./ReadWarnings";
import EventCards from "./EventCards";
import type { ResolveEventInput } from "@/types/events";
import type { PublicActionLog } from "@/types/runtime";
import SeatBoard from "./SeatBoard";
import PromotionProgress from "./PromotionProgress";
import PalaceIllustration from "./PalaceIllustration";
import PalaceStage from "./PalaceStage";
import HaremProfile from "./HaremProfile";
import { titledRank, cosmeticAppearance } from "@/lib/cosmeticRules";
import { HONORIFICS, HAREM_ITEMS, CHAMBER_DECOR } from "@/content/harem";
import ScrollSheet from "@/ui/ScrollSheet";
import { CourtIcon, Ornament } from "@/ui/Court";
import { displayAppearance, type PreviewSelection } from "@/ui/appearance";
const tabs = [
  { key: "profile", name: "Hồ sơ", icon: UserRound },
  { key: "stage", name: "Sân khấu", icon: Crown },
  { key: "ranks", name: "Quan chế", icon: Landmark },
  { key: "logs", name: "Nhật ký", icon: ScrollText },
] as const;
const statKeys = ["int", "rep", "fav", "cha", "hp", "characterSilver"] as const;
function duration(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
export default function MainStage({
  initialState,
  initialJournal,
}: {
  initialState: GameView;
  initialJournal: LogPage;
}) {
  const [state, setState] = useState(initialState),
    [journal, setJournal] = useState(initialJournal);
  const [tab, setTab] = useState<(typeof tabs)[number]["key"]>("stage");
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [sending, setSending] = useState(false),
    [loading, setLoading] = useState(false);
  const [cosmeticPending, setCosmeticPending] = useState(false);
  const [preview, setPreview] = useState<PreviewSelection | null>(null);
  const [eventResult, setEventResult] = useState<PublicActionLog | null>(null);
  const [retry, setRetry] = useState<
    ({ code: ActionCode; key: string } & Partial<ResolveEventInput>) | null
  >(null);
  const requestRef = useRef<
      ({ code: ActionCode; key: string } & Partial<ResolveEventInput>) | null
    >(null),
    busy = useRef(false),
    reading = useRef<Promise<void> | null>(null);
  const [anchor, setAnchor] = useState<{
      serverNow: number;
      monotonic: number;
    } | null>(null),
    [tick, setTick] = useState(0);
  const storageKey = `dnk-action-${state.account.id}`;
  const refresh = useCallback(async (page = 0) => {
    const task = (reading.current ?? Promise.resolve()).then(async () => {
      setLoading(true);
      try {
        const start = performance.now();
        const response = await fetch(`/api/game?page=${page}`, {
          cache: "no-store",
        });
        if (response.status === 401) {
          window.location.assign("/login");
          return;
        }
        if (!response.ok) throw new Error("Không thể đọc trạng thái.");
        const payload = (await response.json()) as {
          state: GameView;
          journal: LogPage;
        };
        setState(payload.state);
        setJournal(payload.journal);
        const end = performance.now();
        setAnchor({
          serverNow: payload.state.serverNow + (end - start) / 2,
          monotonic: end,
        });
        setTick(end);
      } catch {
        setError("Không thể đồng bộ dữ liệu. Vui lòng thử lại.");
      } finally {
        setLoading(false);
      }
    });
    reading.current = task;
    await task;
    if (reading.current === task) reading.current = null;
  }, []);
  const syncClock = useCallback(async () => {
    try {
      const start = performance.now();
      const response = await fetch("/api/world-time", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as {
        serverNow: number;
        seasonStart: number;
      };
      const end = performance.now();
      setAnchor({
        serverNow: data.serverNow + (end - start) / 2,
        monotonic: end,
      });
      setTick(end);
    } catch {
      /* The display continues from the last server sample. */
    }
  }, []);
  useEffect(() => {
    void syncClock();
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        const value = JSON.parse(stored) as {
          code: unknown;
          key: unknown;
          eventId?: unknown;
          choiceCode?: unknown;
          stage?: unknown;
        };
        if (isActionCode(value.code) && typeof value.key === "string") {
          const pending = {
            code: value.code,
            key: value.key,
            ...(typeof value.eventId === "string" &&
            typeof value.choiceCode === "string"
              ? {
                  eventId: value.eventId,
                  choiceCode: value.choiceCode,
                  ...(typeof value.stage === "number"
                    ? { stage: value.stage }
                    : {}),
                }
              : {}),
          };
          requestRef.current = pending;
          setRetry(pending);
        }
      }
    } catch {
      sessionStorage.removeItem(storageKey);
    }
    const timer = setInterval(() => setTick(performance.now()), 1000);
    const focus = () => {
      void syncClock();
      void refresh();
    };
    window.addEventListener("focus", focus);
    const visible = () => {
      if (document.visibilityState === "visible") focus();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh, syncClock, storageKey]);
  const now = anchor
    ? anchor.serverNow + Math.max(0, tick - anchor.monotonic)
    : state.serverNow;
  const world = getWorldTime(
    now,
    Date.parse(state.season.seasonStartTimestamp),
  );
  const today = utc7Date(now);
  const promotionDay = Math.floor(
    Math.max(0, now - Date.parse(state.season.seasonStartTimestamp)) /
      MS_PER_GAME_DAY,
  );
  const sampledPromotionDay = Math.floor(
    Math.max(
      0,
      state.serverNow - Date.parse(state.season.seasonStartTimestamp),
    ) / MS_PER_GAME_DAY,
  );
  const eventDeadlineDue = (state.pendingEvents ?? []).some(
    (e) =>
      Date.parse(e.expiresAt) > state.serverNow &&
      Date.parse(e.expiresAt) <= now,
  );
  useEffect(() => {
    if (
      eventDeadlineDue ||
      today !== utc7Date(state.serverNow) ||
      promotionDay !== sampledPromotionDay
    )
      void refresh();
  }, [
    today,
    state.serverNow,
    promotionDay,
    sampledPromotionDay,
    eventDeadlineDue,
    refresh,
  ]);
  const c = state.character!;
  const appearance = useMemo(
    () =>
      displayAppearance(
        cosmeticAppearance(c.rankId, state.cosmetics),
        state.cosmetics?.equipment,
        preview,
      ),
    [c.rankId, state.cosmetics, preview],
  );
  async function act(code: ActionCode, choice?: ResolveEventInput) {
    if (busy.current || cosmeticPending) return;
    const request = requestRef.current ?? {
      code,
      key: crypto.randomUUID(),
      ...choice,
    };
    if (request.code !== code) return;
    requestRef.current = request;
    setRetry(request);
    sessionStorage.setItem(storageKey, JSON.stringify(request));
    busy.current = true;
    setSending(true);
    setError("");
    setMessage("");
    setEventResult(null);
    try {
      const response = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const result = (await response.json()) as {
        message?: string;
        error?: string;
        retryable?: boolean;
        log?: PublicActionLog;
      };
      if (!response.ok) {
        if (!result.retryable) {
          requestRef.current = null;
          setRetry(null);
          sessionStorage.removeItem(storageKey);
        }
        throw new Error(result.error ?? "Hành động chưa hoàn tất.");
      }
      requestRef.current = null;
      setRetry(null);
      sessionStorage.removeItem(storageKey);
      setMessage(
        result.log?.event ? "" : (result.message ?? "Hành động đã hoàn tất."),
      );
      if (result.log?.event) setEventResult(result.log);
      await refresh();
    } catch (err) {
      setError(
        err instanceof TypeError || err instanceof SyntaxError
          ? "Mất kết nối. Hãy thử lại cùng yêu cầu."
          : err instanceof Error
            ? err.message
            : "Mất kết nối. Hãy thử lại cùng yêu cầu.",
      );
    } finally {
      busy.current = false;
      setSending(false);
    }
  }
  const profile = (
    <HaremProfile
      state={state}
      preview={preview}
      onPreview={setPreview}
      disabled={sending || !!retry}
      onPending={setCosmeticPending}
      onComplete={() => refresh()}
    >
      <section className="stage-paper profile-panel">
        <div className="section-caption">
          <UserRound size={16} />
          <h2>Hồ sơ thân phận</h2>
        </div>
        <div className="profile-seal">
          <Crown size={30} />
        </div>
        <h3>{BRANCH_INFO[c.branch].name}</h3>
        <p>
          {titledRank(c.rankId, state.cosmetics)} · {c.age} tuổi
        </p>
        <p className="destiny-points" data-testid="destiny-points">
          Điểm Thiên Mệnh <strong>{state.account.destinyPoints}</strong>
        </p>
        <div className="profile-stats">
          {statKeys.map((key) => (
            <div key={key}>
              <span>{statLabel(key, c.branch)}</span>
              <strong data-testid={`profile-${key}`}>{c[key]}</strong>
            </div>
          ))}
        </div>
        <PromotionProgress
          progress={state.promotion}
          branch={c.branch}
          lockReason={state.actionLocks.EXAM}
          pending={sending || !!retry || cosmeticPending}
          onExam={() => void act("EXAM")}
          application={state.seatApplication ?? null}
          applyLock={state.actionLocks.APPLY}
          onApply={() => void act("APPLY")}
          onWithdraw={() => void act("WITHDRAW")}
          nextRoundCountdown={
            state.nextSeatRoundAt
              ? duration(state.nextSeatRoundAt - now)
              : "Đang đồng bộ…"
          }
        />
        {state.suspicionWarning && (
          <p className="suspicion-warning" role="status">
            <Shield size={16} /> Tì vết đã nhiều. Hãy cẩn trọng trước những ánh
            nhìn trong triều.
          </p>
        )}
        {c.status === "SEVERELY_ILL" && (
          <p className="suspicion-warning">
            Đang trọng bệnh · còn {c.treatmentsRemaining} lần điều trị.
          </p>
        )}
        <p className="stage-muted">
          Nghi Kỵ được giữ kín. Mọi thay đổi do máy chủ xác nhận.
        </p>
      </section>
    </HaremProfile>
  );
  const logPanel = (
    <section className="stage-paper journal-panel">
      <div className="section-caption">
        <ScrollText size={16} />
        <h2>Nhật ký triều chính</h2>
      </div>
      {loading && <p role="status">Đang đọc nhật ký…</p>}
      {journal.logs.length === 0 ? (
        <div className="empty-journal">
          <ScrollText size={30} />
          <p>Chưa có dấu chân trong triều.</p>
          <small>Hành động đầu tiên sẽ mở trang nhật ký.</small>
        </div>
      ) : (
        <ol className="journal-list">
          {journal.logs.map((log) => (
            <li key={log.id}>
              <span className="journal-dot" />
              <strong>
                {log.cosmetic
                  ? log.cosmetic.description
                  : log.event
                    ? log.event.title
                    : log.promotion
                      ? `${log.promotion.conversion ? "Chuyển nhánh" : "Thăng phẩm"} · ${RANKS[log.promotion.toRankId]?.name}`
                      : (ACTIONS[log.actionCode].branchNames?.[c.branch] ??
                        ACTIONS[log.actionCode].name)}
              </strong>
              <small>
                Năm {START_REIGN_YEAR + log.worldTime.currentGameYear - 1},
                tháng {log.worldTime.currentGameMonth}, ngày{" "}
                {log.worldTime.currentGameDay} · −{log.apSpent} AP
                {log.meritGained ? ` · +${log.meritGained} công trạng` : ""}
              </small>
              {log.event && (
                <p>
                  {log.event.expired ? "Đã hết hạn · " : ""}
                  {log.event.text} {log.event.suspicionNarrative}
                  {log.event.destinyAwarded
                    ? ` +${log.event.destinyAwarded} Điểm Thiên Mệnh.`
                    : ""}
                </p>
              )}
              {log.titleGrant && (
                <p>
                  Ban phong:{" "}
                  {
                    HONORIFICS.find((t) => t.code === log.titleGrant?.titleCode)
                      ?.name
                  }{" "}
                  {RANKS[log.titleGrant.rankId]?.name}
                </p>
              )}
              {log.exam && (
                <p>
                  {log.exam.success
                    ? "Khảo hạch thành công"
                    : "Khảo hạch chưa đạt"}
                </p>
              )}
              <p>
                {statKeys
                  .flatMap((key) => {
                    const delta = log.after[key] - log.before[key];
                    return delta
                      ? [
                          `${statLabel(key, c.branch)} ${delta > 0 ? "+" : ""}${delta}`,
                        ]
                      : [];
                  })
                  .join(" · ") || "Chỉ số công khai không đổi."}
              </p>
            </li>
          ))}
        </ol>
      )}
      <div className="log-pagination">
        <button
          aria-label="Trang nhật ký trước"
          disabled={loading || journal.page === 0}
          onClick={() => void refresh(journal.page - 1)}
        >
          <ChevronLeft size={16} />
        </button>
        <span>Trang {journal.page + 1}</span>
        <button
          aria-label="Trang nhật ký sau"
          disabled={loading || !journal.hasMore}
          onClick={() => void refresh(journal.page + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </section>
  );
  return (
    <div className="site-shell stage-shell">
      <header className="topbar stage-topbar">
        <a href="/" className="brand">
          <span className="brand-mark">
            <CourtIcon symbol="seal" />
          </span>
          <span>
            ĐẠI NỘI KÝ<small>HOÀNG TRIỀU ĐẠI KHÁNH</small>
          </span>
        </a>
        <div className="world-calendar" data-testid="world-time">
          <strong>
            Thiên Nguyên năm {START_REIGN_YEAR + world.currentGameYear - 1}
          </strong>
          <span>
            Tháng {world.currentGameMonth} · Ngày {world.currentGameDay} · Tuần{" "}
            {world.currentGameWeek}
          </span>
        </div>
        <div className="ap-display">
          <strong data-testid="ap-balance">
            <Sparkles size={15} />
            {state.account.actionPoints}/{AP_CAP} AP
          </strong>
          <small>Thêm AP sau {duration(msUntilApGrant(now))}</small>
        </div>
        <form action={logout}>
          <button
            className="logout-button"
            title="Đăng xuất"
            aria-label="Đăng xuất"
          >
            <LogOut size={17} />
          </button>
        </form>
      </header>
      <div className="court-backdrop">
        {c.branch === "HAREM" ? (
          <PalaceStage active appearance={appearance} />
        ) : (
          <div className="court-flat-background">
            <PalaceIllustration />
          </div>
        )}
      </div>
      <div className="court-edge" aria-hidden="true" />
      {preview && (
        <div className="tryon-badge" role="status" data-testid="tryon-status">
          <CourtIcon symbol="fan" />
          <span>
            Đang thử ·{" "}
            {
              [...HAREM_ITEMS, ...CHAMBER_DECOR].find(
                (i) => i.code === preview.code,
              )?.name
            }
          </span>
          <button onClick={() => setPreview(null)}>Thoát thử</button>
        </div>
      )}
      <main className="stage-layout">
        <section className="stage-intro">
          <div className="eyebrow">PHỤNG THIÊN PHỦ · MỘT NGÀY TRONG TRIỀU</div>
          <h1>Sân khấu chính</h1>
          <p>Chọn một việc hôm nay, viết một nét cho cuộc đời.</p>
          <Ornament />
        </section>
        <ReadWarnings warnings={state.readWarnings} />
        {message && (
          <div className="stage-notice" role="status">
            {message}
          </div>
        )}
        {eventResult?.event && (
          <div
            className="stage-paper event-result"
            role="status"
            data-testid="event-result"
          >
            <h2>{eventResult.event.title}</h2>
            <p>{eventResult.event.text}</p>
            <p>
              {statKeys
                .flatMap((key) => {
                  const delta =
                    eventResult.after[key] - eventResult.before[key];
                  return delta
                    ? [
                        `${statLabel(key, c.branch)} ${delta > 0 ? "+" : ""}${delta}`,
                      ]
                    : [];
                })
                .join(" · ") || "Chỉ số công khai không đổi."}
            </p>
            <p>{eventResult.event.suspicionNarrative}</p>
            {eventResult.event.destinyAwarded > 0 && (
              <p>+{eventResult.event.destinyAwarded} Điểm Thiên Mệnh</p>
            )}
          </div>
        )}
        {error && (
          <div className="error-message" role="alert">
            {error}
            <button onClick={() => void refresh(journal.page)}>
              Đồng bộ lại
            </button>
          </div>
        )}
        {retry && !sending && (
          <div className="stage-notice">
            <p>Có một yêu cầu đang chờ xác nhận kết quả.</p>
            <button
              className="reroll-button"
              onClick={() => void act(retry.code)}
            >
              Thử lại yêu cầu cũ
            </button>
          </div>
        )}
        {cosmeticPending && (
          <div className="stage-notice">
            Một thao tác Hậu cung đang chờ xác nhận.{" "}
            <button onClick={() => setTab("profile")}>
              Mở Hồ sơ để thử lại
            </button>
          </div>
        )}
        <ScrollSheet activeKey={tab} previewCode={preview?.code}>
          <div className="stage-columns">
            <div
              className={`mobile-pane ${tab === "profile" ? "pane-active" : ""}`}
            >
              {profile}
            </div>
            <section
              className={`stage-paper stage-center mobile-pane ${tab === "stage" ? "pane-active" : ""}`}
            >
              <EventCards
                events={state.pendingEvents ?? []}
                serverNow={now}
                pending={sending || !!retry || cosmeticPending}
                onChoose={(choice) => void act("RESOLVE_EVENT", choice)}
              />
              <div className="section-caption">
                <BookOpen size={16} />
                <h2>Việc trong ngày</h2>
              </div>
              <div className="action-grid">
                {Object.values(ACTIONS)
                  .filter(
                    (a) =>
                      ![
                        "EXAM",
                        "APPLY",
                        "WITHDRAW",
                        "RESOLVE_EVENT",
                        "COSMETIC",
                      ].includes(a.code),
                  )
                  .map((a) => {
                    const reason = state.actionLocks[a.code];
                    return (
                      <article
                        className={`action-card ${reason ? "action-locked" : ""}`}
                        key={a.code}
                      >
                        <div className="action-card-title">
                          <h3>{a.branchNames?.[c.branch] ?? a.name}</h3>
                          <span>{a.apCost} AP</span>
                        </div>
                        <p>{a.description}</p>
                        <small>
                          Còn{" "}
                          {Math.max(0, a.dailyCap - (state.usage[a.code] ?? 0))}
                          /{a.dailyCap} hôm nay
                          {a.silverCost > 0 ? ` · ${a.silverCost} lượng` : ""}
                          {a.hpCost > 0 ? ` · ${a.hpCost} thể lực` : ""}
                        </small>
                        <button
                          className="action-button"
                          data-testid={`action-${a.code}`}
                          disabled={
                            sending || !!retry || cosmeticPending || !!reason
                          }
                          onClick={() => void act(a.code)}
                        >
                          {sending && requestRef.current?.code === a.code ? (
                            <Loader2 size={14} className="spin" />
                          ) : (
                            <ChevronRight size={14} />
                          )}
                          Thực hiện
                        </button>
                        {reason && (
                          <span className="lock-reason">{reason}</span>
                        )}
                      </article>
                    );
                  })}
              </div>
              <p className="stage-muted">
                Đọc trang không tốn AP. Hạn mức theo tài khoản và ngày thực Việt
                Nam.
              </p>
            </section>
            <aside className="stage-right">
              <section
                className={`stage-paper ranks-panel mobile-pane ${tab === "ranks" ? "pane-active" : ""}`}
              >
                <div className="section-caption">
                  <Landmark size={16} />
                  <h2>Quan chế</h2>
                </div>
                <SeatBoard
                  ownTitle={titledRank(c.rankId, state.cosmetics)}
                  rows={state.seatBoard ?? []}
                  branch={c.branch}
                  currentRankId={c.rankId}
                  targetRankId={state.promotion?.targetRankId ?? null}
                />
              </section>
              <div
                className={`mobile-pane ${tab === "logs" ? "pane-active" : ""}`}
              >
                {logPanel}
              </div>
            </aside>
          </div>
        </ScrollSheet>
      </main>
      <nav className="bottom-nav" aria-label="Điều hướng chính">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? "active" : ""}
            aria-current={tab === t.key ? "page" : undefined}
            onClick={() => {
              setTab(t.key);
              setPreview(null);
            }}
          >
            <t.icon size={20} />
            <span>
              {t.name}
              {t.key === "stage" && (state.pendingEvents?.length ?? 0) > 0
                ? ` (${state.pendingEvents.length})`
                : ""}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}
