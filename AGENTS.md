# AGENTS.md — ĐẠI NỘI KÝ (System Architecture & Game Logic Specification)

> **Tài liệu Định hướng Kiến trúc & Nghiệp vụ Cốt lõi dành cho AI Coding Agent (OpenAI Codex)**  
> **Dự án:** ĐẠI NỘI KÝ  
> **Thể loại:** Mobile-First Web RPG / Political Strategy / Court Simulation / Interactive Narrative  
> **Bối cảnh:** Triều đại giả tưởng (Hoàng triều Đại Khánh – Kinh đô Phụng Thiên Phủ – Niên hiệu Thiên Nguyên), lấy cảm hứng từ văn hóa, kiến trúc và quan chế Việt Nam thời Lý – Trần – Lê (`fictional: true`, hư cấu hoàn toàn nhân vật và sự kiện để tránh phạm kỵ lịch sử).

---

## 1. TECH STACK & KIẾN TRÚC GIAO DIỆN (UI/UX ARCHITECTURE)

### 1.1. Core Tech Stack
- **Framework:** Next.js (App Router), ưu tiên Server Components cho data fetching và Server Actions / Route Handlers cho toàn bộ logic biến đổi trạng thái (state mutations).
- **Language:** TypeScript (Strict mode: `true`). Không sử dụng `any`; định nghĩa đầy đủ interface/type cho toàn bộ thực thể game.
- **Styling:** Tailwind CSS (kết hợp bảng màu cổ phong cung đình: Đỏ son, Vàng hoàng kim, Đen huyền, Nâu gỗ trầm).
- **Icons:** `lucide-react` (Lucide Icons).
- **Backend & Database:** Supabase
  - **Supabase Auth:** Quản lý định danh tài khoản người chơi (`users` / `accounts`).
  - **Supabase PostgreSQL:** Lưu trữ trạng thái thế giới, mùa giải, nhân vật, hệ thống ghế quan chức/hậu cung, điều kiện thăng phẩm, sự kiện và bảng xếp hạng. Bắt buộc bật Row Level Security (RLS) và xử lý các giao dịch nhạy cảm (trừ AP, đổi thân phận, thăng phẩm, cộng thưởng) qua PostgreSQL RPC / Transaction để chống gian lận phía Client.

### 1.2. Thiết kế Giao diện Đáp ứng (Responsive Layout)
- **Mobile (`< 1024px`):**
  - Khung hiển thị dọc tỷ lệ chuẩn **9:16** (`max-w-md mx-auto min-h-dvh flex flex-col`).
  - Có thanh điều hướng dưới cùng (**Bottom Navigation Bar**) cố định giúp chuyển đổi nhanh giữa các tab: *Hồ sơ Thân phận*, *Sân khấu Chính / Sự kiện*, *Quan chế / Lục viện*, và *Nhật ký Triều chính*.
- **Desktop (`>= 1024px`):**
  - Bố cục **3 cột (3-Column Grid Layout)** hiển thị đồng thời toàn bộ không gian thông tin:
    - **Cột trái (Left Panel):** Hồ sơ nhân vật, Thân phận, Xuất thân, Phẩm cấp hiện tại, Tiến trình 3 điều kiện thăng phẩm và Bảng 7 chỉ số cốt lõi (ẩn chỉ số *Nghi Kỵ* trên UI thông thường, chỉ hiển thị cảnh báo trạng thái hoặc qua cơ chế dò xét).
    - **Cột giữa (Center Stage):** Sân khấu chính hiển thị bối cảnh hiện tại, tương tác hành động tiêu tốn AP, hội thoại và xử lý Sự kiện (Event Cards & Choices).
    - **Cột phải (Right Panel):** Bảng quan chức Ngoại triều / Phẩm vị Hậu cung & Nội cung (số ghế trống/đã chiếm), danh sách NPC trọng yếu, quan hệ phe phái và Nhật ký triều chính (World & Court Logs).

---

## 2. QUY TẮC THẾ GIỚI, THỜI GIAN & LƯỢT HÀNH ĐỘNG (WORLD, TIME & AP MECHANICS)

### 2.1. Quy ước Lịch pháp & Đồng hồ Máy chủ (Server-Authoritative Clock)
- **Lịch hư cấu:**
  - `1 năm = 12 tháng`
  - `1 tháng = 4 tuần = 30 ngày` (`1 tuần = 7 ngày`)
  - `1 năm = 360 ngày` (Không có năm nhuận).
- **Tỷ lệ quy đổi thời gian thực:**
  - **1 ngày trong game = 5 phút ngoài đời thực** (`300 giây`).
  - `1 tuần trong game (7 ngày)` = `35 phút thực tế`.
  - `1 tháng trong game (30 ngày)` = `150 phút thực tế` (`2 giờ 30 phút`).
  - `1 năm trong game (360 ngày)` = `1.800 phút thực tế` (`30 giờ`).
- **Công thức tính thời gian từ `season_start_timestamp`:**
  Toàn bộ thời gian trong game được tính toán động dựa trên mốc khởi đầu mùa giải `season_start_timestamp` của máy chủ:
  ```typescript
  const MS_PER_GAME_DAY = 5 * 60 * 1000; // 300,000 ms
  const elapsedMs = Math.max(0, serverNowMs - seasonStartTimestampMs);
  const totalElapsedGameDays = Math.floor(elapsedMs / MS_PER_GAME_DAY);

  const currentGameYear = Math.floor(totalElapsedGameDays / 360) + 1;
  const dayOfYear = totalElapsedGameDays % 360; // 0 -> 359
  const currentGameMonth = Math.floor(dayOfYear / 30) + 1; // 1 -> 12
  const currentGameDay = (dayOfYear % 30) + 1; // 1 -> 30
  const currentGameWeek = Math.floor(totalElapsedGameDays / 7) + 1;
  ```
- **Quy tắc vận hành thời gian & mùa giải (Season):**
  - Đồng hồ chạy liên tục theo thời gian thực trên máy chủ, không phụ thuộc thời gian đăng nhập hay số hành động của người chơi. Khi người chơi offline, thời gian thế giới vẫn tiếp tục trôi.
  - Tuyệt đối không có cơ chế cho phép người chơi tự tua nhanh, tạm dừng, quay ngược thời gian hoặc bấm "Kết thúc lượt" để tự tăng thời gian toàn triều.
  - Tuổi tác của nhân vật và các biến cố gắn với năm tháng được tính theo **thời gian thế giới** (`currentGameYear`), không tính theo số lượt AP cá nhân đã dùng.
  - Mọi người chơi trong cùng máy chủ nhìn thấy cùng một niên lịch và tham gia chung một kịch bản mùa đang hoạt động.
  - Thời lượng một mùa giải không cố định theo số năm/ngày cứng, mà kết thúc khi Hoàng đế (NPC trung tâm độc lập của mùa đó) băng hà, thoái vị, bị phế truất hoặc mất ngôi vĩnh viễn.
  - Khi chọn kịch bản cho mùa mới từ thư viện kịch bản, không được chọn lặp lại ngay kịch bản của mùa vừa kết thúc.

### 2.2. Hệ thống Lượt Hành Động (AP - Action Points)
- **Cấp phát định kỳ:**
  - Vào đúng **00:00 mỗi ngày theo giờ Việt Nam (`UTC+7` / `Asia/Ho_Chi_Minh`)**, hệ thống tự động cấp **+10 AP** cho mọi tài khoản.
  - Lượt mới được cộng dồn vào số AP hiện có nhưng bị giới hạn bởi trần tích lũy tối đa là **15 AP**:
    ```typescript
    newAP = Math.min(15, currentAP + 10);
    ```
