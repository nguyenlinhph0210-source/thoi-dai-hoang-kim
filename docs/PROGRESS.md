# H1.1 — Hợp nhất giao diện với cảnh 3D

## Đã làm

- Bộ giao diện chung tại src/ui: token son/vàng/đen/gỗ/giấy dó, nền gradient nhẹ, khung hai nét/góc chạm,
  hoa văn SVG, nút ấn/gỗ, bộ biểu tượng đèn/quạt/ấn/trâm/ngọc. Login, setup, Hồ sơ/Y phục/Cung viện,
  Sân khấu, Quan chế, nhật ký, loading/lỗi/dialog dùng cùng palette/font/khung.
- Noto Serif tiêu đề, Be Vietnam Pro nội dung;9 tệp WOFF2 tự host (~324KiB), subset vietnamese/latin/latin-ext,
  OFL-1.1 đi kèm nguồn trong public/fonts/CREDITS.md. Không CDN lúc build/chơi. Test NFC toàn bộ src.
- Cảnh HAREM phủ nền, giữ renderer khi chuyển tab; mobile có cuộn thư kéo ba mức và nút bàn phím,
  thu gọn để lộ>=60% chiều cao ở390×844 và390×720. Desktop trái/phải là khung phủ cảnh, nội dung tự cuộn.
  Có vignette/viền gỗ, loading đồng phong cách; HTML vẫn giữ mọi chữ/nút và game chơi đầy đủ ở2D.
- Cảnh procedural có mái cong extrude, lattice giấy dó sáng, tiền/trung/hậu cảnh, cột/xà son, rèm châu,
  vân gỗ canvas cache và12 hạt ở mức không phải Thấp. Mỗi style decor đổi hình; cấp2 thảm,3 đai cột,
  4 rèm,5 đôn/cây. Giữ pipeline GLB G1 tương thích nhưng không thêm model/VRM ngoài.
- Hình nhân lathe/capsule/mesh lớp áo-vạt-tay-thắt lưng, tóc/búi/mặt, trâm/jade/hoa tai; màu/hoa văn
  theo món. Camera chân dung mặc định, Toàn cảnh/Cận cảnh, orbit/zoom giới hạn. Texture128 ở Thấp,
  256 ở hai mức còn lại, cache theo mã/palette/resolution; không vẽ texture mỗi frame, có cleanup Fiber root.
- Tất cả30 gear và18 decor có minh họa SVG/viền tầng, ô đang mặc cũng có hình. Chạm hình thử món chưa mua
  hoặc chưa đủ phẩm, nhãn Đang thử và Mua/Mặc/Bày; Thoát thử hoặc rời Hồ sơ về hình trang bị thật.
  Mobile tự thu gọn khi chạm hình thử và giữ nút Mua/Mặc/Bày trong vùng nhìn thấy. State thử chỉ là bản sao hiển thị, không sửa equipment/ownership/chỉ số, không gửi request ghi.
  Nền2D dùng hình nhân SVG phân lớp và bày biện có hình, cùng mã/màu/hoa văn/thử đồ.
- Chỉ thay presentation, không đổi src/lib, src/config, src/types, RPC, bảng, migration hay dependency.
  Toàn bộ21 kịch bản E2E cũ đạt; thêm3 kiểm tra cuộn thư/ảnh/thử đồ/3D→2D. Test mới từng phát hiện
  pointer capture giữ click nút và kéo chữ native hủy lần kéo lên; handle chỉ capture vùng kéo, chặn kéo chữ, có hồi quy cả hai hướng.
- Ảnh trước/sau đủ6 màn hình ở390×844 và1440×900, thêm ảnh thử đồ/2D; chỉ mục và script chụp lại ở
  docs/screenshots/README.md, scripts/capture-interface.cjs. Không dùng fixture quyền sở hữu cho ảnh so sánh.

## Chưa làm / giới hạn

Không thay luật game/DB, không migration mới; không G2 rig/animation phức tạp, GLB/VRM ngoài, nhiều cảnh,
NPC/kịch bản. Nhánh ngoài HAREM giữ nền minh họa nhưng nhận cùng bộ giao diện. Chưa đo điện thoại thật,
pin/nhiệt/GPU memory, Safari/iOS hoặc fixture nén Draco/Meshopt/KTX2 thật. **chưa kiểm chứng trên Supabase thật**;
H1.1 không thêm đường ghi/backend, kiểm tra nghiệp vụ/RPC hồi quy vẫn dùng InMemory/PGlite như trước.

## Giả định / TODO(spec)

1. Bố cục H1.1 thay vùng cảnh45svh/ba cột tách ô của G1. Cảnh lớn chung sau các tab, stage mặc định thu gọn,
   tab khác mở nửa, nội dung cuộn riêng; có thể kéo hoặc dùng nút để mở đầy. Không lưu mức cuộn thư vào DB.
2. Thử món chưa sở hữu/chưa đủ phẩm chỉ để xem. Mua/Mặc/Bày vẫn dùng API/giá/guard H1, không auto mua/mặc
   khi chạm hình; không tăng hiệu ứng/điều kiện thăng phẩm vì đang thử. Chuyển tab chính/thoát/đăng xuất hủy thử.
3. Art là cách điệu cung đình Việt Nam hư cấu, không tuyên bố phục dựng phẩm phục/kiến trúc lịch sử.
   Các biến thể hình/hoa văn được sinh từ code/param hiện có; không thêm cột art hay đổi mã catalog đã lưu.
   Noto Serif mang nét thư tịch, ưu tiên đủ dấu/dễ đọc thay vì font thư pháp thiếu chữ Việt.
4. TODO(spec): thở/hạt chỉ chạy khi G1 còn vẽ trong warm-up hoặc sau tương tác; không duy trì loop vô hạn để
   vừa thỏa demand đứng yên vừa tiết kiệm pin. Reduced-motion tắt chuyển động, Thấp bỏ hạt/rèm.
5. Camera có chân dung ban đầu, hai nút Toàn cảnh/Cận cảnh;2D đổi tỉ lệ hình tương ứng. Không lưu camera vào DB.
   Token/theme áp dụng mọi nhánh, cảnh mẫu/hình nhân vẫn chỉ HAREM; không mở rộng G3.
6. Ngân sách H1.1 giảm còn40.000 tam giác toàn cảnh; giữ các mức DPR/shadow/error boundary/codec cũ.
   Cache giữ tối đa48 mục không dùng, giữ texture còn tham chiếu tới khi root unmount; tránh dispose cache đang dùng.
7. Ảnh trước/sau là hai tài khoản/nhân vật Memory độc lập, nên tuổi/chỉ số gốc có thể khác do RNG cũ.
   Bộ đo tối đa chỉ thay DTO hiển thị trong browser test (viện5, style2, ba món), không grant đồ/thăng phẩm ở server.
   Không có seed/debug endpoint production. Debug metrics chỉ development như G1.

## Số liệu và kiểm chứng

