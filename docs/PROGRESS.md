# Chặng 3B — Ghế và thăng phẩm

## Đã làm

- AGENTS.md mục 5.4 ghi chín quyết định; cấu hình đầy đủ 52 phẩm, pool Tam Thái chung và Thái úy riêng, NPC dự trữ mặc định 0. Test so sánh sức chứa trực tiếp với mục 5.1 và DB.
- Tái sử dụng seat_pools/rank_seats; thêm rank_pool_links, seat_applications, seat_assignments, seat_rounds, rank_history và seat_world_state qua migration 0005, không sửa schema/0002–0004. Ghế khởi đầu M1 còn sót được trả theo quyết định mới.
- APPLY/withdraw nguyên tử, UUID ledger, AP/cap theo tài khoản/ngày Việt Nam; một đơn WAITING/nhân vật. Pool không giới hạn thăng ngay; có giới hạn chờ phiên, nộp được cả khi đầy.
- Engine lazy xử lý tuần tự từng tuần bỏ lỡ, hết hạn/recheck/ranking/cấp ghế; điểm phân số chính xác, tie merit/thời gian/ID. Version CAS, khóa advisory và unique indexes bảo vệ ghế; các RPC hành động trước đó cùng thứ tự khóa.
- Thăng phẩm trả ghế cũ, cập nhật rank/tại vị, xóa khảo hạch, lưu lịch sử riêng và bộ R kế tiếp đơn điệu; cao nhất không sinh. Hàm releaseSeats và RPC idempotent phục vụ Chặng 5.
- Chuyển Nội cung cấp2–6 sang Hậu cung bằng hàm thuần/RPC service-only: guard, công thức fav, giữ công trạng/chỉ số, reset tại vị/khảo hạch, trả ghế/rút đơn, supersede điều kiện cũ và sinh điều kiện nhánh mới. Không có endpoint/nút kích hoạt.
- Hồ sơ có nộp/rút/trạng thái/lý do/countdown; Quan chế bốn nhánh chỉ số lượng, làm nổi bật phẩm; Nhật ký 20 dòng gồm thăng phẩm. Giữ phong cách và trạng thái tiếng Việt, không dùng any.
- RLS own applications; raw world/ghế/lịch sử chứa chỉ số ẩn chỉ server đọc. RPC nhạy cảm chỉ service_role. Bảng Quan chế và DTO không trả tên/ID/chỉ số/điểm tranh ghế của người khác.

## Chưa làm / giới hạn

**chưa kiểm chứng trên Supabase thật**: chưa có biến cấu hình dịch vụ trong môi trường. PGlite chạy SQL/RPC/RLS với auth/role stub và kiểm tra CAS/unique; chưa kiểm chứng Auth, PostgREST triển khai thật hoặc tranh chấp advisory lock trên PostgreSQL nhiều kết nối.

Không làm sự kiện/ngẫu nhiên, nhật ký toàn triều, NPC/chức danh cụ thể, tử vong/trùng sinh, xếp hạng, PvP. Chưa mở kích hoạt chuyển nhánh; Chặng 4 gọi backend sự kiện. Khóa thế giới và nạp snapshot riêng tư hiện ưu tiên tính nhất quán; batching/khóa nhỏ hơn để tối ưu tải lớn chưa nằm trong chặng này.

## Giả định / TODO(spec) Chặng 3B

