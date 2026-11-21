# ĐẠI NỘI KÝ — Chặng 4A · Sự kiện cá nhân và Thiên Mệnh

Next.js App Router, TypeScript strict, Tailwind, Lucide và Supabase. Quy tắc: [AGENTS.md](AGENTS.md). Tiến độ, giả định, TEMP và checklist: [docs/PROGRESS.md](docs/PROGRESS.md).

## Chạy và kiểm tra

Node 24.22.1, npm 11. Chặng 3B không thêm dependency.

```sh
npm ci --cache /workspace/.npm-cache
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Thiếu toàn bộ cấu hình Supabase thì dùng `InMemoryGameRepository`: mỗi tài khoản có email/mật khẩu/phiên riêng, không có người dùng demo chung. Dữ liệu mất khi restart; chỉ dùng một process cho local/test. Không dùng InMemory cho triển khai nhiều máy chủ. Một phần cấu hình Supabase bị thiếu sẽ báo lỗi, không âm thầm chuyển sang local. Local production HTTP cần `COOKIE_SECURE=false`; HTTPS mặc định Secure.

Playwright chạy production build tại cổng 3100 với InMemory. Dùng `/usr/bin/chromium`, hoặc cài `npx playwright install chromium`/đặt `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Không chạy dev server đồng thời với build trong cùng `.next`.

## Supabase và thứ tự migration