- **Quy tắc bảo mật & chống gian lận AP:**
  - Việc cấp AP diễn ra tự động phía máy chủ (hoặc tính toán lazy-evaluation dựa trên `last_ap_grant_date_utc7` của tài khoản), không yêu cầu người chơi phải online lúc 00:00.
  - Mỗi tài khoản chỉ nhận duy nhất 1 lần `+10 AP` cho mỗi ngày thực.
  - Không làm mới hoặc cấp thêm AP khi người chơi tải lại trang, đăng xuất, chuyển thiết bị, điều chỉnh đồng hồ thiết bị, hoặc khi nhân vật **qua đời và trùng sinh** trong cùng mùa giải.
  - Không trừ AP khi người chơi chỉ mở màn hình hoặc đọc nội dung sự kiện; chỉ trừ AP khi thực hiện hành động hợp lệ hoặc xác nhận lựa chọn sự kiện có chi phí AP.
  - Bắt buộc áp dụng cơ chế **Idempotency Key / Transaction Lock** để một hành động không bao giờ bị trừ AP hai lần khi người chơi nhấn đúp (double-click) hoặc rớt mạng.
  - Chỉ lượt có hành động thực sự mới kích hoạt kiểm tra sự kiện; cấm bấm kết thúc lượt rỗng để quay sự kiện.
  - Các phần thưởng lặp lại, cơ hội nhận công trạng, điểm xếp hạng và tăng trưởng chỉ số phải có hạn mức theo ngày thực (`daily_cap`) để chống cày vô hạn.

### 2.3. Hệ thống Sự kiện Tuần & Phân loại Sự kiện
- **Xác suất Sự kiện Ngẫu nhiên Cá nhân:**
  - Mỗi tuần trong game (`currentGameWeek`), khi nhân vật thực hiện **hành động hợp lệ đầu tiên của tuần đó**, máy chủ kiểm tra xác suất đúng 1 lần:
    - **40%:** Xuất hiện 1 sự kiện ngẫu nhiên cá nhân.
    - **60%:** Không xuất hiện sự kiện.
  - Không thể dùng thêm AP trong cùng tuần để quay lại kết quả. Người chơi không hoạt động trong tuần đó không được nhận bù.
  - Sự kiện chưa giải quyết được lưu trạng thái chờ (`PENDING`) theo thời hạn kịch bản; quá hạn sẽ tự động áp dụng kết cục bỏ qua (trừ sự kiện bắt buộc).
- **6 Nhóm Sự kiện trong Game:**
  1. `NORMAL` (Thông thường): Xuất hiện thường xuyên, ảnh hưởng nhỏ đến chỉ số hoặc quan hệ.
  2. `RARE` (Hiếm): Yêu cầu điều kiện riêng, mang đến cơ hội hoặc chứng cứ đặc biệt.
  3. `DANGEROUS` (Nguy hiểm): Có khả năng gây thất sủng, mất chức, thương tích hoặc bị điều tra.
  4. `GREAT_CALAMITY` (Đại kiếp nạn): Sự kiện sinh tử hoặc khủng hoảng chính trị lớn; vượt qua hợp lệ thưởng **+1 Điểm Thiên Mệnh**.
  5. `MAIN_STORY` (Kịch bản chính): Thuộc tuyến cốt truyện của mùa, kích hoạt theo điều kiện riêng.
  6. `COURT_WIDE` (Toàn triều): Ảnh hưởng đến nhiều người chơi và cục diện chính trị toàn triều.
  *(Lưu ý: Giới hạn 40%/tuần chỉ áp dụng cho sự kiện ngẫu nhiên cá nhân; các sự kiện `MAIN_STORY`, `PVP` và `COURT_WIDE` kích hoạt theo điều kiện riêng).*

---

## 3. CẤU TRÚC 7 CHỈ SỐ CỐT LÕI & LOGIC TƯƠNG TÁC NHÂN QUẢ

### 3.1. Định nghĩa 7 Chỉ số & Giới hạn (Stat Bounds)

| Mã biến (Field) | Tên Chỉ số | Phạm vi hợp lệ | Hiển thị UI | Mô tả & Tác động Nghiệp vụ |
| :--- | :--- | :---: | :---: | :--- |
| `int` | **Tài Học / Tâm Kế** | `0 – 1000` | Công khai | Kiến thức kinh sử, luật lệ hành chính (Quan lại) hoặc sự nhạy bén, mưu lược, quy củ nội đình (Nội cung & Hậu cung). Quyết định tỷ lệ thành công khi bày mưu, phá bẫy, xử lý tấu chương và đấu khẩu. |
| `rep` | **Thanh Danh / Quyền Thế** | `0 – 1000` | Công khai | Tiếng tăm tại triều đường hoặc uy vọng trong Lục viện. Đại diện sức nặng lời nói, mở khóa lựa chọn áp chế cấp dưới và là điều kiện bắt buộc để thăng cấp. |
| `fav` | **Thánh sủng / Tín nhiệm** | `-100 – 1000` | Công khai | Mức độ sủng ái của Hoàng đế (Hậu cung), sự tin dùng của nhà vua (Quan lại), hoặc sự hài lòng của chủ tử trực tiếp (Nội cung). Tăng bổng lộc nhưng dễ kéo theo đố kỵ. |
| `cha` | **Dung mạo / Phong thái** | `0 – 1000` | Công khai | Sắc vóc, lễ nghi cung đình, phong thái ứng xử. Tăng hiệu quả gây thiện cảm ban đầu ở Hậu cung/Nội cung và giúp Quan lại ghi điểm khi diện kiến. |
| `hp` | **Thể Lực** | `0 – 100` | Công khai | Sức khỏe thể chất và tinh thần. **Khi `hp == 0`:** Lâm trọng bệnh (bị **khóa hành động 5 lượt** để điều trị) hoặc **tử vong** nếu không đủ Ngân lượng mời Ngự y. |
| `suspicion` | **Tì Vết / Nghi Kỵ** | `0 – 100` | **Chỉ số ẩn** | Tăng khi dùng thủ đoạn phi pháp, nhận hối lộ hoặc vượt lễ chế. Có mức sàn tối thiểu `suspicionFloor` (mặc định `0`). **Khi `suspicion >= 80`:** Kích hoạt sự kiện bị **Đô sát viện** đàn hặc (Quan lại) hoặc **Cung chính ty / Nội vụ phủ** tra xét (Nội cung / Hậu cung). |
| `characterSilver` | **Ngân lượng (Kiếp hiện tại)** | `>= 0` (Không trần) | Công khai | Dùng mua chuộc thái giám, thu thập mật báo, tặng quà NPC, mua vật phẩm, thuốc bổ, thưởng cấp dưới. **Xóa toàn bộ về `0` khi nhân vật chết.** |

### 3.2. Phân tách Dữ liệu Ngân lượng Xuyên Triều đại
Bắt buộc tách biệt hoàn toàn hai trường dữ liệu sau trong Database và State:
1. `characterSilver` (Thuộc bảng `characters`): Ngân lượng nhân vật đang sở hữu trong cuộc đời hiện tại. Khi nhân vật tử vong hoặc kết thúc mùa giải, giá trị này **không được thừa kế** sang kiếp sau.
2. `pendingRewardSilver` (Thuộc bảng `accounts` / `users`): Ngân lượng thưởng từ Bảng xếp hạng cuối mùa đang chờ cộng vào lần tạo nhân vật mới tiếp theo.

**Công thức tính Ngân lượng khi bắt đầu kiếp mới:**
```typescript
characterSilver = baseIdentitySilver + account.pendingRewardSilver;
```
**Quy tắc tiêu thụ `pendingRewardSilver`:**
- Chỉ cộng vào `characterSilver` đúng thời điểm người chơi bấm **Xác nhận (Confirm)** bắt đầu cuộc đời nhân vật mới. Ngay sau khi cộng, đặt `account.pendingRewardSilver = 0` trong cùng một Database Transaction.
- Nếu người chơi bấm "Đổi thân phận (Reroll)" nhiều lần trước khi xác nhận, `pendingRewardSilver` vẫn giữ nguyên ở trạng thái chờ.
- Sau khi đã nhận vào nhân vật mới, nếu nhân vật đó chết, toàn bộ `characterSilver` (bao gồm phần thưởng đã cộng) sẽ mất theo cuộc đời đó; không được nhận lại khi trùng sinh tiếp.
- Nếu người chơi chưa tạo nhân vật ở mùa kế tiếp, `pendingRewardSilver` được bảo lưu cho đến lần xác nhận tạo nhân vật hợp lệ tiếp theo.