1. Phiên bỏ lỡ dùng chỉ số hiện tại, nhưng kiểm tra thời gian/hiệu lực khảo hạch ở mốc phiên. rank_entered_at và lịch sử dùng giờ xử lý thật; không hồi tố tại vị hoặc dựng lại chỉ số quá khứ.
2. Phiên đầu tiên luôn sau thời điểm nộp; nộp đúng ranh giới vào tuần kế tiếp. Hết hạn ở createdAt + 28 ngày game, gồm cả request giữa hai phiên; xử lý phiên cũ trước khi hết hạn tại giờ hiện tại để không bỏ lỡ cơ hội thắng ở phiên trước hạn.
3. Pool một mục tiêu xét trước pool chia sẻ: Thái úy trước Tam Thái; trong nhóm sắp theo key cố định. Ghế được trả sau khi pool đã xét trong cùng tuần sẽ dùng từ phiên sau. Không xét lặp pool trong tuần.
4. APPLY chịu nhân quả tiêu AP. Nếu thăng ngay thì kiểm tra lại sau thay đổi chỉ số; không đạt rollback cả phí/đơn. Với WAITING, xét lại ở phiên như đặc tả. Rút đơn miễn phí được phép khi bệnh/khóa; không cộng merit, không đánh dấu hành động phát triển đầu tuần.
5. Phẩm khởi đầu không chiếm/bị giới hạn ghế; Quan chế vẫn hiển thị sức chứa tham chiếu và ghi chú. Nhân vật cũ giữ các bộ R; sinh bộ mới so với mọi R phát triển cùng nhánh trước đó. Nghi Kỵ dùng quy tắc sàn+5 của 3A, không ép đơn điệu giữa các tầng có khoảng chồng.
6. Chuyển nhánh thêm điều kiện ACTIVE/không khóa; không AP/merit mới. Hủy bộ Nội cung bằng superseded_at, giữ nguyên R lịch sử; bộ Hậu cung không so R nhánh cũ. Giữ sự bất khả thi phát sinh về sau theo 3A, không reroll.
7. SQL tin cậy policy/đề xuất từ backend service_role; client chỉ gửi code+UUID. RPC đối chiếu version, thời gian, AP/cap và ràng buộc ghế; không nhận dữ liệu client làm đề xuất. Khóa thế giới trước pool/account/character theo thứ tự ổn định, retry khi CAS cũ.
8. R tạm legacy có thể vượt cả khoảng v1 kế tiếp (fav60 Mỹ nhân M1 so với Lương nhân v1 tối đa55). Giữ nguyên R/bảng; thăng ngay rollback, phiên hữu hạn REJECTED riêng đơn mâu thuẫn và tiếp tục người khác, không làm kẹt thế giới. TODO(spec) cần chốt xử lý dữ liệu cũ.
9. Các giả định 3A/M2 phía dưới còn hiệu lực: cộng hưởng chồng tầng; suy kiệt; năm lần Điều trị; sàn bão hòa100; EXAM trước chi phí, fail giữ pass; HP/bạc không xét thăng phẩm. Mục lịch sử mô tả trạng thái tại thời điểm chặng đó, không phủ định tính năng 3B.

## Danh sách số liệu TEMP Chặng 3B

| Config trong src/config/balance.ts | Giá trị |
| --- | ---: |
| APPLY_AP_COST | 1 AP |
| APPLY_DAILY_CAP | 2 / tài khoản / ngày thực UTC+7 |
| APPLICATION_EXPIRY_GAME_DAYS | 28 ngày game |

Rút miễn phí (0 AP), không thưởng merit. Chu kỳ 7 ngày game và sức chứa theo AGENTS là quy tắc đã chốt, không phải TEMP. RESERVED_SEATS_FOR_NPC theo pool trong seats.ts mặc định0, chưa gán NPC. TEMP 3A/M2 giữ nguyên bảng lịch sử bên dưới.

## Việc người dùng phải làm

1. Đã ở 3A: chạy **supabase/migrations/0005_seats_and_promotion.sql** trong SQL Editor trước code này; có thể chạy lại để kiểm tra. Không chạy lại 0002–0004 sau 0005 vì sẽ thay RPC cũ.
2. Dự án mới: schema.sql một lần → 0002 riêng → 0003 → 0004 → 0005. Không sửa file đã chạy.
3. Giữ đủ NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY và SUPABASE_SERVICE_ROLE_KEY (chỉ server). Không cần env/cron mới; xét duyệt lazy. Không gửi khóa qua chat/PR.
4. Chạy checklist dưới đây trên dự án test trước triển khai thật. Không có migration nào đã được chạy lên Supabase bên ngoài bởi phiên làm việc này.

## Checklist kiểm thử tay Supabase thật Chặng 3B

