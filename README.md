# ĐẠI NỘI KÝ — Chặng 2 · Nền tảng vận hành

Next.js App Router, TypeScript strict, Tailwind, Lucide và Supabase. Nguồn quy tắc: [AGENTS.md](AGENTS.md). Rà soát Chặng 1, trạng thái thực hiện, toàn bộ giả định/TEMP và checklist Supabase thật: [docs/PROGRESS.md](docs/PROGRESS.md).

## Chạy local

Node 24.22.1, npm 11. Không thêm dependency mới trong Chặng 2.

```sh
npm ci --cache /workspace/.npm-cache
npm run dev
```

Khi chưa cấu hình Supabase, `InMemoryGameRepository` phục vụ local: đăng ký email/mật khẩu riêng cho từng tài khoản, không có người dùng demo chung. Mật khẩu băm scrypt, cookie phiên HttpOnly; dữ liệu/phiên sẽ mất khi restart process. `.data` của M1 không còn được dùng và không bị xóa. Local HTTP đặt `COOKIE_SECURE=false` nếu chạy production build; HTTPS mặc định Secure.

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

E2E build production, bật InMemory bằng env riêng, chạy Chromium tại cổng 3100; không cần Supabase/khóa thật. Dùng Chromium hệ thống `/usr/bin/chromium`, hoặc `npx playwright install chromium`/`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` trên máy khác. Không chạy dev server và build đồng thời trong cùng `.next`.

## Cấu hình Supabase thật

