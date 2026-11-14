# ĐẠI NỘI KÝ — Chặng 1

Game cung đình hư cấu Đại Khánh, Next.js App Router + TypeScript strict + Tailwind CSS + Lucide React. Quy tắc gốc nằm trong [AGENTS.md](AGENTS.md).

## Chạy dự án

Yêu cầu Node.js 24 (đã kiểm tra với 24.22.1), npm 11.

```sh
npm ci
npm run dev
```

Trong môi trường đám mây này, dùng `npm ci --cache /workspace/.npm-cache` nếu thư mục cache mặc định không ghi được. Không cần khóa Supabase để chạy bản trải nghiệm Chặng 1.

```sh
npm run build       # build production, bao gồm kiểm tra TypeScript
npm run start       # chạy bản production
npm run typecheck
npm test            # logic nghiệp vụ và SQL trên PostgreSQL WASM (PGlite)
npm run test:e2e    # build rồi kiểm thử Chromium trên bản production
```

Kiểm thử trình duyệt dùng Chromium hệ thống nếu có `/usr/bin/chromium`. Máy khác có thể chạy `npx playwright install chromium` hoặc đặt `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. E2E dùng cổng 3100 và thư mục dữ liệu tạm riêng, không sửa tiến trình người chơi đang chạy.

## Nội dung đã triển khai

- `src/types/game.ts`: Account, Character, bảy chỉ số, Rank, SeatPool, Event, NPC, Season và bộ ba điều kiện thăng phẩm.
- `src/lib/gameConfig.ts`: bốn nhánh, khoảng chỉ số, xác suất 40/30/20/10, hiệu ứng xuất thân, bảng giới hạn và trọng số chỉ số thứ ba 40/40/8/8/4.
- `src/lib/characterGenerator.ts`: quy trình khởi tạo bảy bước tại mục 4.3 của AGENTS.md; hàm thuần có nguồn random tiêm được để kiểm thử. Server Actions dùng nguồn ngẫu nhiên mật mã của Node.js.
- `CharacterSetupScreen`: chọn nhánh, xem xuất thân/tuổi/phẩm cấp/chỉ số, đổi thân phận, xác nhận và xem ba điều kiện tiếp theo. Phối màu đỏ son/vàng kim/giấy dó/gỗ trầm, bố cục ba cột trên desktop, một cột trên mobile; Nghi Kỵ không được gửi xuống trình duyệt.
- Đúng ba lượt đổi miễn phí trong cuộc đời đầu; các lần tiếp theo tốn một Thiên Mệnh. Xác nhận hết hạn lượt miễn phí, chuyển ngân lượng chờ nhận đúng một lần, khóa thân phận và lưu điều kiện thăng phẩm. Khởi tạo/đổi/xác nhận không làm mới hoặc tiêu hao AP.

Tài liệu chưa cho điểm chuẩn `B` của từng phẩm cấp hay ngưỡng nhập phẩm cụ thể. `RANKS` dùng **giá trị cân bằng tạm cho Chặng 1**, được ghi rõ trong mã và SQL; ngưỡng nhập phẩm để trống. Hiện có phẩm cấp khởi đầu và cấp kế tiếp của mỗi nhánh. Công thức sinh điều kiện, bảng năm tầng, toán tử Nghi Kỵ và kiểm tra đơn điệu được thực hiện theo mục 5.2; phần còn lại của quan chế sẽ được bổ sung ở chặng sau.

## Lưu tiến trình bản trải nghiệm

Server Action là nơi duy nhất cập nhật tiến trình; trình duyệt chỉ gửi lệnh và số phiên bản, không gửi chỉ số hoặc số dư. Một cookie HttpOnly nhận diện phiên trải nghiệm, dữ liệu nằm trong `.data/setup` (được Git bỏ qua). Lệnh có mã idempotency, khóa theo phiên và kiểm tra revision để tránh ghi đè từ tab cũ; dữ liệu được ghi qua tệp tạm rồi đổi tên nguyên tử. Tải lại trang hoặc khởi động lại Node không cấp thêm lượt. Có thể đổi thư mục bằng `GAME_DATA_DIR` và bật cookie HTTPS bằng `COOKIE_SECURE=true`.

Đây là adapter trải nghiệm **một máy chủ**, chưa phải đăng nhập Supabase hay dịch vụ nhiều máy chủ. Xóa cookie/tạo trình duyệt mới tạo phiên trải nghiệm mới. Cần ổ đĩa bền vững để giữ dữ liệu; nếu tiến trình bị kill giữa lúc giữ khóa, chỉ dọn tệp `.lock` tương ứng sau khi chắc chắn không còn worker sử dụng. Không dùng adapter tệp làm backend game công khai.

## Schema nhiều người chơi

`supabase/schema.sql` là migration chạy **một lần trên Supabase mới**, không tự áp dụng vào dịch vụ bên ngoài. Nó định nghĩa sáu bảng yêu cầu (`accounts`, `seasons`, `characters`, `rank_seats`, `events_log`, `leaderboards`) cùng ranks, seat_pools, promotion_requirements, weekly_event_checks, account_calamity_claims và setup_requests.

- `accounts.id` tham chiếu `auth.users`; trigger tạo tài khoản với ba lượt miễn phí. Chỉ có một cuộc đời đang tạo/đang sống cho mỗi tài khoản.
- RLS bật trên mọi bảng; không cấp quyền ghi trực tiếp cho `anon`/`authenticated`. Người chơi chỉ đọc tài khoản/nhân vật của mình; raw Nghi Kỵ không có quyền SELECT kể cả với chủ nhân.
- `commit_character_setup` chỉ cấp EXECUTE cho `service_role`. Backend phải xác thực người chơi bằng Supabase Auth, lấy account ID từ danh tính đã kiểm chứng, đọc trạng thái qua `get_character_setup`, chạy generator phía máy chủ rồi gọi RPC với revision và request UUID. Không được chuyển tiếp candidate từ trình duyệt. Khóa dịch vụ chỉ ở máy chủ. Kết quả riêng tư của RPC phải qua `publicState` trước khi trả cho client.
- RPC khóa tài khoản, mùa và pool ghế; SQL tính chi phí từ số dư thật, giữ nguyên nhánh khi đổi, chuyển toàn bộ ngân lượng chờ nhận và lưu đúng ba điều kiện trong cùng transaction. Xác nhận lại không nhận thưởng hay sinh lại điều kiện; hết ghế sẽ rollback toàn bộ.
- Khóa chính ghế dùng chung theo mùa/pool/số ghế, cho phép các nhánh dùng chung pool Tam thái khi bổ sung rank tương ứng. Cuộc đời chưa xác nhận không giữ ghế.
- Bảng xếp hạng ghi **MAX điểm một cuộc đời**, không cộng các kiếp; ràng buộc độc nhất chống nhận Thiên Mệnh hai lần từ cùng đại kiếp trong một mùa.

Sau khi áp dụng migration, tạo mùa bằng tài khoản quản trị, ví dụ:

```sql
insert into public.seasons(name, scenario_code)
values ('Đại Khánh · Thiên Nguyên', 'THIEN_NGUYEN');
```

Chặng 1 hiện chưa nối UI vào Supabase Auth/RPC, chưa triển khai cron AP, diễn tiến mùa, hành động chiến đấu hay trao thưởng cuối mùa. SQL đã được thực thi và kiểm tra bằng PGlite với các role/auth stub; chưa được triển khai hay kiểm chứng trên Supabase từ xa.