- lint, typecheck, build, check:models đạt; **142 test logic/SQL đạt**, gồm5 test UI mới (NFC, toàn catalog có SVG,
  bản sao thử đồ không đổi dữ liệu, ba mức kéo, font tự host). **24 Playwright đạt** gồm21 luồng cũ và3 H1.1.
  Không có chỉnh sửa kỳ vọng nghiệp vụ cũ. Thử mất WebGL/lỗi3D, chunk login/2D, giao dịch H1 cũ vẫn đạt.
- Đo riêng trên Chromium156/Linux/ANGLE SwiftShader, viewport390×844/DPR1/reduced-motion; dev build đã biên dịch,
  không throttle mạng/CPU, một cửa sổ2s sau mở mức, fixture hiển thị tối đa (không phải chỉ số người chơi thật):

| Mức chọn | Tam giác hình học toàn cảnh | Tam giác vẽ/frame | Draw calls/frame | FPS cửa sổ đầu |
| --- | ---: | ---: | ---: | ---: |
| Thấp | 6.040 | 4.056 | 96 | 29,7 |
| Trung bình | 8.468 | 6.452 | 98 | 22,9 |
| Cao | 10.144 | 13.508 gồm shadow pass | 193 | 10,7 |

Tối đa10.144<40.000. FPS là một lượt quan sát GPU phần mềm, không benchmark thống kê hay cam kết điện thoại.
Thấp sau warm-up37,3FPS; Trung bình28,0FPS và vẫn ở Trung bình. Cao tự hạ xuống Trung bình,
lần lấy mẫu sau19,0FPS ở **Trung bình**, không gán số này cho Cao. Sau chọn Thấp và chờ7,2s,
hai mẫu idle cách2,3s giữ nguyên frame counter119; không diễn giải FPS cached30,4 là FPS idle.
Dev điều hướng lại tới cảnh sẵn sàng đo3.041ms; không coi là tải production/mạng thật.
Production build/InMemory, context mới,3D Thấp, từ nhấn Xác nhận nhập kinh tới hotspot sẵn sàng: mobile2.066ms, desktop3.329ms (localhost, không throttle). Không phải tải qua mạng điện thoại hay cam kết thời gian.


- Renderer production: **277,3KiB gzip / 3 chunk**,1.015,3KiB raw, đo bằng measure:3d sau build. Không cộng shared React/Next, font hoặc GLB/decoder
  chưa phân phối vào số chunk renderer. Font self-host được tải riêng theo unicode-range, tổng9 tệp khoảng324KiB.
- Không thêm số TEMP nghiệp vụ. Camera/độ rộng/texture/chi tiết là tham số đồ họa; số cân bằng H1 giữ nguyên.

## Việc người dùng phải làm

1. Merge/triển khai code như thường; **không chạy migration mới, không chạy lại migration cũ**, không env/npm dependency mới.
   Backend cần đã ở H1 như bối cảnh; lịch sử migration0008 vẫn giữ nguyên.
2. Xem PR/preview và gallery trước/sau; vào HAREM → Hồ sơ → Y phục/Cung viện, chạm ảnh thử rồi thoát; kiểm dữ liệu
   thực chỉ đổi khi bấm Mua/Mặc/Bày. Kiểm ba mức cuộn thư bằng kéo/nút và camera Toàn cảnh/Cận cảnh.
3. Trước phát hành thử Android/iOS tầm trung, màn hình ngắn/dài, gesture, 2D, context loss, reduced-motion,
   chuyển tab/app, pin/nhiệt/mạng chậm; login/2D không tải chunk3D, font không gọi CDN, dấu Việt đầy đủ/NFC.
   Hiệu năng SwiftShader không thay thế kiểm chứng điện thoại. Supabase thật dùng checklist H1 cũ nếu triển khai backend.

---

# H1 — Y phục, cung viện, phong hiệu Hậu cung

## Đã làm

- Danh mục có kiểu/kiểm tra khi nạp trong `src/content/harem.ts`:12 y phục (>=2 mỗi tầng),10 trâm,8 trang sức,18 kiểu/sáu ô bày biện,5 cấp viện và9 chữ phong hiệu. Branches/fictional:true/SAMPLE_DRAFT; không tên người thật/NPC, ý nghĩa phong hiệu chỉ từ vựng, không bịa điển tích.
- Engine mua/mặc/tháo/nâng cấp/mua decor/bày: sở hữu theo kiếp, một món/ô, minTier theo phẩm hiện tại; giá server tra từ config. Không AP, không đổi chỉ số gốc khi sửa soạn; account cap10/ngày UTC+7 gồm gear+decor, không làm mới khi clear/đổi nhân vật.
- Hiệu ứng trang bị cộng dồn trần25% mỗi AUDIENCE/ETIQUETTE, cung viện tăng REST/SOCIALIZE trần40%/20%. Tính trên thưởng dương qua engine cũ, sau cộng hưởng và trước clamp; floor một lần sau toàn bộ hệ số/suy kiệt. Thăng phẩm vẫn đánh giá base stats. Log có cosmeticEffects.
- Phong hiệu ban trong engine promote và RPC chốt ghế cùng transaction: đúng phẩm mốc lần đầu, loại chữ hiện tại, giữ thứ tự lịch sử, không API reroll. Thiếu grant/ghi title lỗi thì rollback cả rank/AP; test tiêm lỗi xác nhận. Hiển thị danh xưng ở Hồ sơ, Quan chế của chính mình, nhật ký và bảng tên cảnh.
- Migration0008 transactional/rerunnable, năm bảng RLS ngay, RPC/alias nhạy cảm chỉ service_role; không đổi schema/migration cũ. Khóa/CAS cùng thế giới 3B/4A; đổi đồ làm snapshot thưởng cũ stale. SDK Supabase được thử qua transport nối PGlite, cùng ledger idempotent dùng chung action_requests; không tách thanh toán/ghi lịch sử.
- Hồ sơ có thanh phụ Thân phận/Y phục/Cung viện, giữ bốn tab mobile; mua/trang bị có khóa và giải thích; retry lưu UUID+lệnh+revision theo tài khoản/kiếp. Nhánh khác placeholder Sắp ra mắt. Đọc lỗi dữ liệu H1 vẫn dựng hồ sơ + cảnh báo/log đã lọc, ghi không nuốt lỗi.
- G1 có hình nhân áo kín low-poly, hoa văn/màu theo đồ đang mặc, trâm khối nhỏ và điểm trang sức; sáu kiểu bày biện/cấp viện hiện trên scene. GLB tùy chọn được tint qua material clone, không sửa cache chung. 2D có thẻ danh xưng/đồ/cấp/kiểu, chơi đầy đủ.
- `clearCharacterCosmetics`/RPC nội bộ xóa đồ, trang bị, viện, lịch sử phong hiệu của kiếp; gọi lại không đổi revision nếu đã trống. Giữ tài khoản, hạn mua, ledger và nhật ký đã ghi. Chặng5 mới gọi khi kết thúc kiếp, không endpoint clear/tử vong cho client.

## Chưa làm / giới hạn