### 3.3. Quy tắc Tương tác Nhân quả giữa các Chỉ số (Causal Stat Engine)
AI Agent khi viết logic xử lý lượt (Turn/Action Processor) và trình sinh sự kiện (Event Generator) phải cài đặt 6 quy tắc nhân quả sau:

1. **Hiệu ứng "Sủng cao Kế đoản" (`fav > 400 && int < 200`):**
   - Tăng **+40%** xác suất bị NPC đối địch phát động sự kiện hãm hại hoặc hạ độc vào đầu lượt.
2. **Hiệu ứng "Quyền lớn Bạc cạn" (`rep > 60 && characterSilver < 10`):**
   - Tự động trừ **-5 `rep`** (Quyền thế/Thanh danh) sau mỗi lượt do không đủ bạc duy trì mạng lưới thuộc hạ.
3. **Hiệu ứng "Suy kiệt Thể lực" (`hp < 20`):**
   - Mọi hành động tiêu tốn AP bị **giảm 50% hiệu quả nhận chỉ số dương** (`statGain = Math.floor(baseGain * 0.5)`) và **tăng +30% nguy cơ thất bại** khi thực hiện khảo hạch hoặc đấu trí.
4. **Hiệu ứng "Cộng hưởng Nghi thái" (`cha >= 200`):**
   - Mỗi khi `cha` (Dung mạo/Phong thái) đạt mốc bội số của 200 (`200, 400, 600, 800, 1000`), lượng điểm `fav` (Thánh sủng/Tín nhiệm) nhận được từ các sự kiện diện kiến được cộng thêm **+15%** (tức nhân hệ số `1 + 0.15 * Math.floor(cha / 200)`, hoặc `+15%` khi đạt ngưỡng mốc).
5. **Hiệu ứng "Độc sủng sinh kiêu" (`fav - rep >= 200`):**
   - Nếu `fav` cao hơn `rep` từ 200 điểm trở lên, xác suất gặp sự kiện bị NPC ganh ghét hoặc vu khống ở mỗi lượt tăng thêm **+30%**.
6. **Cơ chế "Đánh đổi Ngân lượng dẹp tin đồn":**
   - Người chơi có thể chi `characterSilver` để giảm `suspicion`. Tuy nhiên, nếu thực hiện hành động này khi `rep < 150`, thì sau mỗi lần mua chuộc, mức sàn tối thiểu của Nghi Kỵ (`suspicionFloor`) sẽ **tăng vĩnh viễn thêm +5 điểm** trong kiếp đó (`suspicion = Math.max(suspicionFloor, newSuspicion)`).

---

## 4. QUY TẮC KHỞI TẠO NHÂN VẬT & ĐỔI THÂN PHẬN (CHARACTER CREATION & REROLL)

### 4.1. Bảng Khoảng Random Chỉ số theo 4 Nhánh (Branch Base Stat Ranges)
Khi khởi tạo thân phận, từng chỉ số được lấy ngẫu nhiên độc lập theo phân phối đều số nguyên `RandomInteger(min, max)` trong khoảng của nhánh đã chọn:

| Nhánh (`branch`) | Tài Học / Tâm Kế (`int`) | Thanh Danh / Quyền Thế (`rep`) | Thánh sủng / Tín nhiệm (`fav`) | Phong thái / Dung mạo (`cha`) | Thể Lực (`hp`) | Ngân lượng (`silver`) | Nghi Kỵ (`suspicion`) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Văn giai** (`CIVIL`) | 45 – 80 | 15 – 45 | -20 – 30 | 35 – 80 | 70 – 95 | 25 – 80 | 0 – 15 |
| **Võ giai** (`MILITARY`) | 45 – 75 | 15 – 50 | -20 – 25 | 30 – 75 | 80 – 100 | 20 – 70 | 0 – 12 |
| **Nội cung** (`INNER_COURT`) | 35 – 70 | 5 – 30 | 0 – 35 | 35 – 85 | 75 – 100 | 20 – 65 | 0 – 12 |
| **Hậu cung** (`HAREM`) | 45 – 85 | 15 – 45 | 0 – 35 | 50 – 90 | 65 – 95 | 25 – 90 | 0 – 15 |

*(Ghi chú mở rộng: Trong trường hợp kịch bản con sử dụng bảng phân bổ theo Thân phận gốc trước rồi cộng điều chỉnh nhánh [Quan lại: `+5..15 int`; Cung nữ: `+5..12 hp, +3..10 int`; Hậu cung: `+5..15 cha, +0..10 rep`], vẫn phải đảm bảo bước clamp giới hạn hợp lệ ở cuối quy trình).*

### 4.2. Bảng Ngẫu nhiên Xuất thân (Background Roll & Modifiers)
Hệ thống quay ngẫu nhiên 1 trong 4 Xuất thân theo trọng số xác suất dưới đây và cộng/trừ trực tiếp vào chỉ số vừa sinh:

| Mã Xuất thân | Tên Xuất thân | Xác suất | Hiệu ứng cộng/trừ chỉ số (Modifiers) |
| :--- | :--- | :---: | :--- |
| `COMMONER` | **Bình dân** | **40%** | `+8 hp`, `-5 characterSilver` |
| `SCHOLAR_FAMILY` | **Gia đình nho học** | **30%** | `+12 int`, `+8 cha` |
| `NOBLE_CLAN` | **Thế gia** | **20%** | `+15 rep`, `+10 fav`, `+35 characterSilver`, `+8 suspicion` |
| `FALLEN_CLAN` | **Gia tộc sa sút** | **10%** | `+8 int`, `+10 cha`, `-10 fav`, `+8 suspicion` |

### 4.3. Quy trình 7 Bước Khởi tạo Nhân vật (Initialization Pipeline)
1. **Bước 1:** Người chơi chọn nhánh phát triển (`CIVIL`, `MILITARY`, `INNER_COURT`, `HAREM`).
2. **Bước 2:** Hệ thống random Xuất thân theo tỷ lệ `40% / 30% / 20% / 10%` và tuổi khởi đầu (mặc định `RandomInteger(16, 21)`).
3. **Bước 3:** Hệ thống random 7 chỉ số gốc theo bảng khoảng của nhánh.
4. **Bước 4:** Áp dụng hiệu ứng cộng/trừ từ Xuất thân.
5. **Bước 5:** Giới hạn (Clamp) kết quả trong phạm vi hợp lệ của từng chỉ số. Phẩm khởi đầu chuẩn không áp ngưỡng nhập phẩm; nếu kịch bản cho phẩm cao hơn, chỉ nâng bốn chỉ số phát triển lên cận dưới B-D của hàng phẩm đó (mục 5.3).
6. **Bước 6:** Xác lập phẩm cấp khởi đầu. Cho phép người chơi **Chấp nhận** hoặc **Đổi thân phận (Reroll)**.
7. **Bước 7:** Khi người chơi bấm **Xác nhận**, khóa thân phận, cộng `pendingRewardSilver` (nếu có) vào `characterSilver`, và **sinh ngay bộ 3 điều kiện thăng phẩm đầu tiên** gắn với ID nhân vật.

### 4.4. Quy tắc Đổi Thân Phận (Reroll) & Điểm Thiên Mệnh (`destinyPoints`)
- **Khi đổi thân phận:** Hệ thống random lại **Xuất thân, đặc điểm thân phận và bộ chỉ số ban đầu**, nhưng **giữ nguyên Nhánh** người chơi đã chọn.
- **3 Lượt đổi miễn phí cho Tài khoản mới (`freeRerollsRemaining`):**
  - Tài khoản tạo nhân vật **lần đầu tiên (kiếp đầu tiên)** được tặng **3 lượt đổi thân phận miễn phí**.
  - Lần random đầu tiên khi mở màn hình tạo nhân vật không tốn lượt -> Người chơi được xem tối đa **4 kết quả thân phận** miễn phí ở kiếp đầu.
  - Khi người chơi bấm **Xác nhận** bắt đầu cuộc đời đầu tiên, toàn bộ lượt miễn phí chưa dùng hết sẽ **lập tức hết hiệu lực** (`freeRerollsRemaining = 0`).
  - Thoát giao diện hoặc tải lại trang không làm mới số lượt miễn phí đã dùng. Lượt miễn phí **không được cấp lại** ở các lần trùng sinh hay mùa giải sau.
