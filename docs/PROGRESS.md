# Tiến độ ĐẠI NỘI KÝ

## Kiểm tra hiện trạng Chặng 1 (trước Chặng 2)

| Thành phần | Hiện trạng được kiểm tra |
| --- | --- |
| Tạo, đổi, xác nhận nhân vật | Server Action + tệp `.data/setup`, cookie phiên ngẫu nhiên; dữ liệu trải nghiệm, chưa xác thực tài khoản |
| Nguồn mùa | ID mùa demo cố định; chưa có đồng hồ thế giới |
| Supabase | Có `supabase/schema.sql`, RLS, trigger accounts và RPC nhưng UI chưa gọi Supabase; chưa có đăng nhập thật |
| AP | Giá trị 10 trên tài khoản trải nghiệm, chưa cấp hằng ngày |
| Giao diện | Màn tạo nhân vật; chưa có Sân khấu chính hay nhật ký hành động |

Adapter tệp đã được gỡ khỏi đường chạy Chặng 2. Các tệp `.data` cũ được giữ nguyên, không tự nhập vào tài khoản Auth vì không chứng minh được chủ sở hữu. Không còn tài khoản demo dùng chung. Tên `freeRerollsLeft`/cột `free_rerolls_left` được giữ để tương thích Chặng 1; đây là `freeRerollsRemaining` trong yêu cầu.

## Đã làm

- Email/password signup, signin, signout với Supabase Auth; access/refresh token trong cookie HttpOnly, SameSite=Lax, Secure trên HTTPS. Middleware làm mới token, Server Components và API xác thực danh tính bằng `getUser`.
- `GameRepository` với Supabase và InMemory. Supabase được chọn khi có cấu hình; cấu hình thiếu một phần sẽ báo lỗi, không âm thầm thay bằng dữ liệu local. Local có đăng ký/mật khẩu băm scrypt và phiên riêng cho từng tài khoản; khởi động lại sẽ mất dữ liệu bộ nhớ.
- Migration bổ sung, giữ nguyên `schema.sql`. Tương thích hai cặp AP cũ/mới bằng trigger; seed một mùa ACTIVE, không reset mùa hoặc AP khi chạy lại.
- Đồng hồ thuần đúng 300 giây/ngày, 30 ngày/tháng, 360 ngày/năm, 7 ngày/tuần. Năm hiển thị bắt đầu từ 8; tuổi theo mốc xác nhận và năm game. API dùng thời gian server (DB trong Supabase mode), client dùng mẫu server + `performance.now()` và đồng bộ khi focus/hiện tab.
- Cấp AP lazy theo ngày Việt Nam, cộng nhiều ngày offline, trần 15, không cấp lại khi đọc lặp. Ngày tạo tài khoản được ghi vào sổ cấp AP.
- Engine chỉ số thuần: clamp, suy kiệt, cộng hưởng diện kiến, quyền lớn bạc cạn, modifier rủi ro chỉ ghi nhật ký, sàn Nghi Kỵ, cảnh báo ngưỡng 80, trọng bệnh và 5 điều trị.
- Tám hành động cấu hình riêng, dailyCap theo tài khoản/ngày, ghi before/after, AP, modifier và thời gian thế giới; dấu hành động đầu tiên mỗi tuần theo nhân vật. Không quay sự kiện.
- Giao dịch Supabase: khóa accounts + mùa + nhân vật, kiểm tra revision và ranh giới ngày, số dư, bệnh/khóa, dailyCap; ledger lưu kết quả gốc theo UUID. Adapter retry CAS, không tính lại kết quả của yêu cầu đã hoàn thành. InMemory tuần tự hóa theo tài khoản và lưu ledger riêng.
- Sân khấu ba cột desktop; bốn tab mobile, Quan chế “Sắp ra mắt”, profile công khai, AP/countdown, hành động có lý do khóa, nhật ký 20 dòng/trang. Trạng thái loading/lỗi/rỗng bằng tiếng Việt; retry mất phản hồi giữ cùng UUID trong sessionStorage theo tài khoản.
- RLS cho mọi bảng; không cấp client quyền ghi. Các bảng thế giới/ghế/xếp hạng ngoài phạm vi không còn quyền đọc rộng từ client. Raw log/result/Nghi Kỵ chỉ ở server; DTO loại Nghi Kỵ trước khi gửi UI.

## Chưa làm

**chưa kiểm chứng trên Supabase thật**: môi trường thực thi chưa có URL, anon key và service-role key. Migration/RPC được chạy bằng PGlite với auth/role stub; điều này không kiểm chứng Supabase Auth, cookie refresh ngoài Internet hay tranh chấp khóa trên PostgreSQL từ xa.

Không triển khai thăng phẩm, chiếm/nhả ghế, NPC, sự kiện ngẫu nhiên, tử vong/trùng sinh, xếp hạng mới, PvP hay thanh toán. M2 vẫn giữ bộ điều kiện thăng phẩm đã sinh của M1, nhưng không thực hiện thăng phẩm và không cấp ghế khi xác nhận. Không thay đổi/xóa bảng hoặc cột M1; các hàm RPC được thay qua migration để thêm trường mới.