G2 nhân vật/trang phục chi tiết, G3 nhiều cảnh, NPC, kịch bản, hệ thống thỉnh an mới, thuộc hạ, yến tiệc, tặng quà, tiền thật/cửa hàng trả phí không thuộc H1. Nhãn AUDIENCE/Thỉnh an mẫu có sẵn của Chặng2 giữ nguyên. Chưa đo trên điện thoại thật, pin/nhiệt/GPU memory. Loader nén G1 vẫn chưa có fixture Draco/Meshopt/KTX2 nén thật.

**chưa kiểm chứng trên Supabase thật**: ba biến Supabase chưa có trong môi trường. Đã chạy migration/RPC/RLS bằng PGlite với auth/role stub, kể cả SDK qua transport giả lập; không coi đó là PostgREST/pg-safeupdate/Auth thật hoặc tranh chấp PostgreSQL nhiều kết nối.

## Giả định / TODO(spec)

1. H1 chỉ HAREM. Các mốc ban phong chỉ khi thăng vào mốc sau triển khai; không suy diễn/ban bù lịch sử cũ hoặc vì khởi đầu/chuyển nhánh. Vào Hậu cung mới có bộ đồ trống/viện1; không mang đồ của kiếp trước.
2. “Không trùng phong hiệu đang có” nghĩa không trùng chữ hiện tại của chính nhân vật, không độc quyền toàn máy chủ; chữ lịch sử có thể xuất hiện lại. Có tối đa một grant mỗi character/milestone, thứ tự giữ bền vững, effect:null.
3. Trang bị chỉ tăng thưởng của mã AUDIENCE/ETIQUETTE, không áp cho lựa chọn sự kiện4A có type AUDIENCE. Cộng hưởng → phần trăm → suy kiệt, floor một lần rồi clamp, giữ quy tắc nhân quả cũ. Tăng kiếm được từ hành động sau đó trở thành base stats bình thường; việc mặc/tháo không tự đổi chúng.
4. Sửa soạn miễn AP nên không kích hoạt first-week mark/RNG, merit hoặc “quyền lớn bạc cạn” chỉ do mua. Bệnh nặng/khóa/mùa kết thúc chặn mọi sửa soạn, vẫn đọc được; khớp quy tắc chỉ Điều trị khi ill.
5. Cap10 tính cả mua đồ và mua decor. Nâng cấp/mặc/tháo/bày miễn phí lượt mua. Mua không tự mặc/bày; phải chọn thao tác tương ứng. Kiểu0 miễn phí/sở hữu mặc định, style1 minTier1/giá25, style2 minTier2/giá80 TEMP.
6. Mốc/phần trăm/giá do server gửi từ config trong proposal service_role. SQL kiểm trạng thái/CAS/quyền sở hữu/tài nguyên/log và bắt buộc grant khi đạt mốc; client không gửi proposal/giá/hiệu ứng. Điều chỉnh TEMP không cần sửa migration cũ hoặc thêm bản sao số TEMP trong SQL.
7. Mã catalog đã phát hành giữ ổn định vì ownership/history lưu code. Giá dùng lúc mua, hiệu ứng tra cấu hình hiện tại lúc hành động; chỉnh balance không sửa thưởng/base stats đã ghi trước đó. Không có bán lại, mua trùng, vượt lễ chế hoặc reroll title.
8. Retry giữ lệnh/key/revision cũ, không tự đổi mục tiêu khi stale. SessionStorage bị chặn thì retry còn trong tab, không bảo đảm giữ qua reload bị chặn storage. Máy chủ vẫn chống mua trùng/số dư âm. Clear giữ audit log/account usage, không hoàn bạc và không đưa quyền clear cho client.
9. Giá Sơ cấp20–40 và WORK15/cap8 đã chốt khiến món đầu mua được trong ngày hoạt động đầu. “1–2 ngày” được hiểu là số ngày hoạt động/ceil ngân sách, không ép chờ24h; không đổi WORK/giá ra ngoài khoảng để tạo cổng thời gian. Có bạc khởi đầu thì có thể mua sớm hơn.
10. Giữ kiến trúc global lock/world snapshot từ3B/4A; batching/khóa hẹp cho tải lớn chưa thuộc H1. Read H1 lỗi là metadata chưa khả dụng, không bịa sở hữu hoặc cho ghi dựa trên dữ liệu fallback. Tất cả cảnh/nhãn chỉ dùng DTO của chính người chơi.

## Số liệu TEMP

Tại `HAREM_BALANCE` trong `src/config/balance.ts`; kiểu/nội dung/màu/hoa văn ở `src/content/harem.ts`.

| Mục | Giá trị |
| --- | --- |
| Giá gear theo tầng | 20/30/40;60/90/120;200/300/400;600/800/1000;1500/2200/3000 |
| Hệ số từng món mẫu, cả hai loại | 5/8/10/12/15% theo tầng; cộng dồn chịu trần25% |
| Nâng cấp2/3/4/5 | 80/200/500/1200 bạc; minTier1/2/3/4 |
| Decor style0/1/2 | 0/25/80 bạc; minTier1/1/2 |
| Mốc phong hiệu | harem_12 Tài nhân;harem_10 Dung hoa;harem_8 Sung Nghi;harem_5 Tần;harem_3 Quý phi |

Cap mua10/ngày, trần gear25% mỗi loại, REST10%/cấp tối đa40%, SOCIALIZE5%/cấp tối đa20% là quyết định H1, cũng đặt tập trung trong balance. Hiệu ứng áp thưởng nguyên nên một món+5% có thể chưa tăng thêm một điểm cho thưởng8; không tự làm tròn lên.

## Ngày thực để kiếm đủ bạc

Tính từ0 bạc, không tính bạc khởi đầu/thưởng/sự kiện; WORK=15/lần, cap8/ngày. Lý thuyết cap=120/ngày;
ngân sách tham chiếu bền hơn là6 WORK+4 REST với10 AP/ngày, khoảng90 bạc/ngày khi khỏe và xen nghỉ để không suy kiệt.
Không phải cam kết thu nhập: còn chi phí hành động, điều trị, fatigue/HP và lựa chọn khác. Dùng ceil(price/budget), không phải thời gian bắt buộc chờ.

| Tầng | Khoảng giá | Số WORK | Ngày ở120/ngày (cap) | Ngày ở90/ngày (tham chiếu) |
| --- | ---: | ---: | ---: | ---: |
| Sơ cấp | 20–40 | 2–3 | 1 | 1 |
| Trung thấp | 60–120 | 4–8 | 1 | 1–2 |
| Trung cao | 200–400 | 14–27 | 2–4 | 3–5 |
| Cao cấp | 600–1000 | 40–67 | 5–9 | 7–12 |
| Tối cao | 1500–3000 | 100–200 | 13–25 | 17–34 |

## Việc người dùng phải làm