- **Đổi thân phận bằng Điểm Thiên Mệnh (`destinyPoints`):**
  - Sau khi hết 3 lượt miễn phí ở kiếp đầu, hoặc ở **mọi kiếp trùng sinh / mùa giải mới**:
    - Lần ngẫu nhiên đầu tiên của mỗi kiếp: **Miễn phí (0 điểm)**.
    - Mỗi lần bấm "Đổi lại thân phận" tiếp theo: Tiêu hao **1 Điểm Thiên Mệnh (`destinyPoints`) / lần**.
  - Không giới hạn số lần đổi nếu tài khoản còn `destinyPoints`.
  - Chỉ được đổi trong giao diện tạo nhân vật trước khi bấm Xác nhận. Điểm Thiên Mệnh đã trừ không được hoàn lại dù kết quả random mới thấp hơn lần trước.

---

## 5. HỆ THỐNG PHẨM CẤP & CÔNG THỨC SINH 3 ĐIỀU KIỆN THĂNG PHẨM NGẪU NHIÊN

### 5.1. Hệ thống Phẩm cấp và Phân bổ Ghế theo 4 Nhánh

#### A. Nhánh Văn Giai (`CIVIL` — 15 Phẩm trật, tối đa 192 ghế)
*(Bao gồm 3 ghế Tam thái ở Chính nhất phẩm dùng chung với Võ giai)*

| Thứ tự | Phẩm trật | Chi tiết Chức danh & Số ghế tối đa | Tổng ghế | Tầng phẩm cấp |
| :---: | :--- | :--- | :---: | :---: |
| 1 | **Chính nhất phẩm** | Thái sư (1), Thái phó (1), Thái bảo (1) *(Dùng chung Văn/Võ)* | **3** | Tối cao |
| 2 | **Tòng nhất phẩm** | Thái tử thái sư (1), Thái tử thái phó (1), Thái tử thái bảo (1) | **3** | Tối cao |
| 3 | **Chính nhị phẩm** | Thiếu sư (1), Thiếu phó (1), Thiếu bảo (1) | **3** | Tối cao |
| 4 | **Tòng nhị phẩm** | Thượng thư Lục bộ [Lại, Hộ, Lễ, Binh, Hình, Công] (6); Thái tử thiếu sư (1), Thái tử thiếu phó (1), Thái tử thiếu bảo (1) | **9** | Tối cao |
| 5 | **Chính tam phẩm** | Đô ngự sử (1) | **1** | Cao cấp |
| 6 | **Tòng tam phẩm** | Tả, Hữu Thị lang Lục bộ (12); Tả, Hữu Tôn chính phủ Tôn nhân (2); Tả, Hữu Xuân phường (2); Tả, Hữu Dục đức (2); Thừa tuyên sứ (4) | **22** | Cao cấp |
| 7 | **Chính tứ phẩm** | Hàn lâm viện thừa chỉ (1); Phó Đô ngự sử (1); Tả, Hữu Trung Doãn (2) | **4** | Cao cấp |
| 8 | **Tòng tứ phẩm** | Đông các đại học sĩ (1); Quốc tử giám tế tửu (1); Thông chính sứ (1); Tham chính (2) | **5** | Cao cấp |
| 9 | **Chính ngũ phẩm** | Hàn lâm viện thị đọc (2); Thiêm đô ngự sử (1); Tự khanh Lục tự (6); Thiêm sự (2); Phụng Thiên phủ doãn (1) | **12** | Trung cao |
| 10 | **Tòng ngũ phẩm** | Hàn lâm viện thị giảng (2); Đông các học sĩ (2); Quốc tử giám tư nghiệp (1); Tả, Hữu Thuyết thư (2); Tham nghị (2) | **9** | Trung cao |
| 11 | **Chính lục phẩm** | Hàn lâm viện thị thư (2); Đông các hiệu thư (2); Hiến sát sứ (4); Lang trung Lục bộ (6); Thiếu khanh Lục tự (6); Phụng Thiên thiếu doãn (1); Đoán sự các Vệ (4); Kinh lịch Ngũ phủ (5) | **30** | Trung thấp |
| 12 | **Tòng lục phẩm** | Hàn lâm viện đãi chế (2); Bí thư giám điển thư (2); Tả, Hữu Tư giản các vương phủ (4); Viên ngoại lang Lục bộ (6); Tri phủ (4) | **18** | Trung thấp |
| 13 | **Chính thất phẩm** | Hàn lâm viện hiệu lý (2); Đề hình giám sát ngự sử (2); Giám sát ngự sử 13 đạo (13); Đô cấp sự trung 6 khoa (6); Tự thừa Lục tự (6); Phụng Thiên hiệu úy (1); Hiến sát phó sứ (4); Trưởng sử các vương phủ (2) | **36** | Sơ cấp |
| 14 | **Tòng thất phẩm** | Hàn lâm viện kiểm thảo (3); Thông phán (4); Bí thư giám điển hàn (2); Tri huyện (8); Tri châu (4) | **21** | Sơ cấp |
| 15 | **Chính bát phẩm** | Tư Huấn tại Nho Lâm các và Tú Lâm cục (2); Cấp sự trung 6 khoa (6); Hàn lâm viện tu soạn (4); Quốc tử giám giáo thụ (4) | **16** | Sơ cấp |

#### B. Nhánh Võ Giai (`MILITARY` — 14 Phẩm trật, 161 lượt kê ghế)
*(Bao gồm 3 ghế Tam thái ở Chính nhất phẩm dùng chung với Văn giai)*

| Thứ tự | Phẩm trật | Chi tiết Chức danh & Số ghế tối đa | Tổng ghế | Tầng phẩm cấp |
| :---: | :--- | :--- | :---: | :---: |
| 1 | **Chính nhất phẩm** | Thái sư (1), Thái phó (1), Thái bảo (1) *(Dùng chung Văn/Võ)*; Thái úy (1) | **4** | Tối cao |
| 2 | **Tòng nhất phẩm** | Thiếu sư (1), Thiếu phó (1), Thiếu bảo (1); Tả, Hữu Đô đốc (2) | **5** | Tối cao |
| 3 | **Chính nhị phẩm** | Thiếu úy (1); Đô kiểm điểm (1); Đề đốc (2); Đô đốc đồng tri (2) | **6** | Tối cao |
| 4 | **Tòng nhị phẩm** | Đô đốc thiêm sự (2); Tả, Hữu Kiểm điểm (2); Tham đốc (2) | **6** | Tối cao |
| 5 | **Chính tam phẩm** | Đô chỉ huy sứ (2); Đô tổng binh sứ (2) | **4** | Cao cấp |
| 6 | **Tòng tam phẩm** | Đô chỉ huy đồng tri (4) | **4** | Cao cấp |
| 7 | **Chính tứ phẩm** | Đô chỉ huy thiêm sự (4); Chỉ huy sứ (4); Tổng binh thiêm sự (4) | **12** | Cao cấp |
| 8 | **Tòng tứ phẩm** | Chỉ huy sứ đồng tri (4); Tổng binh đồng tri (4); Đô tri (1) | **9** | Cao cấp |
| 9 | **Chính ngũ phẩm** | Chỉ huy thiêm sự (4); Lực sĩ hiệu úy (2); Phó đô tri (1); Tổng lĩnh (4); Quản lĩnh (4); Thiên hộ (6) | **21** | Trung cao |
| 10 | **Tòng ngũ phẩm** | Phó thiên hộ (6); Trung úy (4); Phó quản lĩnh (4) | **14** | Trung cao |
| 11 | **Chính lục phẩm** | Phó trung úy (4); Chánh võ úy (6); Bách hộ (8); Chánh đề hạt (4) | **22** | Trung thấp |
| 12 | **Tòng lục phẩm** | Đề hạt (6); Hiệu úy các nha (6); Kinh lược đồng tri (2); Phòng ngự sứ (4); Tả, Hữu Đề điệm (2) | **20** | Trung thấp |
| 13 | **Chính thất phẩm** | Phó võ úy (8); Phó đề hạt (6) | **14** | Sơ cấp |
| 14 | **Tòng thất phẩm** | Vệ úy (10); Phó vệ úy (10) | **20** | Sơ cấp |