## Giả định và TODO(spec)

1. `RESONANCE_STACKING=true`: cộng dồn 15% cho mỗi mốc 200 cha, như một cách đọc được cho phép trong AGENTS.md. Diện kiến nhân cộng hưởng và suy kiệt dựa trên chỉ số **đầu hành động**, rồi floor một lần ở kết quả tăng dương cuối cùng. Mức giảm không bị giảm một nửa.
2. “Khóa 5 lượt”: cần **5 hành động Điều trị**, mỗi lần 1 AP. Chưa đủ năm lần vẫn chỉ được điều trị dù hp đã dương. Chết do không đủ bạc mời Ngự y để Chặng 5: TODO(spec). Điều trị tạm không tốn bạc để tránh khóa vĩnh viễn ở Chặng 2.
3. Sàn Nghi Kỵ cộng 5 khi rep <150, bão hòa ở 100 để giữ chỉ số trong phạm vi hợp lệ. Không có cách hạ sàn trong kiếp này.
4. Chọn an toàn: không được trả chi phí thể lực vượt hp hiện tại; bằng đúng hp thì về 0 và trọng bệnh. Sau toàn bộ thay đổi của hành động, xét rep>60 và bạc<10 để trừ 5 rep.
5. Giữ tên freeRerollsLeft/free_rerolls_left của M1 thay vì tạo cột đồng nghĩa gây lệch số dư. Các cột `ap` và `last_ap_grant_date` là chuẩn M2, cột cũ được đồng bộ tương thích.
6. Một mùa ACTIVE chung. Nếu đã có mùa ACTIVE với scenario khác, migration dừng và rollback; cần quyết định quản trị riêng, không tự kết thúc hay thay lịch thế giới. Với schema chưa có mùa, seed `dai-khanh-thien-nguyen` tại thời điểm migration.
7. Dữ liệu nhân vật cũ: lấy tuổi đã lưu làm startAge, startGameYear theo thời điểm confirmed_at (hoặc created_at nếu còn DRAFT); xác nhận mới đặt lại mốc năm. Không đoán lại lịch sử AP khi grant date cũ null: dùng ngày tạo tài khoản.
8. InMemory chỉ phục vụ local/test, **một process**; không là backend triển khai nhiều instance. Tài khoản, phiên, giới hạn và ledger không sống qua restart ở mode này. Supabase là nơi giữ bền vững cho môi trường thật.
9. Thời điểm trước seasonStart bị clamp về ngày đầu; countdown đến ngày kế tiếp tính từ mốc start. Không có tua nhanh/kết thúc lượt.
10. UTC+7 không có DST; AP lazy dùng ngày DB `Asia/Ho_Chi_Minh`, TS dùng offset cố định tương đương. CAS bị thay đổi ngày thực/ngày game giữa đọc và ghi sẽ đọc lại trước khi commit.
11. Điểm chuẩn thăng phẩm M1 vẫn tạm và không được dùng để thực hiện thăng phẩm trong M2. Dữ liệu tiền tệ dùng số nguyên an toàn JS (SQL đồng bộ giới hạn kỹ thuật 2^53−1), không đặt trần gameplay mới.

## Danh sách số liệu TEMP

Tất cả trong `src/config/balance.ts` (ngoài benchmark M1 trong `gameConfig.ts`):

| Hành động | AP | Bạc trả | HP trả | Thay đổi cơ bản | Hạn/ngày |
| --- | ---: | ---: | ---: | --- | ---: |
| Học kinh sử/quy củ | 1 | 0 | 0 | int +8 | 5 |
| Giao thiệp | 1 | 2 | 0 | rep +7 | 4 |
| Diện kiến/thỉnh an | 1 | 0 | 0 | fav +8 | 3 |
| Rèn nghi thái | 1 | 0 | 0 | cha +7 | 4 |
| Làm việc | 1 | 0 | 12 | bạc +15 | 8 |
| Nghỉ ngơi | 1 | 0 | 0 | hp +20 | 5 |
| Dẹp tin đồn | 1 | 10 | 0 | suspicion −15 | 3 |
| Điều trị | 1 | 0 | 0 | hp +10 (chịu suy kiệt), giảm 1 lần điều trị còn lại | 5 |

`INITIAL_AP=10` là TEMP (default SQL cũng 10); công thức +10/ngày, trần 15, chu kỳ 300 giây, hệ số rủi ro và ngưỡng chỉ số là quy tắc đã chốt, không phải TEMP. `START_REIGN_YEAR=8` chỉ là cấu hình hiển thị.

## Việc người dùng phải làm

1. Nếu dự án Supabase mới: chạy `supabase/schema.sql` **một lần**. Nếu đã chạy từ M1, không chạy lại.
2. Chạy riêng `0002_character_ill_status.sql`, đợi transaction commit, rồi `0003_runtime_foundation.sql` trong SQL Editor. Có thể chạy lại hai migration này, không reset dữ liệu. Không gộp enum vào một transaction với 0003.
3. Điền `.env.local`/secret settings: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, **`SUPABASE_SERVICE_ROLE_KEY` chỉ phía server**. Không gửi khóa trong chat/PR. Bỏ `GAME_REPOSITORY=memory` khi dùng Supabase. HTTPS dùng cookie Secure; local HTTP đặt `COOKIE_SECURE=false`.
4. Trong Supabase Auth bật email/password và cấu hình email confirmation/Site URL cho tên miền thực tế. Chạy checklist bên dưới trước khi mở cho nhiều người dùng.