1. Đã ở4A/G1 và đã chạy0007: chạy **supabase/migrations/0008_harem_cosmetics.sql** trước code H1. Chạy lại an toàn, không reset số dư/AP/rank/R/đồ/title/cap đã ghi. Không chạy lại migration cũ sau0008.
2. Dự án mới: schema.sql một lần →0002 riêng →0003→0004→0005→0006→0007→0008. Giữ ba biến Supabase cũ; không env, thư viện hay cron mới. Không gửi service key vào chat/client/log.
3. Rà và chỉnh SAMPLE_DRAFT/TEMP tại nguồn, giữ code ổn định. Làm checklist Supabase thật bên dưới; kiểm thử Android/iOS tầm trung và2D trước phát hành. Giữ quy trình GLB/credits/check:models của G1.

## Checklist Supabase thật H1

- [ ] Backup dự án test; chạy0008 hai lần. Kiểm năm bảng RLS, alias/RPC anon/auth không EXECUTE, không SELECT raw của tài khoản khác. Chạy qua PostgREST/Vercel, không chỉ SQL Editor.
- [ ] Hai tài khoản HAREM/CIVIL: chỉ HAREM mua/mặc/nâng/bày; fake account/branch/price/effect/slot không thay giá/quyền. Thử phẩm thiếu/ngân lượng thiếu/sở hữu rồi/bệnh/khóa/mùa ENDED, không debit/log phần dở dang.
- [ ] Cùng UUID gửi đôi/mất phản hồi/reload trả đúng log cũ, mua một lần; hai UUID đồng thời không âm bạc, stale revision được chặn. Tài khoản đủ10 lần mua gear/decor thì chặn11; clear/đổi nhân vật không reset, qua00:00 UTC+7 mới reset.
- [ ] Một món mỗi ô, tháo đúng ô, không mặc món vượt tier. Base stats/R/ngưỡng không đổi khi mặc/tháo; AUDIENCE/ETIQUETTE/REST/SOCIALIZE đúng bonus/cap/fatigue/resonance/clamp và modifiers. Snapshot cũ bị từ chối sau khi đổi đồ.
- [ ] Nâng viện từng cấp/giá/tier; decor mặc định miễn phí và style đã mua mới bày. Profile/2D/3D phản ánh thay đổi sau reload/thiết bị khác, không AP/merit/roll do sửa soạn.
- [ ] Thăng vào năm mốc: grant trong cùng transaction, không chữ hiện tại, một grant/mốc, lịch sử có thứ tự. Tiêm lỗi ghi title có kiểm soát ở DB test: rollback AP/rank/ghế/history. Không có ban bù/reroll API.
- [ ] Clear nội bộ trên nhân vật test xóa đúng đồ/viện/title, giữ cap/ledger/log; gọi lại an toàn. Không endpoint client clear/tử vong.
- [ ] Cho lỗi đọc H1: profile/AP vẫn hiện, cảnh báo nhẹ và log chỉ tên nguồn/code/thông điệp hằng đã duyệt, không key/token/PII/row. Ghi khi lỗi phải thất bại hoàn toàn.
- [ ] Network/DOM không raw suspicion/suspicionFloor hoặc người chơi khác. Login/2D không chunk renderer; low/medium không bóng, high mềm, hidden/reduced-motion/demand như G1. Thử pin/nhiệt/memory thật, model nén nếu bổ sung.

## Kiểm chứng / số đo H1

- `npm run lint`, `npm run typecheck`, `npm run check:models`, production build: đạt. **137 test logic/SQL đạt**, gồm toàn bộ hồi quy, H1, RLS/WHERE guard, SDK qua transport nối PGlite. Migration0008 chạy lại trước/sau khi có giao dịch không reset dữ liệu; test lỗi title chứng minh rollback rank/AP.
- **21 Playwright đạt** với InMemory (18 luồng cũ +3 H1). Sau hoàn thiện tint/DTO/validation, chạy lại riêng8 test đồ họa/H1 đều đạt. Không có API seed/test production; fixture GLB/UI chỉ trong test.
- Scene procedural hiện tại: **1.758 tam giác mặc định; 1.862 tam giác cấu hình tối đa** (viện5, sáu style2, đủ ba món/hoa văn). Đo renderer thật ở dev bằng fixture hiển thị công khai của chính nhân vật; fixture không thay dữ liệu/promotion ở server. Không phân phối model ngoài; runtime vẫn chặn tổng>=100.000 tam giác.
- Chromium headless Linux/ANGLE SwiftShader, viewport390×844/DPR1/reduced-motion, một cửa sổ2s sau warm-up: max fixture Thấp56.5FPS/103draw calls/1.862tam giác vẽ; Trung bình59.2FPS/103calls/1.862; Cao35.5FPS/180calls/3.182tam giác vẽ gồm shadow pass. Mặc định94calls. Đây là một lượt đo, không benchmark thống kê hay hiệu năng điện thoại thật; lúc idle chỉ dùng frame counter, không diễn giải FPS cached/resize thành FPS idle.
- Chunk renderer production: **274.1KiB gzip tổng3 chunk** (~1003.1KiB raw), đo bằng measure:3d; không shared React/Next hoặc GLB/decoder chưa phân phối. G1 fallback, giới hạn DPR/shadow, reduced-motion và pause giữ nguyên. Không đo pin/nhiệt/GPU memory điện thoại.

---

# G1 — Nền tảng đồ họa 3D (prototype)

## Đã làm

- Cảnh Hậu cung “Cung viện của bạn”: sàn gỗ instancing, cột/tường son, xà mái, bình phong, sập, bàn trà, bình hoa, đèn emissive, cửa/sân/cây cách điệu. Component/slot tách để thay GLB; tất cả hình khối tự tạo, nguồn/CC0 trong CREDITS. Không đổi code nghiệp vụ, API, schema hoặc migration.
- Dynamic client-only/SSR=false, renderer thành chunk riêng; không tải tại login hoặc chế độ2D. HTML giữ chữ/nút/sự kiện, hotspot chỉ phát chú thích 2D, không AP hay thay chỉ số. Cảnh mobile45svh, desktop nằm nền cột giữa, tải có progress trong khung cố định.
- Auto/Thấp/Trung bình/Cao/2D lưu localStorage. Kiểm WebGL2, hints DPR/CPU/memory/saveData, benchmark FPS; thiếu hỗ trợ/lỗi renderer/context/máy yếu về2D. Error boundary log mã hằng, không ID/email/đặc tính thiết bị/exception object.
- DPR1/1.5/1.5; hemisphere + một directional; chỉ Cao có PCF soft shadow512px. Giới hạn xoay/zoom, tắt drift với reduced-motion. Demand khi đứng yên, never khi ẩn tab/ngoài viewport/tab mobile khác; giảm chất lượng sau hai cửa sổ FPS thấp liên tục.
- Registry, loader GLB có Meshopt/Draco/KTX2, decoder tự host. Manifest chỉ chứa file có thật do predev/prebuild tạo; không dò404/CDN. Kiểm byte/credits/file lạ/decoder và ngân sách tam giác/texture khi nạp; model thiếu dùng procedural, model lỗi về2D.
- `check:models` được thêm vào CI và prebuild. Unit test chọn chất lượng/lưu cấu hình/giảm FPS/model gate; Playwright kiểm chunk/login/2D, thiếu WebGL, lỗi renderer, cảnh/gesture/hotspot/đổi2D, GLB tự tạo qua loader thật.