#### C. Nhánh Hậu Cung (`HAREM` — 14 Cấp phẩm vị + Bậc Cung tuyển)
*(Phong hiệu như Mẫn, Như, Kính, Lệnh, Hiền, Thục, Huệ, Đức... là thuộc tính độc lập với Phẩm vị, được ban phong ngẫu nhiên khi đạt mốc)*

| Cấp | Phẩm vị | Số lượng ghế tối đa | Tầng phẩm cấp |
| :---: | :--- | :---: | :---: |
| **1** | **Hoàng hậu** | 1 | Tối cao |
| **2** | **Hoàng quý phi** | 1 | Tối cao |
| **3** | **Quý phi** | 2 | Tối cao |
| **4** | **Phi** | 4 | Cao cấp |
| **5** | **Tần** | 4 | Cao cấp |
| **6** | **Chiêu Nghi** | 5 | Trung cao |
| **7** | **Tu Nghi** | 5 | Trung cao |
| **8** | **Sung Nghi** | 5 | Trung cao |
| **9** | **Tiệp dư** | 10 | Trung thấp |
| **10** | **Dung hoa** | 15 | Trung thấp |
| **11** | **Tuyên vinh** | 20 | Sơ cấp |
| **12** | **Tài nhân** | Không giới hạn | Sơ cấp |
| **13** | **Lương nhân** | Không giới hạn | Sơ cấp |
| **14** | **Mỹ nhân** | Không giới hạn | Sơ cấp |
| **—** | **Cung tuyển** *(Khởi đầu)* | Không giới hạn | Sơ cấp |

#### D. Nhánh Nội Cung (`INNER_COURT` — 8 Cấp thuộc 7 Cục)
**Cấu trúc 7 Cục Nội đình:**
1. **Thượng cung cục (Quản lý hành chính):** Tư ký (văn thư, ấn tín), Tư ngôn (truyền chỉ dụ), Tư bộ (hồ sơ cung nhân, bổng lộc), Tư vi (cửa cung, chìa khóa).
2. **Thượng nghi cục (Nghi lễ & học thức):** Tư tịch (kinh sách), Tư nhạc (âm nhạc lễ nghi), Tư tân (tiếp kiến), Tư tán (tổ chức nghi lễ).
3. **Thượng phục cục (Y phục & bảo vật):** Tư bảo (bảo vật, phù tín), Tư y (y phục), Tư sức (trang sức), Tư trượng (nghi trượng).
4. **Thượng thực cục (Ẩm thực & dược liệu):** Tư thiện (ngự thiện), Tư uẩn (rượu, thức uống), Tư dược (dược liệu, thuốc bổ), Tư xí (lương thực, vật tư bếp).
5. **Thượng tẩm cục (Không gian sinh hoạt):** Tư thiết (bài trí), Tư dư (xe kiệu), Tư uyển (hoa viên), Tư đăng (đèn nến).
6. **Thượng công cục (Chế tác & tài chính):** Tư chế (may mặc), Tư trân (ngọc khí), Tư thái (vải vóc), Tư kế (kiểm kê tài vật).
7. **Cung chính ty (Kỷ luật nội đình — đơn vị chuyên trách không chia 4 tư):** Gồm **Cung chính** (đứng đầu), **Tư chính** (tra xét hồ sơ), **Điển chính** (tổng hợp chứng cứ). Có quyền mở cuộc tra xét khi nhân vật có `suspicion >= 80` (nhưng không được tự ý tuyên án giết hoặc phế truất người chơi khác khi chưa qua quy trình xét xử).

**Bảng 8 Cấp phẩm vị Nội cung:**

| Cấp | Danh vị / Chức vụ | Phẩm hàm tương ứng | Số lượng ghế tối đa | Tầng phẩm cấp |
| :---: | :--- | :---: | :---: | :---: |
| **1** | **Cung nữ sơ tuyển** | Không phẩm | Không giới hạn | Sơ cấp |
| **2** | **Cung nữ chính thức** | Không phẩm | Không giới hạn | Sơ cấp |
| **3** | **Nữ sử** | Không phẩm | Không giới hạn | Sơ cấp |
| **4** | **Chưởng quan** | Chính bát phẩm | 24 | Trung thấp |
| **5** | **Điển quan** | Chính thất phẩm | 25 | Trung cao |
| **6** | **Tư quan** | Chính lục phẩm | 25 | Trung cao |
| **7** | **Lục Thượng và Cung chính** | Chính ngũ phẩm | 7 | Cao cấp |
| **8** | **Tổng quản Lục cục** | Chính tứ phẩm | 1 | Tối cao |

*(Quy tắc rẽ nhánh Nội cung -> Hậu cung: Cung nữ/Nữ quan có thể giữ nguyên con đường Nữ quan lên đến Tổng quản Lục cục, hoặc nếu được Hoàng đế chú ý và sắc phong vào Hậu cung thì hủy bộ điều kiện Nữ quan hiện tại và sinh bộ điều kiện thăng từ Mỹ nhân lên Lương nhân theo quy tắc Hậu cung).*

---

### 5.2. Công thức Sinh 3 Điều kiện Thăng phẩm Ngẫu nhiên (Dynamic Promotion Requirement Generator)

Mỗi lần xét thăng lên phẩm cấp mục tiêu, hệ thống yêu cầu người chơi đạt đồng thời **đúng 3 điều kiện chỉ số**:
$$\text{isEligible} = (\text{Stat}_A \text{ đạt}) \land (\text{Stat}_B \text{ đạt}) \land (\text{Stat}_C \text{ đạt})$$

#### 1. Xác định Chỉ số A, B (Cố định) và Chỉ số C (Ngẫu nhiên)
- **Chỉ số A & B cố định theo nhánh:**

| Nhánh (`branch`) | Chỉ số A (Cố định) | Chỉ số B (Cố định) | 2 Chỉ số phát triển dài hạn còn lại (Ứng viên C1, C2) |
| :--- | :--- | :--- | :--- |
| **Văn giai** (`CIVIL`) | Tài Học (`int`) | Thanh Danh (`rep`) | Tín nhiệm (`fav`), Phong thái (`cha`) |
| **Võ giai** (`MILITARY`) | Tài Học (`int`) | Thanh Danh (`rep`) | Tín nhiệm (`fav`), Phong thái (`cha`) |
| **Nội cung** (`INNER_COURT`) | Tâm Kế (`int`) | Tín nhiệm (`fav`) | Quyền Thế (`rep`), Phong thái (`cha`) |
| **Hậu cung** (`HAREM`) | Thánh sủng (`fav`) | Quyền Thế (`rep`) | Tâm Kế (`int`), Dung mạo (`cha`) |

- **Chỉ số C chỉ có ba ứng viên:** `C1` 40%, `C2` 40%, Nghi Kỵ (`suspicion`) 20%; không trùng A/B. Cấu hình `THIRD_STAT_WEIGHTS = { C1: 40, C2: 40, SUSPICION: 20 }`.
- **Toán tử:** `>=` với `int`, `rep`, `fav`, `cha`; `<=` với `suspicion`.
- **Thể Lực và Ngân lượng không tham gia xét thăng phẩm dưới bất kỳ dạng nào**, không có điều kiện nền hay điều kiện thứ tư. Ngoại lệ: HP chỉ ảnh hưởng xác suất của hành động khảo hạch.

