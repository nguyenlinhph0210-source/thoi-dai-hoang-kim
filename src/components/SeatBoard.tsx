"use client";
import { useEffect, useState } from "react";
import type { Branch } from "@/types/game";
import type { SeatBoardRow } from "@/types/seats";
import { BRANCH_INFO } from "@/lib/gameConfig";
export default function SeatBoard({
  rows,
  branch,
  currentRankId,
  targetRankId,
}: {
  rows: SeatBoardRow[];
  branch: Branch;
  currentRankId: string;
  targetRankId: string | null;
}) {
  const [selected, setSelected] = useState(branch);
  useEffect(() => setSelected(branch), [branch]);
  return (
    <div className="seat-board">
      <label>
        Nhánh xem{" "}
        <select
          aria-label="Nhánh Quan chế"
          value={selected}
          onChange={(e) => setSelected(e.target.value as Branch)}
        >
          {(Object.keys(BRANCH_INFO) as Branch[]).map((b) => (
            <option key={b} value={b}>
              {BRANCH_INFO[b].name}
            </option>
          ))}
        </select>
      </label>
      <p className="stage-muted">
        Chỉ công bố số ghế. Tam Thái dùng chung Văn/Võ; Thái úy dành riêng Võ
        giai. Phẩm khởi đầu không chiếm ghế.
      </p>
      {rows.length === 0 ? (
        <p>Chưa có dữ liệu ghế. Hãy thử đồng bộ lại.</p>
      ) : (
        <div className="seat-table-wrap">
          <table>
            <caption>Ghế theo phẩm trật · {BRANCH_INFO[selected].name}</caption>
            <thead>
              <tr>
                <th>Phẩm trật</th>
                <th>Tổng</th>
                <th>Đã có</th>
                <th>Còn trống</th>
                <th>Đơn chờ</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .filter((r) => r.branch === selected)
                .map((r) => (
                  <tr
                    key={r.rankId}
                    className={
                      r.rankId === currentRankId
                        ? "seat-current"
                        : r.rankId === targetRankId
                          ? "seat-target"
                          : ""
                    }
                  >
                    <th scope="row">
                      {r.name}
                      {r.rankId === currentRankId && <small>Hiện tại</small>}
                      {r.rankId === targetRankId && <small>Mục tiêu</small>}
                      {r.starting && <small>Khởi đầu · không chiếm ghế</small>}
                    </th>
                    <td>{r.total ?? "∞"}</td>
                    <td>
                      {r.occupied}
                      {r.reserved > 0 && <small>+{r.reserved} dự trữ</small>}
                    </td>
                    <td>{r.available ?? "∞"}</td>
                    <td>{r.waiting}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