## Chưa làm / giới hạn

G2 (nhân vật/trang phục), G3 (nhiều cảnh), luật game/database/kịch bản không thuộc G1. Chưa thử trên điện thoại thật, chưa đo nhiệt/pin/bộ nhớ GPU thực tế, chưa có GLB nghệ thuật chính thức. Loader nén đã nối API nhưng **chưa kiểm chứng với fixture Draco/Meshopt/KTX2 nén thật**. Có fixture GLB2.0 không nén tự tạo trong test, không phân phối model bên thứ ba. Chưa coi số FPS SwiftShader là hiệu năng điện thoại.

## Phiên bản và lý do

Ghim chính xác `three=0.170.0`, `@react-three/fiber=8.18.0`, `@react-three/drei=9.122.0`, `@types/three=0.170.0`. Fiber8 khai báo React>=18<19; Drei9 yêu cầu React18/Fiber8/three>=0.137, khớp React18.3.1 và Next14.2.35 đang dùng. Không nâng lên Fiber9/Drei10 vốn dành cho React19. Types cùng phiên bản three để tránh lệch API; package-lock cố định cây phụ thuộc.

## Giả định

1. Main khi bắt đầu đã có4A (merge5e4bf3e), giữ nguyên toàn bộ. G1 chỉ gắn view cho branch HAREM, không tạo route demo/seed hay giả người chơi.
2. Cài đặt là theo trình duyệt, không theo tài khoản. Auto máy yếu/saveData về2D; chọn3D thủ công được thử mức mong muốn nhưng vẫn chịu bảo vệ lỗi/FPS. Hạ chất lượng trong phiên không ghi đè sở thích; có thể chọn lại qua Cài đặt. LocalStorage bị chặn thì vẫn dùng trong phiên.
3. Dao động “nhàn rỗi” chỉ6s sau mở/3s sau tương tác để đồng thời giữ demand khi đứng yên; reduced-motion tắt hoàn toàn dao động. Kéo/zoom vẫn dùng được. Khởi động benchmark vẫn vẽ khoảng4.5s khi visible.
4. Auto mặc định thận trọng khi thiếu hints: Low. Low DPR1; mức khác min(DPR máy,1.5), nên thiết bị DPR1 không bị nâng lên1.5. Chỉ đo khung liên tục; idle không phải FPS0. Hạ sau hai cửa sổ2s dưới27FPS (Low dưới15); Low tụt tiếp về2D.
5. Manifest sinh lúc dev/build, không quét filesystem hay ghi server khi chơi. Thêm GLB phải build lại; assets không có thì không tải gì. Chỉ GLB nhúng tài nguyên, decoder không dùng CDN. Model lỗi/qua ngân sách làm cả cảnh về2D để không ảnh hưởng game.
6. Kiểm byte/credits tự động không chứng minh giấy phép hoặc chất lượng nghệ thuật. Chủ dự án duyệt mesh/texture/license theo checklist trước khi thêm. Phần procedural tự tạo CC0; không thay giấy phép toàn bộ game.
7. Debug chỉ development; benchmark/chunk gzip là phép đo cục bộ, không phải tải mạng hay pin thực tế. Playwright dùng SwiftShader, fixture GLB tự tạo/transport mock chỉ nằm trong test, không endpoint điều khiển đồ họa/game từ test trong production.

## Số đo thực tế trong môi trường

Chromium headless Linux, ANGLE SwiftShader (GPU phần mềm), viewport390×844, DPR thiết bị1, reduced-motion bật;
dev build để đọc panel debug, mẫu cửa sổ2s sau khởi động. Không throttling CPU/mạng; số liệu là một lượt đo, không benchmark thống kê.

| Chất lượng | FPS cửa sổ đo | Tam giác hình học | Tam giác vẽ/frame gồm shadow | Draw calls/frame |
| --- | ---: | ---: | ---: | ---: |
| Thấp | 59.0 | 1.508 | 1.508 | 82 |
| Trung bình | 57.5 | 1.508 | 1.508 | 82 |
| Cao | 44.3 | 1.508 | 2.580 | 148 |

Toàn cảnh1.508 tam giác <100.000; ván sàn16 chiếc dùng2 instanced draw calls. Sau khi nghỉ, hai mẫu debug cách nhau2.2s giữ nguyên frame counter173, không có loop vẽ liên tục. Các con số FPS chỉ áp dụng lúc đang vẽ; không diễn giải số cũ ở panel là FPS idle.

Ở một lượt kiểm tra resize sang desktop1440×1000 trong khi build/Playwright khác đang chạy cùng máy,
cửa sổ debug có lúc xuống7.9FPS. Số đo phụ thuộc tải/resolution và không cam kết FPS cố định; cơ chế giảm mức/2D vẫn cần thiết.

Chunk production: đo bằng `npm run measure:3d` sau build; tổng các chunk async riêng, gzip từng file, không tính shared React/Next hoặc GLB/decoder chưa phân phối. Build cuối: **3 chunk, 273.1 KiB gzip, 998.5 KiB raw**.

## Việc người dùng phải làm

1. `npm ci`, build/triển khai code như thường; **không migration, biến môi trường hoặc Supabase setup mới** cho G1. Yêu cầu backend từ các chặng đã triển khai vẫn giữ nguyên.
2. Vào nhân vật Hậu cung → Sân khấu; thử ba chất lượng và2D, reload lưu sở thích. Không cần tải model để chơi.
3. Nếu bổ sung GLB: đọc `docs/3D_ASSETS.md`, đặt file, registry, credits, decoder có phép nếu cần; chạy `npm run check:models` rồi build. Không commit manifest sinh tự động.
4. Trước phát hành: thử Android/iOS tầm trung thật, DPR cao, pinch, WebGL context loss, đổi tab/app, reduced-motion, pin/nhiệt và mạng chậm. Soi DevTools network: login/2D không có chunk3D, model/decoder không gọi CDN.

## Kiểm chứng G1

`npm run lint`, `npm run typecheck`, `npm run check:models`, production build: đạt. `npm test`: **119 kiểm tra đạt**, không bỏ test cũ. Toàn bộ **18 Playwright đạt** với InMemory/SwiftShader (13 luồng cũ +5 đồ họa); sau chỉnh projection khi resize, chạy lại riêng5 test đồ họa; sau hoàn thiện cleanup decoder khi unmount/Suspense, kiểm lại GLB trên build cuối. Không sửa kỳ vọng nghiệp vụ, không chạy migration hoặc thay cấu hình Supabase.

---

# Chặng 4A — Sự kiện cá nhân, Đại kiếp nạn và Thiên Mệnh

## Đã làm