Đặt đủ ba biến trong `.env.local` hoặc secret settings, theo [.env.example](.env.example):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`: chỉ server, không log/commit, không tiền tố NEXT_PUBLIC.

Bỏ `GAME_REPOSITORY=memory` khi dùng Supabase. Ép InMemory trên production build cần `ALLOW_IN_MEMORY=true`. Supabase Auth dùng email/password; cấu hình Site URL và email confirmation. Middleware refresh cookie HttpOnly; server xác minh danh tính bằng `getUser`. Các trang/API game yêu cầu đăng nhập, API ghi kiểm tra origin.

Thứ tự trong SQL Editor:

1. Dự án mới: `supabase/schema.sql` **một lần**. Đã có M1 thì bỏ qua, không chạy lại schema.
2. [0002_character_ill_status.sql](supabase/migrations/0002_character_ill_status.sql), chạy riêng để commit enum.
3. [0003_runtime_foundation.sql](supabase/migrations/0003_runtime_foundation.sql).
4. [0004_promotion_requirements.sql](supabase/migrations/0004_promotion_requirements.sql).
5. [0005_seats_and_promotion.sql](supabase/migrations/0005_seats_and_promotion.sql).
6. [0006_fix_safeupdate.sql](supabase/migrations/0006_fix_safeupdate.sql).
7. [0007_personal_events.sql](supabase/migrations/0007_personal_events.sql).

**Đã ở 3B và chạy bản sửa 0006: chỉ chạy 0007 trước code này. Chưa có 0006 thì chạy 0006 rồi 0007; ở 3A chạy 0005 → 0006 → 0007.** 0005 có begin/commit và chạy lại an toàn; không reset AP, mùa, đơn, ghế hoặc R đã khóa. Giải phóng ghế khởi đầu còn sót từ M1 theo quyết định 3B; giữ lịch sử các ghế khác. Không chạy lại migration phiên bản cũ sau migration mới vì sẽ hạ phiên bản RPC; đặc biệt không chạy lại 0005 sau 0006 vì sẽ khôi phục trigger lỗi. Không sửa schema.sql hay migration 0002–0006.

**chưa kiểm chứng trên Supabase thật**: môi trường này chưa có cấu hình dịch vụ. PGlite chạy migration/RPC/RLS với auth/role stub; không thay thế Supabase Auth hay kiểm thử khóa trên PostgreSQL nhiều kết nối. Làm checklist trong PROGRESS trước khi triển khai công khai.

## Sự kiện cá nhân (4A)

`eventEngine.ts` là engine thuần, RNG/ID tiêm được để test. Kho `src/config/events.ts` có 20 sự kiện SAMPLE_DRAFT hư cấu, gồm 8 NORMAL, 4 RARE (có triệu kiến Hậu cung), 4 DANGEROUS ngẫu nhiên, 2 tra xét bắt buộc, 2 Đại kiếp nạn hai giai đoạn. `validateEventCatalog` kiểm tra khi nạp; chưa có MAIN_STORY/COURT_WIDE/PvP/NPC cụ thể.

Mỗi tuần game quay 40/60 đúng một lần ở hành động hợp lệ đầu tiên; lựa chọn thật 0 AP cũng tính, còn đọc trang/hết hạn/rút đơn thì không. Nhóm TEMP 65/20/13/2; lọc nhánh/tầng/trạng thái/chỉ số/cooldown, fallback NORMAL rồi không có. HARM/SLANDER nhân trọng số nhân quả, không tăng tần suất quay. Tối đa3 PENDING; hạn **giờ thực** 24/36/12/24 theo nhóm. Hạn gốc giữ cho mọi giai đoạn. Đủ ba vẫn lưu lần quay; tra xét hoãn giữ cờ và chờ chỗ, không vượt trần.

Mọi act của ứng dụng 4A chốt qua `commit_event_world`: khóa thế giới/pool/account/character/event theo thứ tự, kiểm tra world/account revision, ngày server, AP/bạc/HP/cap và điều kiện. Tái sử dụng bộ chốt ghế, check_promotion_action và RPC chuyển nhánh 3B. Hành động, mark, kết quả RNG, sự kiện, ledger, claims và log cùng transaction. Lựa chọn gắn UUID + eventId + choiceCode + stage; nonce cũ trả nguyên kết quả, ngữ cảnh giai đoạn cũ không được áp vào bước mới. Client giữ nguyên toàn bộ ngữ cảnh khi retry.

Tra xét từ Nghi Kỵ≥80 sau hành động/kết cục, cooldown14 ngày game từ xuất hiện, chặn nộp đơn tới khi xử lý dù Nghi Kỵ đã giảm. Dàn xếp dùng engine RUMOR, gồm sàn+5 khi rep<150. Đại kiếp nạn thất bại chỉ bệnh nặng/hao nửa bạc/giảm fav; không chết. Thành công giai đoạn cuối +1 Thiên Mệnh duy nhất mỗi mã/tài khoản/mùa. Sổ cũng ghi chi điểm khi reroll, không bịa lại lịch sử số dư cũ. Lời triệu kiến Hậu cung kiểm tra guard live và gọi đúng RPC 3B; từ chối cooldown30 ngày game từ khi từ chối.

Đọc trạng thái/Quan chế/nhật ký xử lý hết hạn trước phiên ghế nhưng theo kiểu cố gắng hết sức, lỗi có log đã lọc và cảnh báo nhẹ. Đường ghi dừng nếu housekeeping lỗi. RLS bật ngay trên bảng mới; client không đọc raw definition/outcome/stat ẩn. Hồ sơ hiển thị Thiên Mệnh; thẻ sự kiện có thời hạn/chi phí/lý do khóa; kết quả/nhật ký chỉ nói bằng lời về Nghi Kỵ, phân trang20 dòng.

Migration0007 giữ dữ liệu M1 nhưng đổi PK weekly_event_checks sang id và thêm unique character/season/week vì khóa cũ theo tài khoản mâu thuẫn quy tắc mới. Dấu tuần trước triển khai không có roll thì không được bù. Snapshot definition được khóa khi tạo để chỉnh SAMPLE_DRAFT sau này không đổi lựa chọn đang chờ. Không thêm dependency/env/cron. Toàn bộ giả định/TEMP/checklist triển khai ở đầu PROGRESS.

## Sửa lỗi pg-safeupdate và chế độ đọc dự phòng

`seat_world_load` có thể cấp AP lazy, từ đó gọi trigger `seat_world_after_write`. UPDATE revision không WHERE trong 0005 bị pg-safeupdate của PostgREST chặn (21000), dù SQL Editor không chặn. 0006 thay đúng trigger bằng UPDATE giới hạn mùa ACTIVE; giữ các khóa/giao dịch/RLS và quyền service_role. Không sửa 0002–0005, không tắt extension.

Đường đọc hồ sơ/đồng hồ/Quan chế/nhật ký thử xét phiên nhưng tiếp tục đọc nếu xét thất bại; Sân khấu hiển thị cảnh báo nhẹ. Lỗi đếm ghế giữ hồ sơ và báo bảng ghế chưa khả dụng. Snapshot tài khoản thực sự không đọc được vẫn báo lỗi, không giả dữ liệu/AP. Các đường ghi (setup, hành động, nộp đơn, trả ghế, chuyển nhánh) dùng xét phiên nghiêm ngặt; không chốt một phần hay nuốt lỗi.

`supabaseDiagnostics.ts` chỉ log tên RPC/bảng cố định và bốn trường code/message/hint/details. Chỉ các thông điệp hằng đã duyệt được giữ nguyên; văn bản khác bị che vì Postgres có thể nhúng nguyên failing row hoặc khóa/email vào details. Không log đối số, header/URL, token, khóa, ID/chỉ số người chơi.

`npm run lint:sql` chạy trong lint và workflow CI. Quét mọi migration, schema.sql và SQL literal ở src, kiểm tra DML trong thân hàm dollar-quoted, bỏ comment/chuỗi dữ liệu/row lock/upsert có khóa. Câu lỗi bất biến duy nhất trong 0005 được nhận diện chính xác và yêu cầu 0006 thay thế; mọi vi phạm mới làm CI fail. Đây là kiểm tra từ vựng, không phân tích đầy đủ SQL động hay chứng minh WHERE đúng nghiệp vụ; xem AGENTS 1.3 và checklist trong PROGRESS.

## Giao dịch hành động và ghế

`GameRepository` có Supabase/InMemory, thêm `runDueSeatRounds`, `seatBoard`, `releaseSeats`, `convertInnerCourtToHarem`. `seatEngine.ts` là engine thuần, tiêm RNG/ID được; `seatPersistence.ts` tạo đề xuất chỉ gồm hàng thay đổi. Cấu hình ghế ở `src/config/seats.ts`; số TEMP trong `src/config/balance.ts`.

Các hành động Chặng 2/3A vẫn dùng processor và kiểm tra nhân quả/merit/EXAM cũ; lớp 4A chốt qua `commit_event_world` để ghép lần quay/sự kiện cùng transaction. RPC `commit_game_action` cũ được giữ chữ ký; ứng dụng mới dùng lớp bọc sự kiện. UUID theo tài khoản lưu nguyên kết quả trong `action_requests`; retry không trả phí hoặc quay RNG lại. Client khóa nút, giữ UUID trong sessionStorage khi thử lại. Quy tắc nhân quả và công trạng/EXAM giữ nguyên.

Ghế dùng **khóa advisory thế giới + optimistic CAS**:

1. RPC service-only đọc phiên bản thế giới và snapshot nhất quán dưới khóa. Engine tính các phiên hoặc đơn bằng dữ liệu server, không nhận chỉ số/policy từ trình duyệt.
2. `commit_seat_world` lấy khóa thế giới trước, rồi pool theo key, account theo ID, character theo ID. Kiểm tra world revision, revision nhân vật/tài khoản, ngày game/ngày thực, AP và hạn mức. Trigger cập nhật world revision khi dữ liệu liên quan thay đổi; hành động cũ cũng lấy cùng khóa trước khi khóa hàng.
3. Cập nhật phẩm/thời gian tại vị, xóa khảo hạch, trả ghế cũ, cấp ghế mới, ghi bộ R tiếp theo, đơn, lịch sử và ledger/log/usage trong **một transaction**. Hai unique index cấm một nhân vật giữ hai ghế và hai nhân vật giữ cùng slot. `rank_seats` phản ánh ghế đang dùng, `seat_assignments` giữ lịch sử.
4. Nếu snapshot cũ hoặc đi qua ranh giới ngày, đọc lại và retry; ledger được kiểm tra trước CAS để replay luôn trả đúng kết quả cũ.

Đây là lựa chọn khóa thô có chủ đích cho nền tảng hiện tại: giảm nguy cơ deadlock giữa tranh ghế, hành động và chuyển nhánh. Các quyết định nghiệp vụ trong đề xuất được tin cậy từ **server service_role**, giống engine hành động hiện có; RPC không mở cho client. Phiên xét duyệt hiện tải thế giới riêng tư phía server; tối ưu batching/khóa theo pool để chịu tải lớn là việc sau. Đọc Quan chế thông thường chỉ truy vấn số lượng, không tải chỉ số người chơi khác.

InMemory tuần tự hóa theo một khóa thế giới trong process, dùng cùng engine và ledger. Supabase giữ trạng thái bền vững để chạy nhiều instance. PGlite kiểm tra phiên bản cũ bị từ chối và unique constraints; checklist PostgreSQL thật vẫn cần kiểm tra tranh chấp nhiều kết nối.

## Quy tắc thăng phẩm và giả định 3B

- Pool theo phẩm. Tam Thái có đúng ba ghế chung Văn/Võ; Thái úy có một ghế riêng Võ. `rank_pool_links` biểu diễn phẩm có nhiều pool, tái sử dụng `seat_pools`/`rank_seats`. Sức chứa được test trực tiếp với AGENTS 5.1 và SQL. `RESERVED_SEATS_FOR_NPC` mặc định 0; chưa có NPC/chức danh riêng.
- Phẩm khởi đầu không chiếm/bị giới hạn ghế. Bảng Quan chế vẫn hiển thị sức chứa tham chiếu theo AGENTS và ghi chú khởi đầu. Hậu cung 0/14/13/12, Nội cung 1/2/3 không giới hạn.
- Đủ điều kiện cá nhân mới nộp được; `eligibleToApply`/`seatAvailable=UNKNOWN` của evaluator vẫn không chặn vì hết ghế. APPLY 1 AP, cap2/tài khoản/ngày Việt Nam; tối đa một đơn WAITING/nhân vật. Phẩm không giới hạn thăng ngay trong giao dịch nộp đơn. Phẩm giới hạn chờ tuần game kế tiếp dù có ghế trống.
- Phiên ở mốc `seasonStart + round × 7 × 300 giây`; đơn nộp đúng mốc cũng chỉ vào phiên **sau** mốc đó. Đơn tồn tại 28 ngày game, hết hạn tại `expiresAt <= now`; người thua giữ WAITING. Request snapshot/hành động/Quan chế/đồng hồ kích hoạt xét lazy, tuần tự mọi phiên bỏ lỡ.
- TODO(spec): với phiên bỏ lỡ, dùng **chỉ số hiện tại** nhưng đánh giá tại mốc phiên, gồm hiệu lực khảo hạch và tại vị. `rank_entered_at` và nhật ký thăng phẩm là giờ xử lý thật, đúng yêu cầu “hiện tại”; không dựng lại lịch sử chỉ số hoặc hồi tố thời gian tại vị.
- Điểm tranh ghế dùng tổng phân số chính xác (BigInt), không làm tròn: mức vượt ngưỡng chuẩn hóa → merit → thời điểm nộp → ID. Không trả điểm ra client vì có thể suy ra Nghi Kỵ.
- TODO(spec): xét pool một mục tiêu trước pool chia sẻ; Thái úy được lấp bởi Võ giai trước khi xét Tam Thái. Trong cùng nhóm dùng thứ tự key cố định. Nếu ghế cũ được trả sau lúc pool đó đã xét trong phiên, ghế trống được xét ở phiên sau; không xét lặp pool trong cùng tuần.
- TODO(spec): APPLY là hành động tiêu AP nên chịu “quyền lớn bạc cạn”. Xét điều kiện trước trả phí; với thăng ngay kiểm tra lại sau thay đổi nhân quả, không đạt thì rollback cả hành động. Đơn WAITING được kiểm tra lại ở phiên. Rút đơn miễn phí, không cộng công trạng; cho rút khi bệnh/khóa hành động vì đây là hủy thủ tục, không phải hành động phát triển.
- Khi thăng, giữ bộ R cũ; bộ mới kiểm tra đơn điệu với mọi R phát triển cùng nhánh đã sinh trước đó, không so Nghi Kỵ với chỉ số khác. Phẩm cao nhất không có bộ tiếp. R không thay khi reload/thua ghế/thi lại.
- TODO(spec): R tạm legacy có thể vượt cả khoảng v1 kế tiếp (ví dụ fav60 của mục tiêu Mỹ nhân M1 so với Lương nhân v1 tối đa55). Không tự đổi R hoặc nới bảng; thăng ngay rollback, phiên hữu hạn từ chối riêng đơn có mâu thuẫn và tiếp tục xét người khác. Cần chốt cách xử lý dữ liệu cũ.
- TODO(spec): chuyển nhánh chỉ khi ACTIVE và không bị khóa, ngoài guard Nội cung cấp2–6, cha≥150/int≥100/suspicion≤45. Giữ merit và các chỉ số quy định; fav theo công thức, reset tại vị/xóa khảo hạch/rút đơn/trả ghế. Hủy điều kiện Nội cung bằng metadata `superseded_at`, giữ R bất biến để tra lịch sử; bộ Hậu cung mới không so đơn điệu với nhánh cũ. Chưa có endpoint/nút; Chặng 4 gọi backend sự kiện.

## Giao diện và bảo mật

Sân khấu desktop ba cột/mobile bốn tab. Hồ sơ có tiến trình chỉ số/tại vị/công trạng/khảo hạch, nút nộp/rút đơn, trạng thái/lý do và countdown tới phiên. Quan chế xem bốn nhánh, chỉ có tổng/đã có/còn trống/đơn chờ, đánh dấu phẩm hiện tại/mục tiêu. Nhật ký cá nhân gồm hành động và thăng phẩm/chuyển nhánh, phân trang 20 dòng.

Tất cả bảng có RLS. Client chỉ đọc metadata đơn của mình; không ghi trực tiếp, gọi RPC nhạy cảm hoặc đọc raw world/assignments/rank_history.journal. DTO loại Nghi Kỵ/sàn khỏi nhân vật và nhật ký; điều kiện Nghi Kỵ chỉ có ngưỡng/trạng thái/gợi ý. Service key chỉ ở server. 4A chỉ có sự kiện cá nhân; nhật ký công khai, tử vong/trùng sinh, NPC/chức danh, xếp hạng và PvP chưa được cài đặt.

Các quy tắc 3A vẫn giữ: đúng ba điều kiện, C1/C2/Nghi Kỵ 40/40/20; HP/bạc không xét thăng phẩm; EXAM dùng xác suất theo HP đầu hành động và hiệu lực 60 ngày game. AP theo ngày thực Việt Nam; đồng hồ client chỉ hiển thị. Giả định cũ và toàn bộ số TEMP nằm trong PROGRESS.