#### 2. Công thức Tính Ngưỡng `R` cho 4 Chỉ số Phát triển Dài hạn (`int`, `rep`, `fav`, `cha`)
Với mỗi phẩm cấp mục tiêu có điểm chuẩn `B` (Base Benchmark), ngưỡng thực tế `R` được tính theo công thức:
$$R = \text{RandomInteger}(B - D, \, B + D)$$

**Bảng biên độ dao động `D` theo điểm chuẩn `B`:**

| Mốc điểm chuẩn `B` | Biên độ `D` | Giới hạn hợp lệ (`Clamp`) | Ví dụ minh họa |
| :--- | :---: | :---: | :--- |
| **Điểm chuẩn âm (`B < 0`)** *(Chỉ áp dụng cho `fav`)* | `±5` | `[-100, 1000]` | `B = -20` $\rightarrow R \in [-25, -15]$ |
| **Dưới 100 (`0 <= B < 100`)** | `±5` | `[0, 1000]` *(hoặc `[-100, 1000]` với `fav`)* | `B = 70` $\rightarrow R \in [65, 75]$ |
| **Từ 100 đến 299 (`100 <= B <= 299`)** | `±10` | `[0, 1000]` | `B = 180` $\rightarrow R \in [170, 190]$ |
| **Từ 300 đến 699 (`300 <= B <= 699`)** | `±12` | `[0, 1000]` | `B = 500` $\rightarrow R \in [488, 512]$ |
| **Từ 700 trở lên (`B >= 700`)** | `±15` | `[0, 1000]` | `B = 900` $\rightarrow R \in [885, 915]$ |

**Ràng buộc toàn vẹn khi sinh ngưỡng `R`:**
1. **Không làm tròn:** Giữ nguyên giá trị số nguyên ngẫu nhiên (ví dụ `361`, `299`, `676`), tuyệt đối không làm tròn về bội số của 5 hay 10.
2. **Ràng buộc đơn điệu tăng (Monotonicity Constraint):** Ngưỡng `R` của phẩm cấp cao hơn đối với cùng một chỉ số bắt buộc phải **lớn hơn ít nhất 1 điểm** so với ngưỡng đã sinh ở phẩm cấp thấp hơn liền kề (`lowerBound = Math.max(B - D, previousRankR + 1)`), nhưng không được vượt quá `B + D` của cấp mục tiêu. Nếu cấu hình làm `lowerBound > upperBound`, hệ thống phải throw `ConfigurationError` chứ không được tự sinh giá trị vượt trần.

#### 3. Khoảng Nghi Kỵ theo tầng của phẩm MỤC TIÊU

Không dùng B ± D cho Nghi Kỵ. Sinh một số nguyên gồm cả hai đầu:

| Tầng | Nghi Kỵ tối đa (`suspicion <= R`) |
| :--- | :---: |
| Sơ cấp | 60–75 |
| Trung thấp | 45–60 |
| Trung cao | 30–45 |
| Cao cấp | 15–35 |
| Tối cao | 5–25 |

Khi sinh, nâng `R = max(R, min(100, suspicionFloor + 5))` để điều kiện không bất khả thi ngay lúc sinh. Nếu về sau sàn vượt R, đánh dấu `unreachable`, hiển thị cảnh báo và TODO(spec). Nếu chỉ Nghi Kỵ hiện tại vượt R thì gợi ý dùng hành động giảm Nghi Kỵ, không xem là bất khả thi. Không công khai giá trị Nghi Kỵ hiện tại hoặc sàn.

#### 4. Quy tắc Khóa & Lưu trữ Điều kiện Thăng phẩm (Condition Locking)
- Ngay khi nhân vật nhận một phẩm cấp, máy chủ tự động sinh bộ 3 điều kiện cho phẩm cấp tiếp theo và lưu vào Database gắn chặt với `(character_id, target_rank_id)`.
- Đăng xuất, tải lại trang, đổi thiết bị hoặc trượt khảo hạch **không làm thay đổi** bộ điều kiện đã sinh.
- Không có tính năng dùng Ngân lượng hay Thiên Mệnh để quay lại (reroll) điều kiện thăng phẩm.
- Ngoài 3 điều kiện chỉ số (`A, B, C`), hệ thống kiểm tra độc lập các điều kiện: thời gian tại vị tối thiểu, công trạng, vượt khảo hạch, không trong trạng thái bị tra xét và **còn ghế trống** (đối với các chức danh hữu hạn ghế).

### 5.3. Điều kiện ngoài chỉ số và quy tắc tranh ghế (Chặng 3A/3B)

- Ngoài **đúng ba điều kiện chỉ số**, kiểm tra độc lập: thời gian tại vị tối thiểu theo ngày game, công trạng tích lũy trong kiếp, khảo hạch còn hiệu lực, không bị tra xét (`suspicion >= 80`), và còn ghế trống. Đây không phải chỉ số thứ tư.
- Chặng 3A sinh/khóa điều kiện `table_version = 'v1'`, cộng công trạng có hạn mức theo tài khoản/ngày thực, khảo hạch và hiển thị tiến trình; `seatAvailable = 'UNKNOWN'`. Không nộp đơn, không thăng phẩm hoặc cấp ghế. Nhân vật cũ giữ nguyên điều kiện đã lưu.
- Phẩm khởi đầu chuẩn (Chính bát phẩm Văn giai, Tòng thất phẩm Võ giai, Cung tuyển, Cung nữ sơ tuyển) **không áp ngưỡng nhập phẩm**, giữ nguyên phân phối mục 4.1. Nếu kịch bản cho khởi đầu ở phẩm cao hơn, chỉ nâng `int/rep/fav/cha` lên cận dưới `B-D` (clamp hợp lệ) của hàng đó; không nâng HP, bạc hoặc Nghi Kỵ.
- Bảng chuẩn chính thức v1 nằm trong `src/config/promotionBenchmarks.ts`. Kiểm tra cấu hình khi nạp: đủ tầng, ánh xạ đúng phẩm/nhánh, và với từng chỉ số phát triển, cận dưới phẩm mục tiêu kế tiếp phải **lớn hơn** cận trên phẩm mục tiêu liền trước. Hàng khởi đầu không sinh R; ngoại lệ này giữ nguyên điểm chạm biên của Cung tuyển/Mỹ nhân (TODO(spec)). Phẩm cao nhất không sinh điều kiện tiếp.
- **Tranh ghế (chỉ ghi đặc tả, triển khai Chặng 3B):** ưu tiên tổng mức vượt ngưỡng chuẩn hóa của ba điều kiện: với `>=`, `(current - R) / max(1, abs(R))`; với Nghi Kỵ `<=`, `(R - current) / max(1, R)`. Người vượt ngưỡng nhiều xếp trước người sát ngưỡng. Hòa thì công trạng cao hơn, tiếp đến thời điểm nộp đơn sớm hơn. Chốt trong giao dịch có khóa để không cấp trùng ghế.


### 5.4. Ghế và thực thi thăng phẩm (Chặng 3B)