- Engine thuần + 20 SAMPLE_DRAFT hư cấu, kiểm tra cấu hình khi nạp: 8 NORMAL, 4 RARE, 4 DANGEROUS ngẫu nhiên, 2 tra xét bắt buộc, 2 Đại kiếp nạn hai giai đoạn. Không tên NPC/lịch sử thật.
- Một roll40/60 mỗi nhân vật/tuần ở hành động hợp lệ đầu tiên, marks/checks trong giao dịch; nhóm65/20/13/2, điều kiện/cooldown/fallback NORMAL, nhân trọng số HARM/SLANDER. Kết quả MISS/FULL/NO_ELIGIBLE/LEGACY_MARK cũng lưu, không reroll/bù offline.
- PENDING tối đa3, hạn giờ thực, default lazy idempotent. Definition được chụp/khóa khi xuất hiện, stage không đặt lại hạn; retry giữ event/choice/stage/UUID và trả kết quả cũ.
- commit_event_world tái sử dụng global lock/CAS, ghế/check_promotion_action, resource/cap/merit và log. Các thay đổi, mark/RNG, resolution/claims/ledger cùng transaction; có test hai đề xuất đồng thời. SQL không có UPDATE/DELETE thiếu WHERE; không sửa migration cũ.
- Đại kiếp nạn chỉ thưởng +1 khi qua cuối, unique account/season/calamity_code. Thất bại/hết hạn = HP0, bệnh nặng5 điều trị, nửa bạc còn lại (floor), fav giảm; không chết. destiny_ledger ghi cả phần thưởng và chi phí reroll mới, không reset số dư/lịch sử cũ.
- Tra xét từ80 sau hành động/kết cục, 14 ngày game, dùng đúng RUMOR/sàn; cờ pending/deferred chặn thăng phẩm dù suspicion giảm. Khi đầy, giữ cờ hoãn và chờ giải phóng chỗ, không đẩy ra kết cục sớm hoặc vượt3.
- Sự kiện Hậu cung đúng guard Nội cung2–6/cha150/int100/susp45, gọi hàm thuần/RPC chuyển nhánh 3B, giữ merit/reset tại vị/ghế/điều kiện; từ chối không hậu quả, cooldown30 ngày game.
- Thẻ đang chờ/countdown/chi phí/khóa, chỉ báo mobile/desktop, màn kết quả và nhật ký20 dòng; Hồ sơ có Thiên Mệnh. Nghi Kỵ chỉ có mô tả, không gửi raw definition hoặc số liệu ẩn cho client.
- Migration0007 bật RLS ngay trên character_events/destiny_ledger, sensitive functions chỉ service_role. Đọc expiry/review có cảnh báo nhẹ/log đã lọc khi lỗi; ghi không nuốt lỗi. CI guard SQL/RLS và toàn bộ hồi quy giữ nguyên mục đích.

## Chưa làm / giới hạn

MAIN_STORY, COURT_WIDE, PvP, tử vong, giáng phẩm và NPC cụ thể chưa có logic. Trùng sinh/đóng mùa để các chặng sau; Chặng5 cần đóng sự kiện còn chờ của kiếp cũ. Không bổ sung cron hoặc dependency. Kiến trúc global lock và snapshot thế giới vẫn ưu tiên nhất quán, batching/khóa theo phạm vi để chịu tải lớn chưa thuộc 4A.

**chưa kiểm chứng trên Supabase thật**: môi trường chưa có URL/anon/service-role. PGlite thực thi migration/RPC/RLS với stub auth/role; không thay thử extension pg-safeupdate, PostgREST, Auth hoặc tranh chấp nhiều kết nối từ xa. Không chạy migration lên dịch vụ ngoài môi trường.

## Giả định / TODO(spec)

1. Hành động đầu tuần gồm hành động AP, APPLY/EXAM/TREAT và lựa chọn sự kiện thực sự (kể cả0 AP); không gồm WITHDRAW, mở trang, đồng hồ hay kết cục mặc định tự động. Xét điều kiện và trọng số theo trạng thái sau hành động/kết cục.
2. Dấu tuần cũ chưa có check được ghi LEGACY_MARK, không quay bù. Bảng weekly_event_checks M1 có PK tài khoản/season/week; 0007 giữ hàng cũ với character_id chưa biết/null và thêm PKid + unique nhân vật/season/week, không đoán nhân vật lịch sử. Đây là đổi constraint cần thiết để đúng quy tắc và Chặng5.
3. Roll nhóm trước, chọn trọng số trong tập hợp hợp lệ; HARM và SLANDER cùng có thì nhân cả hai. Fallback chỉ NORMAL, không thử lần lượt nhóm khác. Đủ3 vẫn ghi roll nhưng không spawn; các sự kiện cùng mã không chồng khi đang PENDING.
4. Một deadline thực giữ nguyên qua mọi giai đoạn; default của giai đoạn hiện tại chạy một lần, không thu phí/merit hoặc roll. Cooldown đếm chênh lệch ngày lịch game từ xuất hiện; riêng từ chối Hậu cung tính30 ngày lịch game từ từ chối. Tra xét dùng14 ngày từ xuất hiện, có thể xuất hiện lại sau kết cục nếu vẫn cao và đã qua cooldown.
5. Tra xét ưu tiên trước quay tuần. Đủ3 thì giữ cờ hoãn, chặn thăng phẩm dù suspicion giảm; tạo khi lựa chọn/default giải phóng chỗ. Không bỏ tra xét, không ép default sớm của chuyện khác, không tạo thẻ thứ tư.
6. Sự kiện không cộng công trạng. Contest mẫu dùng p=clamp(.35+int/2000+hp/400,.20,.95), giảm thêm.30 khi hp<20 và min.05; dùng chỉ số trước chi phí. Tăng dương/clamp/resonance/poverty/sàn dùng statEngine hiện có.
7. Bệnh nặng/khóa hành động không tự chọn (kể cả miễn phí), vẫn được Điều trị theo M2; expiry tự động vẫn thực hiện. Thất bại Đại kiếp nạn đặt hp0/5 điều trị; bạc còn floor(50% sau phí), fav-30 TEMP. TODO(spec) tử vong ở Chặng5, giáng phẩm/tử hình ở5/6.
8. Chuyển nhánh phí0, từ chối phí0, guard ACTIVE/không khóa của3B áp lại lúc nhận. Các sự kiện khác giữ snapshot/nội dung lúc xuất hiện; không tự hủy chỉ vì đổi nhánh. Pending tra xét không bị bỏ qua khi chuyển; nhãn chỉ số UI dùng nhánh hiện tại.
9. Thiên Mệnh chỉ thưởng ở SUCCESS giai đoạn cuối; cùng mã đã nhận vẫn có thể gặp/vượt nhưng không nhận lại. Ledger chỉ ghi giao dịch kể từ0007 (gồm reroll trả điểm), không tạo số dư mở đầu hay bịa lịch sử trước đó; số dư accounts là chuẩn.
10. Definition chụp khi spawn, bất biến qua reload/thay bản SAMPLE_DRAFT; điều kiện lựa chọn/tài nguyên/stage/guard chuyển nhánh kiểm tra lại từ trạng thái server. RNG mật mã ở Supabase, seed chỉ tiêm trong test. Không có API seed/reroll/tua giờ.
11. Giữ các giả định 3B/3A/M2 ở phần lịch sử; phiên ghế dùng chỉ số hiện tại với mốc phiên, thời gian tại vị reset ở giờ xử lý thật, không hồi tố. Các RPC cũ giữ chữ ký; ứng dụng mới ghi qua lớp giao dịch sự kiện để không tách mark/RNG khỏi AP.

