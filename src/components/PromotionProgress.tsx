"use client";
import { BookOpen, Check, LockKeyhole } from "lucide-react";
import type { PublicPromotionProgress } from "@/lib/promotionEligibility";
import type { Branch } from "@/types/game";
import { RANKS, statLabel } from "@/lib/gameConfig";
import { ACTIONS } from "@/config/actions";
export default function PromotionProgress({
  progress,
  branch,
  lockReason,
  pending,
  onExam,
}: {
  progress: PublicPromotionProgress | null;
  branch: Branch;
  lockReason: string | null;
  pending: boolean;
  onExam: () => void;
}) {
  if (!progress)
    return (
      <section className="promotion-progress">
        <h3>Tiến trình thăng phẩm</h3>
        <p>Chưa có dữ liệu thăng phẩm.</p>
      </section>
    );
  if (!progress.targetRankId)
    return (
      <section className="promotion-progress">
        <h3>Tiến trình thăng phẩm</h3>
        <p>Đã đạt phẩm cao nhất. Không còn điều kiện thăng tiếp.</p>
      </section>
    );
  const target = RANKS[progress.targetRankId];
  return (
    <section className="promotion-progress" aria-labelledby="promotion-heading">
      <h3 id="promotion-heading">
        <BookOpen size={16} />
        Tiến trình thăng phẩm
      </h3>
      <p className="promotion-path">
        {RANKS[progress.currentRankId]?.name} <span>→</span>{" "}
        {target?.name ?? progress.targetRankId}
      </p>
      {progress.conditions.length === 0 ? (
        <p>Chưa có bộ điều kiện được khóa.</p>
      ) : (
        progress.conditions.map((c) => {
          const hidden = c.stat === "suspicion";
          const current = c.current ?? 0;
          const denominator = c.threshold > 0 ? c.threshold : c.threshold + 100;
          const numerator = c.threshold > 0 ? current : current + 100;
          const percent = c.passed
            ? 100
            : Math.max(
                0,
                Math.min(
                  100,
                  denominator === 0 ? 0 : (numerator / denominator) * 100,
                ),
              );
          return (
            <div
              className={`promotion-condition ${c.passed ? "condition-passed" : ""}`}
              key={c.stat}
              data-testid={`promotion-${c.stat}`}
            >
              <div>
                <strong>
                  {c.ignored
                    ? "Điều kiện cũ (ngừng xét)"
                    : statLabel(c.stat, branch)}
                </strong>
                <span>
                  {c.ignored
                    ? "Không xét"
                    : hidden
                      ? `≤ ${c.threshold}`
                      : `${c.current} / ${c.threshold}`}
                </span>
              </div>
              <small>
                {c.passed ? (
                  <>
                    <Check size={11} /> Đạt
                  </>
                ) : (
                  <>
                    <LockKeyhole size={11} /> Chưa đạt
                  </>
                )}
              </small>
              {!hidden && !c.ignored && (
                <div
                  className="promotion-track"
                  role="progressbar"
                  aria-label={statLabel(c.stat, branch)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.floor(percent)}
                >
                  <span style={{ width: `${percent}%` }} />
                </div>
              )}
              {c.hint && (
                <p
                  className={
                    c.unreachable ? "promotion-warning" : "promotion-hint"
                  }
                >
                  {c.hint}
                </p>
              )}
            </div>
          );
        })
      )}
      <div className="promotion-extra">
        <div>
          <span>Tại vị (ngày game)</span>
          <strong>
            {progress.tenure.current} / {progress.tenure.required}
          </strong>
        </div>
        <div>
          <span>Công trạng</span>
          <strong>
            {progress.merit.current} / {progress.merit.required}
          </strong>
        </div>
      </div>
      <p className="promotion-exam-status" data-testid="exam-status">
        {progress.exam.valid
          ? `Khảo hạch còn hiệu lực ${progress.exam.remainingDays} ngày game.`
          : progress.exam.passedGameDay !== null
            ? "Khảo hạch đã hết hiệu lực hoặc khác phẩm mục tiêu."
            : "Chưa đạt khảo hạch."}
      </p>
      {progress.underInvestigation && (
        <p className="promotion-warning">
          Đang bị tra xét, chưa thể khảo hạch.
        </p>
      )}
      <button
        className="primary-button exam-button"
        data-testid="action-EXAM"
        disabled={pending || !!lockReason}
        onClick={onExam}
      >
        Khảo hạch · {ACTIONS.EXAM.apCost} AP · {ACTIONS.EXAM.hpCost} Thể Lực
      </button>
      {lockReason && <p className="lock-reason">{lockReason}</p>}
      <p className="promotion-hint">
        Ghế trống: chưa xét (Chặng 3B).
        {progress.eligibleToApply ? " Đã đạt điều kiện cá nhân." : ""}
      </p>
    </section>
  );
}