- [ ] Backup dữ liệu test; chạy 0005 hai lần, AP/mùa/R/đơn/ghế không reset; kiểm tra các link/pool/slot đúng AGENTS 5.1. Tam Thái một pool3, Thái úy riêng1. Phẩm khởi đầu không giữ ghế.
- [ ] Hai tài khoản có ba điều kiện, tại vị, merit, pass còn hiệu lực: gửi APPLY cả khi pool đầy; 1 AP, cap2/ngày tài khoản. Gửi song song UUID giống/khác trên **hai kết nối thật**; AP/usage/log chính xác và tối đa một WAITING. Mất phản hồi rồi retry trả cùng kết quả cũ.
- [ ] Rút không tốn AP, có thể nộp lại khi chưa đạt cap; ngày UTC+7 mới reset cap. Bệnh nặng/khóa/tra xét/không đủ điều kiện/hết AP/cao nhất bị từ chối không mất phí.
- [ ] Nội cung1→2 hoặc Hậu cung0→14 thăng ngay cùng giao dịch. Finite luôn WAITING dù trống. Reload/đổi thiết bị giữ đơn và R.
- [ ] Fixture hai đơn một ghế: vượt ngưỡng hơn thắng; hòa theo merit, thời gian, ID. Cả Văn/Võ cùng chia đúng3 Tam Thái; Thái úy chỉ Võ, NPC dự trữ không bị chiếm. Tab chỉ số ghế không có danh tính/điểm.
- [ ] Gọi nhiều request snapshot/actions/Quan chế ở ranh giới tuần: chỉ một kết quả cho mỗi pool/round, không cấp trùng; ghế cũ trả ngay. Mô phỏng nhiều tuần không có request, kiểm tra phiên tăng dần và không xét đơn trước khi nộp.
- [ ] Giảm chỉ số, bật tra xét/bệnh/khóa hoặc hết hiệu lực pass trước phiên: REJECTED kèm lý do. Thua ghế vẫn WAITING, hết hạn đúng28 ngày (kể cả giữa phiên). API không cho đổi giờ server.
- [ ] Thăng phẩm giữ merit, reset tại vị/khảo hạch, bộ R mới đúng nhánh/monotonic; cao nhất không có mục tiêu. Nhật ký riêng có một dòng thăng phẩm, pagination20 và không đọc được tài khoản khác.
- [ ] Backend test gọi release_seats hai lần: không lỗi, một lần trả ghế. Service-only convert inner2–6: guard cha150/int100/susp45; fav100→60,300→120; cấp2–4→Mỹ nhân,5–6→Lương nhân. Giữ stats/merit, reset tại vị/exam, trả ghế/rút đơn, khóa R cũ và sinh R Hậu cung. Không có route/nút công khai.
- [ ] Với anon/JWT A: không đọc đơn B, raw assignments/world/rank_history; không INSERT/UPDATE hoặc EXECUTE sensitive RPC/alias3A. Kiểm tra response/DOM/bundle không có raw Nghi Kỵ/sàn/service key.

## Lộ trình Chặng 3–7 cập nhật

- **3A/3B:** điều kiện, khảo hạch, ghế và thực thi thăng phẩm đã cài đặt; còn checklist Supabase thật.
- **4:** sự kiện cá nhân/lịch cốt truyện, nhật ký công khai toàn triều và sự kiện kích hoạt chuyển nhánh.
- **5:** Ngự y, tử vong/trùng sinh, gọi releaseSeats, bảo toàn AP/hạn mức theo tài khoản.
- **6:** NPC và chức danh cụ thể, dùng RESERVED_SEATS_FOR_NPC; các phần tổng kết mùa/xếp hạng theo kế hoạch được chốt sau.
- **7:** hoàn thiện tương tác sâu/PvP, trải nghiệm và kiểm thử tải/bảo mật; không thêm vào 3B.

## Kết quả kiểm chứng Chặng 3B

- `npm run lint`, `npm run typecheck`, `npm run build`: đạt.
- `npm test`: 77 kiểm tra đạt (58 hồi quy M1/M2/3A + 19 mới), gồm engine thuần và thực thi migration/RPC/RLS trên PGlite, SupabaseGameRepository qua HTTP transport nối PGlite.
- 11 Playwright đạt trên InMemory: bốn nhánh, auth/retry/thiết bị, mobile/desktop, bảng ghế bốn nhánh và APPLY bị khóa/từ chối không mất AP. Không mở test endpoint hoặc chức năng tua giờ server.
- Kiểm tra số ghế trực tiếp từ AGENTS 5.1 và SQL, CAS hai đề xuất cùng phiên bản, cùng UUID, cap2, thăng ngay/trả ghế, chuyển nhánh/supersede, không lộ Nghi Kỵ; có test cùng mili giây rút/nộp lại và xung đột R legacy.
- **chưa kiểm chứng trên Supabase thật**; không chạy migration bên ngoài. Checklist nhiều kết nối/triển khai ở trên còn cần thực hiện.

---

# Lịch sử Chặng 3A và Chặng 2

# Chặng 3A — Điều kiện thăng phẩm

## Đã làm