## Số liệu TEMP

Tại `src/config/balance.ts → EVENT_BALANCE`; nội dung/nhánh/tầng/điều kiện từng mẫu ở events.ts.

| Mục | Giá trị |
| --- | --- |
| Trọng số nhóm | NORMAL65 / RARE20 / DANGEROUS13 / GREAT_CALAMITY2 |
| Deadline thực | NORMAL24h / RARE36h / DANGEROUS12h / GREAT_CALAMITY24h |
| Max PENDING | 3 |
| Cooldown mẫu / ĐKN | 7 / 60 ngày game |
| Cooldown tra xét / từ chối Hậu cung | 14 / 30 ngày game |
| Thất bại ĐKN | Mất50% bạc còn sau phí (floor số dư), fav-30; HP0/5 điều trị |
| Phí phương án mẫu | 1 AP; phương án miễn phí0; phương án chi bạc10 |
| Hiệu ứng mẫu nhỏ/lớn; bạc; HP; suspicion | 5 / 12; 10; -10; ±8 |
| Giảm suspicion tra xét / dàn xếp | 25 / 15, chịu sàn |
| Contest | base.35, intDivisor2000, hpDivisor400, clamp.20–.95, fatigue min.05 |

40%/60%, +1 Thiên Mệnh/claim duy nhất và công thức nhân quả M2 là quyết định đã chốt. Không thêm giới hạn gameplay cho Thiên Mệnh/AP ngoài quy tắc cũ; dailyCap kỹ thuật RESOLVE_EVENT là trần integer SQL, giới hạn thực bởi chuyện chờ/roll/cooldown.

## Việc người dùng phải làm

1. Đã ở3B+fix0006: chạy **supabase/migrations/0007_personal_events.sql** trước code mới. Có thể chạy lại, không reset AP, mùa, R, sự kiện/claim/ledger đã ghi. Không chạy migration cũ sau0007 vì sẽ thay wrapper bằng bản cũ.
2. Dự án mới: schema.sql một lần → 0002 riêng → 0003 → 0004 → 0005 → 0006 → 0007. Không sửa file đã chạy. Giữ đủ ba biến Supabase cũ; không env/cron mới.
3. Kho20 mẫu đang SAMPLE_DRAFT, cần biên tập và cân bằng trước phát hành nội dung chính thức. Chỉnh EVENT_BALANCE cho mẫu mới; pending snapshot không đổi theo cân bằng mới.
4. Chạy checklist bên dưới qua Vercel/PostgREST, không chỉ SQL Editor; không đưa service key vào client/chat.

## Checklist Supabase thật

- [ ] Backup dự án test; chạy0007 hai lần; số dư/AP/mùa/ghế/R không reset, PK/unique weekly mới đúng; legacy rows giữ nguyên. Kiểm tra bảng mới RLS và hàm/alias nhạy cảm anon/auth không EXECUTE.
- [ ] Hai tài khoản, hành động đầu tuần: một mark/check, RNG server, 40/60, không bù tuần offline. Cùng UUID, UUID khác đồng thời trên hai kết nối: không quay thêm, AP/usage/log chính xác. FULL/NO_ELIGIBLE/MISS đều lưu.
- [ ] Nhánh/tầng/status/stats/cooldown lọc đúng; nhóm trống fallbackNORMAL rồi không có. Đầy3 không tạo thêm; kiểm tra HARM/SLANDER trọng số bằng fixture server.
- [ ] Lựa chọn AP/bạc, thiếu phí hoặc stage cũ/nhân vật khác bị chặn; cùng UUID sau thay đổi khác trả đúng JSON cũ, không quay xác suất/thu phí lại. Mất phản hồi rồi reload/retry giữ event/choice/stage/UUID.
- [ ] Hết hạn đúng giờ thực, default giai đoạn hiện tại chỉ một lần, không AP/merit/roll; gọi đọc đồng thời không áp hai lần. Cho lỗi expiry/review có kiểm soát: hồ sơ còn đọc, có cảnh báo và log không PII; thao tác ghi vẫn thất bại không chốt một phần.
- [ ] Đại kiếp nạn hai chặng: chặng đầu không thưởng, cuối +1 có claim+ledger+account cùng transaction; cùng mã/kiếp mới trong mùa không thưởng lại, mùa mới có thể nhận. Thất bại/default không chết, bạc101→50, fav giảm, cần5 điều trị.
- [ ] Tra xét tại79/80, hai nhóm nhánh đúng; sau khi hạ suspicion vẫn pending thì APPLY bị chặn. Dàn xếp rep149/150 và sàn; cooldown14 ngày; đầy3 thì hoãn và chặn, giải phóng chỗ tạo đúng một tra xét.
- [ ] Nội cung2–6, cha150/int100/susp45: nhận sắc phong gọi RPC3B, rank/fav đúng, giữ merit/khác stats, trả ghế/rút đơn/khóa R cũ; từ chối không phí, cooldown30 ngày từ từ chối. Guard live thay đổi trong khi PENDING phải được kiểm tra lại.
- [ ] Reroll trả1 Thiên Mệnh có ledger-1, retry không thu/ghi lần nữa; số dư cũ trước0007 không reset và không bị backfill giả.
- [ ] Network/DOM/bundle: chỉ lời mô tả Nghi Kỵ, không raw suspicion/floor/definition/keys hoặc người khác; nhật ký20 dòng, thẻ/deadline/count/Thiên Mệnh hoạt động desktop/mobile.

## Kiểm chứng

- `npm run lint` (gồm SQL guard), `npm run typecheck`, production build: đạt.
- `npm test`: **115 kiểm tra đạt**, gồm toàn bộ hồi quy cũ, phân phối10.000 mẫu có seed, weighted tags, stage/cooldown/cap/default/claims/ledger/tra xét/chuyển nhánh, RPC/PGlite và privacy/RLS. Fixture hồi quy AP/nhật ký có RNG cố định để phần mới ngẫu nhiên không làm sai mục đích test cũ.
- **13 Playwright đạt** trên InMemory; thẻ/kết quả/retry lựa chọn có một kịch bản transport mock để kiểm tra UI/UUID mà không mở endpoint seed/tua giờ sản xuất. Backend giải quyết/chi phí/hiệu ứng được kiểm tra thật bằng engine/Memory/PGlite; không coi mock là Supabase thật.
- PGlite chạy0007 hai lần, sau giao dịch thưởng chạy lại vẫn giữ claim/điểm; kiểm tra actual RPC chuyển nhánh bằng spy trả lỗi và rollback, rồi khôi phục/gọi thành công. CI dùng cùng lint/test/build.
- **chưa kiểm chứng trên Supabase thật**; không chạy migration hay triển khai DB ngoài môi trường.