- Pool theo nhánh + phẩm, sức chứa đúng mục 5.1; Tam Thái Chính nhất phẩm dùng một pool 3 ghế chung Văn/Võ, Thái úy một ghế riêng Võ giai. Cung tuyển/Mỹ nhân/Lương nhân/Tài nhân và ba cấp đầu Nội cung không giới hạn. `RESERVED_SEATS_FOR_NPC` theo pool mặc định 0. Phẩm khởi đầu không chiếm hoặc bị giới hạn ghế.
- Nhân vật ACTIVE, đủ điều kiện cá nhân 3A có thể nộp đơn ngay cả khi hết ghế; mỗi nhân vật tối đa một đơn WAITING. Bệnh nặng không nộp; phẩm cao nhất không có đơn. APPLY tạm 1 AP, cap2/tài khoản/ngày Việt Nam; rút miễn phí. Pool không giới hạn thăng ngay trong giao dịch nộp; pool hữu hạn chờ phiên.
- Phiên tại mỗi ranh giới 7 ngày game, lazy khi request chạm thế giới, idempotent và xử lý tuần tự nếu bỏ lỡ. Đơn chỉ vào phiên đầu tiên sau nộp; hết hạn sau 28 ngày game (TEMP). Mỗi phiên: hết hạn → kiểm tra lại chỉ số/tại vị/merit/exam/tra xét/ACTIVE → xếp hạng → cấp ghế; không đạt REJECTED kèm lý do, người thua giữ WAITING.
- Xếp theo tổng vượt ngưỡng chuẩn hóa mục 5.3, hòa thì merit cao hơn, nộp sớm hơn, rồi id nhỏ hơn. Giao dịch khóa thế giới/pool/nhân vật theo thứ tự cố định, kiểm tra revision và ghế còn trống. Thắng thì trả ghế cũ, đổi rank và mốc tại vị, xóa exam, sinh/khóa điều kiện kế tiếp có kiểm tra R cũ; phẩm cao nhất không sinh. Ghi lịch sử và nhật ký riêng, chưa có nhật ký toàn triều.
- Quan chế chỉ trả số ghế/tổng/còn trống/đơn chờ cho mỗi phẩm, được xem nhánh khác nhưng không trả danh tính người chơi. `releaseSeats(characterId)` phục vụ Chặng 5; chưa cài tử vong.
- Chuyển Nội cung sang Hậu cung chỉ có hàm thuần và RPC service_role, không endpoint/nút: cấp2–6, cha>=150, int>=100, suspicion<=45. Cấp2–4 nhận Mỹ nhân, cấp5–6 nhận Lương nhân; fav mới=min(120,floor(.35*fav cũ)+25). Giữ int/rep/cha/hp/bạc/suspicion/sàn/merit; reset tại vị, xóa exam, rút đơn, trả ghế Nội cung, hủy hiệu lực điều kiện Nữ quan và sinh bộ Hậu cung kế tiếp. Kích hoạt thật để Chặng 4.

---

## 6. QUY TẮC TỬ VONG, TRÙNG SINH, ĐIỂM THIÊN MỆNH & XẾP HẠNG CUỐI MÙA

### 6.1. Điều kiện Tử vong & Cơ chế Tuổi thọ
- **6 Nguyên nhân Tử vong:**
  1. Tuổi già (Lão tử).
  2. Thể Lực (`hp`) về `0` và không đủ điều kiện/Ngân lượng mời Ngự y chữa trị.
  3. Thất bại trong một sự kiện **Đại kiếp nạn** (`GREAT_CALAMITY`) có kết cục tử vong.
  4. Bị kết án tử hình qua quy trình xét xử của Đô sát viện / Bộ Hình / Cung chính ty.
  5. Bị người chơi khác hoặc NPC hãm hại thành công trong chuỗi sự kiện ám sát/đầu độc.
  6. Các biến cố sinh tử khác trong kho sự kiện.
- **Mốc Tuổi thọ Nhân vật:**
  - Tuổi khởi đầu mỗi kiếp: `RandomInteger(16, 21)`.
  - Tuổi tăng theo năm của đồng hồ thế giới (`currentGameYear`).
  - **Từ 55 tuổi:** Bắt đầu xuất hiện sự kiện suy giảm sức khỏe.
  - **Từ 65 tuổi:** Xác suất gặp bệnh nặng và biến cố tuổi già tăng cao.
  - **Từ 80 tuổi:** Nguy cơ tử vong rất cao ở mỗi đầu năm/tháng nhưng không bắt buộc chết ngay lập tức.

### 6.2. Quy trình Trùng sinh trong Cùng Mùa giải (Reincarnation Pipeline)
Tử vong là vĩnh viễn đối với nhân vật hiện tại, nhưng tài khoản được phép **trùng sinh không giới hạn số kiếp** khi mùa giải vẫn đang diễn ra:
1. Kết thúc cuộc đời nhân vật hiện tại (`status = 'DECEASED'`).
2. Ghi lưu lịch sử cuộc đời (`character_history`): Thân phận, chức vị cao nhất đạt được, tuổi thọ, điểm thành tựu cuộc đời (`life_score`) và nguyên nhân tử vong.
3. **Thu hồi toàn bộ ghế chức vụ**, quyền hạn và vị trí nhân vật đang nắm giữ trên bảng quan chức / Lục viện để giải phóng ghế cho thế giới chung.
4. Xóa toàn bộ `characterSilver`, vật phẩm, chứng cứ, chỉ số cá nhân, tiến trình nhiệm vụ và quan hệ cá nhân của kiếp cũ.
5. Bảo lưu Điểm Thiên Mệnh (`destinyPoints`) và lịch sử thành tích của tài khoản.
6. Mở giao diện **Trùng sinh (Tạo nhân vật mới)** ngay trong niên lịch hiện tại của triều đại.

**Bảng đối chiếu Trạng thái Dữ liệu khi Trùng sinh:**

| Nhóm Dữ liệu | Trạng thái khi Trùng sinh | Ghi chú Kỹ thuật |
| :--- | :---: | :--- |
| Tài khoản, Tên đăng nhập, Điểm Thiên Mệnh (`destinyPoints`) | **Giữ nguyên** | Cấp Account (`accounts` table). |
| Lịch sử các cuộc đời & Kỷ lục điểm cao nhất mùa (`best_life_score`) | **Lưu trữ** | Dùng để xét Bảng xếp hạng cuối mùa. |
| Niên lịch triều đại & Kết quả biến cố toàn triều / Trạng thái NPC thế giới | **Giữ nguyên (Không rollback)** | Nếu kiếp trước người chơi đã lật đổ 1 NPC đại thần, NPC đó vẫn mất chức ở kiếp sau. |
| Chỉ số nhân vật, Thân phận, Xuất thân, Tuổi khởi đầu (16–21) | **Random lại** | Khởi tạo thực thể `character` mới. |
| Phẩm cấp, Chức vụ, Quan hệ NPC/Player, Nhiệm vụ cá nhân | **Reset toàn bộ** | Bắt đầu lại từ phẩm cấp khởi đầu. |
| Ngân lượng kiếp cũ (`characterSilver`), Vật phẩm, Chứng cứ | **Xóa toàn bộ (`0`)** | Không thừa kế tài sản giữa các kiếp. |

### 6.3. Hệ thống Điểm Thiên Mệnh (`destinyPoints`)
- **Bản chất:** Tài nguyên cấp Tài khoản (`account.destinyPoints`), giá trị khởi đầu `= 0`, không giới hạn trần tích lũy, **tồn tại vĩnh viễn xuyên kiếp và xuyên các mùa giải** (không bị reset khi nhân vật chết hay khi kết thúc triều đại).
- **2 Nguồn nhận duy nhất:**
  1. **Vượt qua Đại kiếp nạn (`GREAT_CALAMITY`):**
     - Thưởng **+1 Điểm Thiên Mệnh** ngay khi đạt kết cục thành công của một Đại kiếp nạn (nếu sự kiện có nhiều giai đoạn thì chỉ thưởng 1 lần sau khi hoàn thành toàn bộ giai đoạn cuối).
     - **Quy tắc chống farm trùng (Anti-Exploit):** Tạo bảng `account_calamity_claims(account_id, season_id, calamity_code)`. Mỗi mã `calamity_code` chỉ thưởng Thiên Mệnh **tối đa 1 lần cho mỗi tài khoản trong cùng một mùa giải**, ngăn chặn hành vi cố tình tự sát và trùng sinh để cày lại cùng một Đại kiếp nạn.
  2. **Phần thưởng Xếp hạng Cuối mùa:** Phân phát khi đóng mùa giải theo Bảng thưởng mục 6.4.