- Cập nhật AGENTS.md 5.2/5.3 trước khi viết code, theo quyết định bổ sung: chỉ C1/C2/Nghi Kỵ 40/40/20; không có HP, bạc hoặc điều kiện nền; thứ tự tranh ghế chỉ được ghi đặc tả cho 3B.
- Bảng chính thức v1 trong `src/config/promotionBenchmarks.ts`: 15 phẩm Văn giai, 14 phẩm Võ giai, 15 hàng Hậu cung gồm Cung tuyển, 8 hàng Nội cung; giữ nguyên 8 ID/tên M1 và bổ sung phần còn thiếu. D tính từ B, RNG tiêm được, kiểm tra tầng/ánh xạ/đơn điệu khi nạp. Phẩm cao nhất không có điều kiện tiếp.
- Phẩm khởi đầu chuẩn không nâng chỉ số; trường hợp kịch bản chọn phẩm cao hơn chỉ nâng int/rep/fav/cha lên cận dưới B-D. M1 không có cơ chế xuất thân tự bỏ qua phẩm, nên không thêm đường tắt đó.
- Đúng ba điều kiện v1, gắn character/target, lưu `table_version` và `thresholds` (R cũng ở conditions.value); trigger khóa UPDATE. Không có API reroll. Nhân vật cũ giữ nguyên R, đánh dấu legacy bằng metadata, không sinh lại.
- Nghi Kỵ lấy khoảng theo tầng mục tiêu; lúc sinh nâng ít nhất sàn+5 (tối đa 100). Sàn vượt R về sau báo unreachable; chỉ Nghi Kỵ cao thì gợi ý Dẹp tin đồn. DTO loại current của Nghi Kỵ/sàn, chỉ gửi ngưỡng/trạng thái/hint.
- Tại vị theo elapsed ngày game từ rank_entered_at; công trạng tích lũy trong kiếp và hạn cộng theo tài khoản/ngày Việt Nam; EXAM 2 AP/3 HP, cap2, xác suất theo chỉ số trước trả chi phí, ghi kết quả idempotent và hiệu lực 60 ngày game.
- RPC khóa hàng/revision của Chặng 2 được mở rộng để ghi công trạng, usage và khảo hạch cùng giao dịch; SQL kiểm tra lại điều kiện dựa trên dữ liệu thật. Các giá trị TEMP truyền từ cấu hình tin cậy phía server giống ranh giới action costs Chặng 2.
- Hàm thuần `evaluatePromotionEligibility` trả kết quả từng điều kiện, tại vị, công trạng, khảo hạch, tra xét; `seatAvailable='UNKNOWN'`. Hồ sơ desktop/mobile hiển thị tiến trình/nút Khảo hạch và lý do khóa; đồng bộ lại vào mỗi ngày game. Quan chế vẫn “Sắp ra mắt”.

## Chưa làm / giới hạn

Không có API nộp đơn, đổi rank, cấp/nhả/tranh ghế, phiên xét duyệt hoặc chuyển nhánh; không thêm sự kiện, NPC, tử vong/trùng sinh hay xếp hạng. `eligibleToApply` chỉ là cờ điều kiện cá nhân, **chưa xét ghế**, không phải một thao tác nộp đơn.

**chưa kiểm chứng trên Supabase thật**: chưa có biến cấu hình dịch vụ trong môi trường hiện tại. PGlite kiểm tra migration/RPC, không thay thế Auth, quyền triển khai và tranh chấp khóa từ PostgreSQL từ xa.

## Giả định / TODO(spec) Chặng 3A

