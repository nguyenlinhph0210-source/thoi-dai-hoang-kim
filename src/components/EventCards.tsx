"use client";
import { EVENT_BALANCE } from "@/config/balance";
import { Hourglass, ScrollText } from "lucide-react";
import type { PublicPendingEvent, ResolveEventInput } from "@/types/events";
export default function EventCards({
  events,
  serverNow,
  pending,
  onChoose,
}: {
  events: PublicPendingEvent[];
  serverNow: number;
  pending: boolean;
  onChoose: (choice: ResolveEventInput) => void;
}) {
  return (
    <section
      className="personal-events"
      aria-labelledby="personal-events-heading"
    >
      <div className="section-caption">
        <ScrollText size={17} />
        <h2 id="personal-events-heading">
          Biến cố đang chờ{" "}
          <span className="event-count">
            {events.length}/{EVENT_BALANCE.pendingCap}
          </span>
        </h2>
      </div>
      {!events.length ? (
        <p className="stage-muted">
          Chưa có biến cố cần xử lý. Mỗi tuần, hành động đầu tiên có thể mở một
          trang chuyện mới.
        </p>
      ) : (
        events.map((event) => {
          const remaining = Math.max(
              0,
              Date.parse(event.expiresAt) - serverNow,
            ),
            minutes = Math.ceil(remaining / 60000),
            hours = Math.floor(minutes / 60);
          return (
            <article
              className={`event-card ${event.mandatory ? "event-mandatory" : ""}`}
              key={event.id}
              data-testid="pending-event"
            >
              <div className="event-meta">
                <span>
                  {event.mandatory ? "Cần ứng xử" : "Gặp gỡ trong triều"}
                  {event.sample ? " · Nội dung mẫu" : ""}
                </span>
                <span>
                  <Hourglass size={12} /> {hours} giờ {minutes % 60} phút
                </span>
              </div>
              <h3>{event.title}</h3>
              {event.stageCount > 1 && (
                <small>
                  Chặng {event.stage}/{event.stageCount}
                </small>
              )}
              <p>{event.body}</p>
              <div className="event-choices">
                {event.choices.map((choice) => {
                  const lock =
                    choice.lockReason ??
                    (remaining === 0 ? "Đã hết hạn, đang chờ đồng bộ." : null);
                  return (
                    <div key={choice.code}>
                      <button
                        className="reroll-button"
                        disabled={pending || !!lock}
                        onClick={() =>
                          onChoose({
                            eventId: event.id,
                            choiceCode: choice.code,
                            stage: event.stage - 1,
                          })
                        }
                      >
                        {choice.label} · {choice.apCost} AP
                        {choice.silverCost
                          ? ` · ${choice.silverCost} lượng`
                          : ""}
                      </button>
                      {lock && <small className="lock-reason">{lock}</small>}
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })
      )}
    </section>
  );
}