### 6.4. Kết thúc Mùa giải, Bảng Xếp Hạng & Phần thưởng Cuối mùa
- **Quy tắc tính điểm Xếp hạng (Chống cày nhiều kiếp cộng dồn):**
  - Mỗi tài khoản chỉ có **1 thứ hạng chính** trong một mùa giải.
  - Điểm xếp hạng mùa của tài khoản được tính bằng **Điểm thành tựu cao nhất của một cuộc đời đơn lẻ** trong mùa đó:
    $$\text{AccountSeasonScore} = \max_{i \in \text{LivesInSeason}} (\text{LifeScore}_i)$$
    *(Tuyệt đối không cộng dồn tổng điểm của nhiều kiếp trùng sinh để tránh mất cân bằng).*
  - Điểm thành tựu (`LifeScore`) được tính tổng hợp từ: Phẩm cấp/chức vụ cao nhất đạt được, công trạng, số Đại kiếp nạn vượt qua, và số trận đấu trí chiến thắng (không chỉ dựa trên ngân lượng hay số AP đã tiêu).
  - Hệ thống có các bảng thống kê theo **Ngày**, **Tuần**, **Tháng** (thời gian thực) và **Mùa**, nhưng **chỉ trao thưởng 1 lần duy nhất dựa trên bảng tổng kết chính khi kết thúc Mùa/Tháng**, không trao trùng phần thưởng nếu dẫn đầu nhiều bảng.

- **Bảng Phần thưởng Tổng kết Cuối mùa:**

| Thứ hạng Chung cuộc | Thưởng Điểm Thiên Mệnh (`+destinyPoints`) | Thưởng Ngân lượng Khởi đầu (`+pendingRewardSilver`) |
| :--- | :---: | :---: |
| **Top 1** | **+8** | **+200** |
| **Top 2 – 3** | **+6** | **+150** |
| **Top 4 – 10** | **+4** | **+100** |
| **Top 11 – 25** | **+3** | **+60** |
| **Top 26 – 50** | **+2** | **+30** |
| **Ngoài Top 50** *(Có tham gia hợp lệ)* | **+1** | **+10** |

- **Quy trình 10 Bước Đóng Mùa giải (Season End Cron/Trigger):**
  1. Khóa toàn bộ hành động tiêu tốn AP thuộc triều đại cũ (`season.status = 'ENDED'`).
  2. Chốt toàn bộ dữ liệu xếp hạng của mọi tài khoản (bao gồm cả nhân vật đã tử vong).
  3. Tổng kết lịch sử các cuộc đời của từng tài khoản trong mùa.
  4. Xác định thành tích, thân phận và chức vụ cao nhất của mỗi người chơi.
  5. Cộng trực tiếp phần thưởng **Điểm Thiên Mệnh** vào `account.destinyPoints`.
  6. Ghi nhận phần thưởng **Ngân lượng** vào `account.pendingRewardSilver` (để chờ cộng khi xác nhận nhân vật ở mùa mới; không cộng vào nhân vật cũ và không quy đổi thành Thiên Mệnh).
  7. Lưu trữ Bảng xếp hạng mùa và Bảng vàng danh dự (Hall of Fame).
  8. Chuyển toàn bộ nhân vật của triều đại cũ sang trạng thái lưu trữ (`ARCHIVED`).
  9. Khởi tạo triều đại/mùa giải mới (`new season_start_timestamp`, chọn kịch bản không trùng mùa vừa đóng).
  10. Mở giao diện tạo nhân vật mới cho người chơi bước vào mùa tiếp theo.

---

## 7. HỆ SINH THÁI LIÊN KẾT 3 NHÁNH & QUY TẮC NGHIỆP VỤ CỐT TRUYỆN

1. **Tương tác chéo Ngoại triều – Nội cung – Hậu cung ("Hiệu ứng Gợn sóng qua Rèm châu"):**
   - **Chiều Ngoại triều $\rightarrow$ Hậu cung ("Vinh Nhục Mẫu Tộc" - Ảnh hưởng 10%–15%):** Mỗi nhân vật Hậu cung có liên kết Mẫu tộc / Đồng minh Quan lại ở Tiền triều. Khi Mẫu tộc thăng phẩm hoặc lập công, Phi tần nhận `+10..20 rep` và `+25 characterSilver`. Nếu Mẫu tộc bị Đô sát viện đàn hặc/giáng chức, Phi tần không bị giáng cấp theo nhưng bị `-15 rep`.
   - **Chiều Hậu cung $\rightarrow$ Ngoại triều ("Gió Thoảng Bên Gối" - Giới hạn nghiêm ngặt):**
     - Từ bậc **Chiêu Nghi (Cấp 6)** trở lên và có `fav >= 300`, mỗi tháng được dùng 1 lần hành động hỗ trợ gia tộc/đồng minh Quan lại (`+10 fav`, `+10 rep` hoặc `-5 suspicion` cho quan lại đó).
     - Việc mở tiệc, đặt may y phục của bậc Tần/Phi/Quý Phi tự động sinh nhiệm vụ *"Cấp phát ngân lượng / Kiểm kê vật tư"* cho nhánh **Quan lại (Bộ Hộ, Bộ Lễ)** và **Nội cung (Thượng phục cục, Thượng công cục)**.
   - **Luật cấm "Hậu cung bất đắc can chính":** Phi tần tuyệt đối không được xem tấu sớ quân cơ hay bổ nhiệm/cách chức quan viên. Nếu cố tình can dự chính sự (xin tha tội tham ô/mưu phản cho quan lại hoặc bàn chuyện Chiêu Thân Vương):
     - Nhị phẩm trở lên (`fav >= 800`): Bị trừ `-60 fav`, `+20 suspicion`, cấm túc 2 tháng.
     - Dưới Nhị phẩm đến Tam phẩm (`fav >= 600`): Bị trừ `-60 fav`, `+25 suspicion`, cấm túc 1 tháng.
     - Dưới Tam phẩm (`fav >= 700`): Bị trừ `-100 fav`, `+30 suspicion`, cấm túc 1–2 tháng.
     - Các trường hợp còn lại: Bị phế truất làm thường dân (50%) hoặc tống vào lãnh cung (50%).

2. **Thế lực & Phe phái Trung tâm (Kịch bản chuẩn Triều Thiên Nguyên - Đại Khánh):**
   - **Phe Hoàng Thượng (Càn Nguyên Đế - Tân Chính & Pháp Trị):** Trọng dụng người có `int` cao, `suspicion` thấp (NPC tiêu biểu: Đô Ngự Sử / Phó Đô Ngự Sử Bùi Kính, Vũ Thiên Lân, Cung Chính Hàn Tố Tâm, Lương Cửu). Nếu người chơi có hảo cảm quá cao với Thái Hậu hoặc Thân Vương, mỗi lần diện kiến Vua tự động bị cộng ngầm `+5 suspicion`.
   - **Thế lực Cung Từ Ninh / Trường Xuân (Đoan Hoàng Thái Hậu - Trung lập / Cán cân):** Nắm quyền kiểm soát hệ thống thăng chức **7 Cục Nội cung** (qua Tổng quản Lục cục Nghiêm Cô Cô / Nghiêm Mama) và quyền phủ quyết tra xét của **Cung chính ty**.
   - **Phe Thân Vương (Chiêu Thân Vương - Tôn Thất & Hàn Môn Nghĩa Sĩ):** Bảo trợ người chơi xuất thân **Bình dân** hoặc quan viên cấp thấp qua hệ thống chức vụ **Vương phủ** (NPC tiêu biểu: Trần Nguyên Hạo, Nguyễn Khắc Minh, Lâm Tư Thiện), hỗ trợ nhiều `characterSilver`, tăng nhanh `rep` và gánh tội giảm `suspicion`.
   - **Phe Thái Phó (Tạ Đình Nghi - Tập đoàn Thế Gia):** Bảo trợ người chơi xuất thân **Thế gia**, chi phối khảo hạch Văn giai trung–cao cấp và ngân khố Bộ Hộ (NPC tiêu biểu: Tạ Hoằng, Lê Bá Quát, Quách Quỳ, Hồ Mặc); mở khóa lựa chọn hối lộ/biển thủ tăng nhanh `characterSilver` và `rep` nhưng làm tăng `suspicion`.