1. Đơn điệu nghiêm ngặt áp dụng giữa các **phẩm mục tiêu**. Không so hàng khởi đầu (không sinh R) với mục tiêu đầu tiên: số liệu đã chốt Cung tuyển/Mỹ nhân chạm biên rep=20, int=40. Giữ bảng nguyên vẹn, không tự chỉnh số để qua kiểm tra. Tất cả cặp mục tiêu kế tiếp vẫn được kiểm tra tĩnh.
2. Bộ legacy chứa HP/bạc được giữ nguyên trong DB; hai dòng lịch sử đó hiển thị “ngừng xét”, không chặn khảo hạch/eligible. Đây là cách tuân thủ quyết định bổ sung “không tham gia ở bất kỳ dạng nào” mà không sửa R của nhân vật cũ. Không áp buffer sàn+5 hồi tố lên điều kiện legacy.
3. Thời gian tại vị là floor của thời gian thực đã trôi /300 giây, không cộng một ngày chỉ vì đi qua ranh giới lịch. `PromotionWorldTime` có mẫu serverNow/seasonStart; dùng `promotionWorldTime()` để gọi evaluator. Hệ số nhánh được nhân theo tầng hiện tại; nếu kết quả lẻ, ceil lên ngày game nguyên.
4. Khảo hạch có hiệu lực trong `[passedGameDay, passedGameDay+60)`; hết hạn đúng ngày +60. Cho phép khảo hạch lại khi đã đạt điều kiện; thành công làm mới mốc, thất bại không xóa lần đạt cũ và không thay R.
5. EXAM không cộng công trạng. Cả thành công/thất bại chịu quy tắc nhân quả chung của M2 (quyền lớn bạc cạn, trọng bệnh nếu HP về 0); không thêm hình phạt riêng khi trượt. Xác suất và modifier suy kiệt dùng HP trước khi trả 3 HP.
6. Sàn tăng vượt R thì chỉ cảnh báo bất khả thi, chưa có cách chữa/reroll; cần quyết định nội dung ở chặng sau (TODO(spec)). Chưa làm sự kiện tra xét; dùng cờ suspicion>=80 để chặn khảo hạch.
7. Chưa có đời mới trong 3A; merit khởi tạo 0 cho mỗi Character mới, map/table hạn mức gắn account/date nên không làm mới nếu có nhiều đời sau này. Dữ liệu cũ bắt đầu merit0 và rank_entered_at=confirmed_at, không suy diễn công trạng từ log lịch sử.
8. Seed đầy đủ bảng ranks chỉ cập nhật danh mục/benchmark/next_rank_id. Giữ metadata ghế M1; không tạo pool/ghế hay tự thay rank của nhân vật. Các migration 0001–0003 không bị sửa.
9. Hồi quy M1/M2 vẫn chạy. Chỉ cập nhật kỳ vọng cũ mâu thuẫn trực tiếp với quyết định mới (40/40/8/8/4, bảng tạm, ngưỡng nhập phẩm chuẩn); không bỏ assertion hoặc vô hiệu hóa test.

## Số liệu TEMP Chặng 3A

Trong `src/config/balance.ts`, tên hành động/meritGain trong `src/config/actions.ts`:

- Tại vị theo tầng **hiện tại**: 30 / 60 / 120 / 240 / 360 ngày game. `BRANCH_TENURE_MULTIPLIER`: cả bốn nhánh =1.0.
- Công trạng yêu cầu theo tầng **mục tiêu**: 10 / 30 / 70 / 150 / 300. Hạn cộng theo account/ngày thực: 8; phần vượt bỏ, hành động vẫn diễn ra.
- Merit mỗi hành động: STUDY1, SOCIALIZE1, AUDIENCE2, ETIQUETTE1, WORK2, REST0, RUMOR0, TREAT0, EXAM0.
- EXAM: 2 AP, 3 HP, cap2; hiệu lực 60 ngày game. `p=clamp(.35+int/2000+hp/400,.20,.95)`; hp<20 trừ .30, min .05.
- Bảng benchmark v1 và khoảng Nghi Kỵ là **chính thức**, không phải TEMP. Không còn config ngưỡng HP/bạc hoặc cờ baseline.

## Việc người dùng phải làm

1. Dự án M2 đã có schema/0002/0003: chỉ chạy `supabase/migrations/0004_promotion_requirements.sql` trong SQL Editor. File có begin/commit, chạy lại an toàn; giữ nguyên R, AP, merit, log và chứng nhận khảo hạch hiện có. Không chạy lại 0003 sau 0004 vì sẽ thay thế RPC bằng phiên bản cũ.
2. Dự án mới: schema.sql một lần → 0002 riêng để commit enum → 0003 → 0004. Không sửa các file đã chạy.
3. Giữ ba biến Supabase của Chặng 2 (URL, anon key, service-role key chỉ server), triển khai code tương ứng với migration. Không đặt service key vào NEXT_PUBLIC hoặc gửi trong chat.

## Checklist Supabase thật Chặng 3A