## Checklist kiểm thử tay trên Supabase thật

- [ ] Chạy 0002 rồi 0003, chạy lại; xác nhận chỉ một mùa ACTIVE, scenario đúng và mốc start không bị đổi.
- [ ] Đăng ký hai email khác nhau, xác nhận email nếu bật; kiểm tra hai hàng accounts có 3 lượt miễn phí, 0 Thiên Mệnh, 0 bạc chờ, 10 AP và ngày Việt Nam của ngày tạo.
- [ ] Đăng nhập/đăng xuất; URL `/`, `/setup`, ba API chặn người chưa đăng nhập. Chờ access token hết hạn, focus tab và kiểm tra refresh cookie; đăng xuất xong phiên cũ không đọc được API.
- [ ] Tạo/đổi/xác nhận; refresh và đăng nhập thiết bị thứ hai giữ nguyên nhánh, chỉ số, lượt đổi và số dư; ngân lượng chờ nhận chỉ chuyển một lần.
- [ ] Với anon key + JWT người A: đọc tài khoản/nhân vật người B trả rỗng; đọc Nghi Kỵ/result raw bị từ chối; UPDATE tài khoản/chỉ số và gọi RPC nhạy cảm bị từ chối. Kiểm tra bundle client không chứa service-role key.
- [ ] Đặt last_ap_grant_date ở hôm qua/ba ngày trước bằng quản trị trên tài khoản test; hai request đọc đồng thời chỉ cấp một lần, trần 15. Đọc lại, chỉnh giờ máy hay thiết bị mới không thêm AP.
- [ ] Gửi song song cùng UUID và hai UUID khác nhau; số AP/log/usage chính xác, không âm; cùng UUID sau các hành động khác trả đúng JSON kết quả cũ.
- [ ] Đạt dailyCap; không thể vượt, không trừ AP khi bị từ chối. Qua 00:00 UTC+7 reset usage, không theo ngày game.
- [ ] Tạo fixture test hp=12 rồi Làm việc: về 0, trọng bệnh, chỉ Điều trị; đủ năm lần mới ACTIVE. Thử ít bạc, ít AP, action_locked và mùa ENDED: không ghi log/trừ AP trái phép.
- [ ] Test cha 199/200/400, hp 19/20, rep 60/61, bạc 9/10, suspicionFloor và cảnh báo 80; log ghi đúng modifier, UI không lộ raw suspicion.
- [ ] Trên dữ liệu test tạo hơn 20 hành động hợp lệ qua nhiều ngày: pagination 20 dòng, không xem được log tài khoản khác; character_week_marks chỉ một hàng mỗi tuần.
- [ ] Đồng hồ: qua cuối tháng/năm, tuổi tăng; thay đồng hồ trình duyệt không làm lệch logic; focus đồng bộ lại. Không có nút tua thời gian.

## Lộ trình đề xuất Chặng 3–7

- **3:** hoàn thiện bảng phẩm cấp, điều kiện, khảo hạch và ghế dùng chung với giao dịch tranh chấp.
- **4:** kho sự kiện, lịch cốt truyện và quay sự kiện cá nhân tuần; dùng modifier đã ghi nhận.
- **5:** sức khỏe sâu, ngự y, tử vong, lưu lịch sử và trùng sinh không reset AP/hạn mức tài khoản.
- **6:** kết thúc mùa, điểm một đời cao nhất, xếp hạng, thưởng chống trùng và mùa mới.
- **7:** NPC/phe phái, tương tác nhiều người/PvP, hoàn thiện trải nghiệm và kiểm tra tải/bảo mật trước phát hành. Không đưa thanh toán vào scope hiện tại.

## Kết quả kiểm chứng trong môi trường phát triển

- `npm run lint`, `npm run typecheck` và `npm run build`: đạt.
- `npm test`: 39 kiểm tra đạt; gồm hồi quy M1, worldClock/AP/statEngine, tranh chấp/idempotency/cap ở InMemory, migration chạy lại cả trước/sau khi có dữ liệu, RPC/RLS và SupabaseGameRepository qua HTTP transport giả lập kết nối PGlite.
- Playwright: 9 kịch bản đạt trên InMemory (bốn nhánh, auth/thiết bị khác, lượt đổi, hạn mức, giả giờ client, CSRF, mất phản hồi và retry UUID, mobile/tab/empty state). Đã kiểm tra không tràn ngang ở 320/390/768/1280px.
- Không chạy migration lên dịch vụ bên ngoài; không có bằng chứng Supabase Auth/SMTP hoặc PostgreSQL từ xa hoạt động. Checklist Supabase thật ở trên vẫn cần thực hiện.