---

# Lịch sử các chặng trước

# Sửa lỗi vận hành Chặng 3B — pg-safeupdate (0006)

## Nguyên nhân và rà soát

`readState → runDueSeatRounds → seat_world_load → runtime_snapshot → refresh_runtime_ap → UPDATE accounts → seat_world_after_write`. Trigger trong 0005 chạy `UPDATE seat_world_state SET revision=revision+1` thiếu WHERE; pg-safeupdate trên PostgREST trả 21000, Vercel nhận GameRuleError và trang chính lỗi. SQL Editor không bật cùng kiểm tra nên việc migration chạy được không chứng minh RPC hoạt động qua API.

| Nguồn đã rà soát | Kết quả |
| --- | --- |
| schema.sql (Chặng 1; repository không có 0001) | UPDATE/DELETE thực tế có WHERE; upsert giới hạn bởi khóa xung đột |
| 0002 | Bổ sung enum, không có DML không WHERE |
| 0003, 0004 | UPDATE theo account/character/request hoặc điều kiện backfill; row lock và upsert không phải DML toàn bảng |
| 0005 và chuỗi RPC xét ghế | Một UPDATE không WHERE trong seat_world_after_write; các UPDATE/DELETE còn lại có điều kiện; SQL động chỉ tạo/xóa trigger/quyền |
| SQL TypeScript sản xuất (src) | Không có SQL UPDATE/DELETE trực tiếp; dùng Supabase RPC/query builder. Fixture SQL trong tests được tách khỏi đường sản xuất |

## Đã sửa

- Migration mới **0006_fix_safeupdate.sql**, begin/commit, CREATE OR REPLACE đúng chữ ký trigger; WHERE season_id thuộc mùa ACTIVE, giữ revision cho CAS, không sửa mùa ENDED. Giữ REVOKE anon/authenticated/PUBLIC, GRANT service_role, chạy lại an toàn; không sửa migration cũ hoặc tắt pg-safeupdate.
- Repository ghi log tên RPC/bảng và code/message/hint/details. Chỉ giữ thông điệp hằng đã duyệt; chẩn đoán khác bị che mặc định, kể cả failing row/UUID/email/tên tự do/token/khóa. Không log error object, bộ lọc, đối số, URL/header hay dữ liệu người chơi. Thông báo lỗi người dùng vẫn thân thiện.
- Đọc trạng thái/snapshot, Quan chế, mùa, nhật ký cố gắng xét phiên nhưng không phụ thuộc việc xét thành công. Hồ sơ còn đọc được tiếp tục hiển thị với cảnh báo nhẹ; bảng ghế lỗi thì để trống kèm cảnh báo. Snapshot tài khoản lỗi thật vẫn báo lỗi; không tạo dữ liệu/AP giả.
- Đường ghi setup/action/APPLY/thăng phẩm/trả ghế/chuyển nhánh vẫn nghiêm ngặt và nguyên tử; không dùng đường đọc dự phòng để chốt dữ liệu.
- Test tĩnh quét mọi migration, schema.sql và SQL literal/template src; CI chạy qua lint/test. Bỏ comment/chuỗi dữ liệu, quét thân AS/DO dollar-quoted, phân biệt row lock/trigger/upsert với UPDATE thực tế và không nhận WHERE trong subquery thay cho WHERE ngoài.

## Giới hạn và quyết định để giữ migration bất biến

0005 phải giữ nguyên nên không thể đồng thời xóa câu lỗi lịch sử khỏi file và giữ lịch sử bất biến. Guard nhận diện **chính xác một câu lỗi đó trong đúng 0005**, bắt buộc có CREATE OR REPLACE trong 0006 và không cho phép vi phạm mới ở bất cứ file nào. Test PGlite kiểm chứng bản thay thế thực sự được nạp. Đây không phải miễn kiểm tra cả migration cũ.

Guard là bộ kiểm tra từ vựng, không phải parser PostgreSQL hoặc công cụ chứng minh WHERE đúng nghiệp vụ. SQL ghép chuỗi/EXECUTE, thân hàm viết kiểu chuỗi đơn và template phức tạp vẫn cần rà soát riêng. Không có SQL động DML trong mã sản xuất đã rà soát.

PGlite không nạp được pg-safeupdate. Test mô phỏng chặn trigger lỗi (21000), chạy đúng chuỗi RPC/cấp AP, rồi áp dụng 0006 hai lần và xác nhận đọc được, revision ACTIVE tăng, ENDED giữ nguyên, quyền hàm không đổi. **chưa kiểm chứng trên Supabase thật**; không tuyên bố đã kiểm thử extension/PostgREST thực tế.

## Việc người dùng phải làm

1. Trên dự án đã ở 3B, chạy **supabase/migrations/0006_fix_safeupdate.sql** trong Supabase SQL Editor trước khi triển khai code mới. Có thể chạy lại; không chạy lại 0005 sau 0006 vì sẽ khôi phục trigger lỗi.
2. Dự án mới: schema.sql một lần → 0002 riêng → 0003 → 0004 → 0005 → 0006. Không sửa file đã chạy.
3. Không cần biến môi trường mới; giữ ba biến Supabase hiện có. Không gửi khóa qua chat/PR và không tắt pg-safeupdate.
4. Kiểm tra qua PostgREST/Vercel (không chỉ SQL Editor): đăng nhập tài khoản có AP chưa cấp hôm nay; đọc trang chính, world-time và Quan chế, xác nhận không còn 400/21000. Với service_role ở công cụ server riêng, gọi seat_world_load; không đưa khóa vào trình duyệt.
5. Trên dự án test gây lỗi xét phiên có kiểm soát: hồ sơ/AP/nhật ký còn hiển thị và có cảnh báo; log chỉ tên RPC/mã/chẩn đoán đã lọc, không có khóa/PII. Gửi APPLY phải thất bại mà không trừ AP/ghi đơn một phần. Khôi phục lỗi, đồng bộ lại để hết cảnh báo.
6. Kiểm tra nộp/rút, tranh ghế đồng thời, AP/cap/revision và idempotency vẫn như checklist 3B bên dưới.

## Kiểm chứng

- `npm run lint` (gồm guard SQL), `npm run typecheck`, production build: đạt.
- `npm test`: **88 test đạt**, gồm toàn bộ 77 test cũ và 11 test mới về SQL guard, migration/trigger/RPC, đọc dự phòng và log không lộ dữ liệu.
- **12 Playwright đạt** trên InMemory; có cảnh báo nhẹ, hồ sơ/AP còn hiển thị và cảnh báo mất khi đồng bộ khỏe lại. Bộ ghế/PGlite cũ nay chạy cả 0006 hai lần.
- CI mới chạy lint/guard, typecheck, test và build khi push/PR. Không thêm dependency.
- **chưa kiểm chứng trên Supabase thật**; PGlite mô phỏng chặn 21000, không nạp extension pg-safeupdate/PostgREST. Chưa chạy migration lên dịch vụ ngoài môi trường này.

---

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