- [ ] Backup, chạy 0004 hai lần. Kiểm tra 52 ranks đúng tên/nhánh/benchmark/next; R của nhân vật cũ không đổi, table_version=legacy; không có ghế hoặc rank nhân vật mới được cấp.
- [ ] Xác nhận nhân vật mới cả bốn nhánh: ba dòng v1, A/B đúng nhánh, C không có HP/bạc; thresholds khớp conditions.value. Võ giai vẫn giữ phân phối khởi đầu cũ.
- [ ] Reload, đăng xuất, đăng nhập thiết bị khác và trượt khảo hạch không thay R. UPDATE điều kiện bị từ chối, không có endpoint reroll.
- [ ] Fixture sàn cao: sinh R tối thiểu sàn+5, trần100; tăng sàn sau sinh vượt R thì UI báo unreachable. Nếu chỉ suspicion cao thì có gợi ý dẹp tin đồn. Kiểm tra response/bundle/DOM không chứa raw suspicion hoặc floor.
- [ ] Test tại vị 29/30 ngày game và mốc lẻ; công trạng 9/10, tra xét79/80. Tầng hiện tại và mục tiêu khác nhau phải lấy đúng bảng TEMP.
- [ ] Dùng action cộng merit đến8, kiểm tra credit một phần và credit0, hành động vẫn trừ AP bình thường; qua 00:00 VN reset hạn, thay nhân vật không reset account cap.
- [ ] EXAM khi thiếu điều kiện bị từ chối không tiêu AP/HP/cap; đủ điều kiện thì 2 AP/3 HP/cap2, hp19/20 dùng đúng p. Thử đồng thời UUID giống/khác, stale revision và mất phản hồi; cùng UUID trả nguyên kết quả cũ, không quay lại RNG hoặc cộng merit.
- [ ] Pass ghi target/gameDay, trượt giữ chứng nhận cũ, hết hạn đúng +60 ngày. Dù đạt hết, không có nút/API nộp đơn/thăng phẩm.
- [ ] JWT account khác không đọc merit_daily_usage của người chơi; không ghi trực tiếp merit/exam/R hoặc gọi RPC nhạy cảm. Raw JSON chứa Nghi Kỵ vẫn không được cấp SELECT.

## Lộ trình cập nhật

- **3B:** nộp đơn, phiên xét duyệt, ghế và giao dịch khóa; tie-break tổng mức vượt ngưỡng chuẩn hóa → merit → thời điểm nộp; chuyển nhánh Nội cung/Hậu cung nếu được chốt riêng.
- **4–7:** giữ lộ trình sự kiện → sinh tử/trùng sinh → tổng kết mùa/xếp hạng → tương tác sâu như phần lịch sử bên dưới; không kéo sang 3A.

## Kết quả kiểm chứng Chặng 3A

- `npm run lint`, `npm run typecheck`, `npm run build`: đạt.
- `npm test`: 58 kiểm tra đạt, gồm hồi quy M1/M2 và bộ kiểm tra mới. Những kỳ vọng cũ về trọng số/benchmark tạm được cập nhật theo quyết định mới, không tắt test.
- 10 Playwright đạt trên InMemory, gồm tiến trình desktop/mobile, EXAM bị khóa khi chưa đủ điều kiện, công trạng và điều kiện không đổi khi reload/đăng nhập thiết bị khác.
- Kiểm tra 10.000 mẫu có seed **cho mỗi nhánh**, dung sai 2 điểm phần trăm cho C; không sinh HP/bạc. PGlite thực thi 0004 nhiều lần trước/sau EXAM, kiểm tra ledger, revision, daily cap, RLS và bất biến R.
- **chưa kiểm chứng trên Supabase thật**; chưa chạy migration lên dịch vụ bên ngoài. Cần hoàn thành checklist phía trên sau khi cung cấp cấu hình dịch vụ.

---

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
11. Chặng 2 dùng điểm chuẩn tạm M1; Chặng 3A đã thay chúng bằng bảng chính thức v1, vẫn chưa thực hiện thăng phẩm. Dữ liệu tiền tệ dùng số nguyên an toàn JS (SQL đồng bộ giới hạn kỹ thuật 2^53−1), không đặt trần gameplay mới.

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

## Kết quả kiểm chứng Chặng 2 (lịch sử)

- `npm run lint`, `npm run typecheck` và `npm run build`: đạt.
- `npm test`: 39 kiểm tra đạt; gồm hồi quy M1, worldClock/AP/statEngine, tranh chấp/idempotency/cap ở InMemory, migration chạy lại cả trước/sau khi có dữ liệu, RPC/RLS và SupabaseGameRepository qua HTTP transport giả lập kết nối PGlite.
- Playwright: 9 kịch bản đạt trên InMemory (bốn nhánh, auth/thiết bị khác, lượt đổi, hạn mức, giả giờ client, CSRF, mất phản hồi và retry UUID, mobile/tab/empty state). Đã kiểm tra không tràn ngang ở 320/390/768/1280px.
- Không chạy migration lên dịch vụ bên ngoài; không có bằng chứng Supabase Auth/SMTP hoặc PostgreSQL từ xa hoạt động. Checklist Supabase thật ở trên vẫn cần thực hiện.