Ứng dụng chọn `SupabaseGameRepository` khi có cấu hình Supabase. Phải có đủ ba biến trong `.env.local` hoặc secret settings:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`: chỉ server; không tiền tố NEXT_PUBLIC, không log, không commit.

Bỏ `GAME_REPOSITORY=memory` nếu đã cấu hình Supabase; biến này chỉ dùng local/test. Nếu ép memory trên production build, cần `ALLOW_IN_MEMORY=true`. Không dùng InMemory cho triển khai nhiều máy chủ. Một phần cấu hình Supabase bị thiếu sẽ gây lỗi có hướng dẫn, không tự tạo tài khoản local thay thế.

Auth: email/password, có xử lý email confirmation khi signup chưa trả session. Trong Supabase Auth cấu hình Site URL/tên miền và chính sách xác nhận email. Middleware refresh token vào cookie HttpOnly trước khi Server Components/API gọi `getUser`. Không tin account ID hay JWT đã decode ở client. Các route `/`, `/setup` và API game đều yêu cầu đăng nhập. Đăng xuất thu hồi phiên local hoặc gọi Supabase signOut(scope=local), rồi xóa cookie.

### Thứ tự chạy trong Supabase SQL Editor

1. **Supabase mới:** chạy `supabase/schema.sql` một lần để dựng Chặng 1. **Đã chạy M1:** bỏ qua bước này, không sửa/chạy lại schema cũ.
2. Chạy riêng [0002_character_ill_status.sql](supabase/migrations/0002_character_ill_status.sql), để enum mới commit.
3. Chạy [0003_runtime_foundation.sql](supabase/migrations/0003_runtime_foundation.sql).

0002/0003 chạy lại an toàn; không reset AP/ngày grant, mùa hay nhật ký. Migration seed `dai-khanh-thien-nguyen` chỉ nếu chưa có ACTIVE, dùng thời điểm migration làm seasonStart. Nếu có ACTIVE với scenario khác, migration dừng/rollback để bạn quyết định quản trị, không tự kết thúc mùa hiện tại. Giữ nguyên bảng/cột M1; `ap`/`last_ap_grant_date` được đồng bộ với `action_points`/`last_ap_grant_date_utc7`. `freeRerollsLeft` là tên tương thích của freeRerollsRemaining.

**chưa kiểm chứng trên Supabase thật** trong môi trường hiện tại vì chưa có cấu hình dịch vụ. PGlite chạy schema + cả hai migration hai lần và kiểm tra RPC/RLS với role/auth stub, không thay thế kiểm thử Auth/cookie/khóa đồng thời trên dịch vụ thật. Làm [checklist](docs/PROGRESS.md#checklist-kiểm-thử-tay-trên-supabase-thật) trước khi triển khai công khai.

## Lựa chọn giao dịch và ranh giới tin cậy

`GameRepository` gồm readState, setup, act, logs và activeSeason. `worldClock.ts`, `ap.ts`, `statEngine.ts`, `actionProcessor.ts` là hàm thuần. Dữ liệu hành động nằm trong `src/config/actions.ts`; số liệu TEMP và hằng số thế giới/AP nằm trong `src/config/balance.ts`.

Supabase: Server Action/Route Handler xác thực người chơi, lấy trạng thái qua `runtime_snapshot` (cấp AP lazy có khóa hàng). Engine TypeScript tính đề xuất từ trạng thái server. RPC `commit_game_action` khóa accounts, mùa và nhân vật; kiểm tra revision, ngày Việt Nam/ngày game, AP, chi phí, trạng thái và dailyCap rồi ghi AP/chỉ số/usage/request/log/week-mark cùng transaction. Xung đột revision hoặc ranh giới ngày sẽ đọc lại tối đa năm lần. Số dư, giờ hoặc chỉ số client gửi thêm không được dùng.

UUID được duy nhất theo tài khoản. RPC kiểm tra ledger trước khi kiểm tra trạng thái hiện tại, trả lại **nguyên kết quả đã lưu**, kể cả sau khi đã có hành động khác. Adapter đọc ledger cả trước tính toán và khi gặp một lỗi do request trùng vừa tiêu AP; hai request cùng UUID không thành hai lần trừ AP. Client khóa nút trong lúc gửi, giữ UUID khi thử lại và qua refresh trong sessionStorage riêng theo tài khoản. Log trả cho UI loại raw Nghi Kỵ và sàn Nghi Kỵ. Các modifier chỉ được ghi log, không quay sự kiện.

InMemory dùng cùng processor, hàng đợi theo account ID và Map ledger/usage/week-mark riêng. Đồng thời trong một process được tuần tự hóa; restart/multi-instance không giữ các đảm bảo này, cần Supabase cho dữ liệu thật.

Mọi bảng có RLS. Client không có quyền ghi; RPC nhạy cảm chỉ service_role. Bảng/JSON chứa hidden stats không cấp SELECT rộng; profile, kết quả và log đều qua DTO chỉ có chỉ số công khai. Chỉ cảnh báo khi suspicion≥80. M2 không cấp/đổi ghế quan chức, không thăng phẩm; giữ thông tin M1 đã có.

## Đồng hồ, AP và giả định nghiệp vụ

Logic dùng giờ server, trong Supabase mode là giờ DB. Client dùng mẫu server + thời gian monotonic `performance.now()` để hiển thị tiếp, sync khi focus/hiện tab; ngày Việt Nam thay đổi thì tải lại AP. Năm hiển thị = 8 + năm game − 1. Không có tua nhanh. Tuổi = startAge + (năm game − startGameYear).

AP: tài khoản mới 10, cấp +10 cho mỗi ngày thực đã qua ở Asia/Ho_Chi_Minh, trần 15; đọc lặp cùng ngày không cấp thêm. Trạng thái nhân vật, reload, thiết bị hay đồng hồ client không reset AP hoặc hạn mức tài khoản.

Giả định được chọn theo yêu cầu: cộng hưởng cha chồng tầng (`RESONANCE_STACKING=true`); tích hệ số suy kiệt/cộng hưởng rồi floor một lần; sàn Nghi Kỵ bão hòa 100; “khóa 5 lượt” là năm lần Điều trị có trả AP (không cần bạc ở bản TEMP), hồi hp chịu suy kiệt. TODO(spec) chết vì không đủ bạc mời Ngự y để Chặng 5. Toàn bộ giả định và bảng TEMP có trong PROGRESS và mô tả PR.

## Phạm vi giao diện

Sau xác nhận vào Sân khấu chính: desktop ba cột, mobile tối đa 448px và bốn tab Hồ sơ/Sân khấu/Quan chế/Nhật ký. Header có niên lịch/AP/countdown nửa đêm Việt Nam. Tám hành động có AP, chi phí, hạn mức và lý do khóa. Nhật ký phân trang 20 dòng, có trạng thái loading/lỗi/rỗng tiếng Việt. Quan chế chỉ “Sắp ra mắt”. Không bổ sung sự kiện, NPC, tử vong/trùng sinh, xếp hạng, PvP hoặc thanh toán trong chặng này.
