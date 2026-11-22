# Đường ống mô hình 3D — G1

Cảnh hiện tại dùng hình khối tự tạo, không cần tải GLB hay texture. Tài nguyên 3D chỉ là nền;
chữ, hotspot, thao tác và kết quả game vẫn là HTML. Xem `src/3d/PalaceRoom.tsx` để thay từng slot,
`src/3d/assets.ts` để đăng ký file, loại, đường dẫn và ngân sách. Không thay logic game để nạp mô hình.

## Ngân sách và quy ước

| Loại | Tam giác tối đa/model | GLB tối đa | Texture tối đa |
| --- | ---: | ---: | ---: |
| Kiến trúc (để mở rộng sau G1) | 40.000 | 8 MiB | 1024 × 1024 |
| Nội thất: bình phong, sập, bàn | 8.000 | 2 MiB | 1024 × 1024 |
| Trang trí: bình hoa, đèn lồng | 2.000 | 1 MiB | 512 × 512 |

Toàn cảnh **dưới 100.000 tam giác**, tính cả số lần nhân bản (đèn có hai chiếc). Ngân sách model
không tự cho phép vượt ngân sách cảnh. Khi vượt texture/tam giác lúc nạp, trả về 2D. Script kiểm
tra byte/registry/credits/GLB header, không thay việc kiểm topology/UV/giấy phép bằng mắt.

- Đơn vị mét; +Y hướng lên, mặt trước nhìn về +Z. Gốc tại tâm chân đế, đáy y=0.
- Tên ASCII chữ thường, snake_case; tên file cố định `screen.glb`, `seat.glb`, `table.glb`,
  `vase.glb`, `lantern.glb`. Tên node/material rõ nghĩa, không nhúng thông tin cá nhân.
- Kích thước tham chiếu: bình phong rộng2.2m/cao2.2m; sập2.5×1.05m/cao1.4m;
  bàn1.3×0.8m/cao0.75m; bình cao0.9m; đèn cao0.9m, gốc tâm đèn (ngoại lệ slot treo).
- Dùng vật liệu PBR đơn giản, màu son/vàng/nâu gỗ/giấy ngà. Ưu tiên atlas và ít material (1–3).
  Đèn dùng emissive, không tạo point light riêng. Không skin, animation, camera hay light trong GLB G1.
- Không URL bên ngoài, không texture rời; nhúng vào GLB. Texture sRGB cho baseColor/emissive;
  normal/roughness/metalness là dữ liệu tuyến tính. Không texture vượt ngân sách dù có nén.

## Xuất từ Blender

1. Scene Units: Metric, Unit Scale1.0. Áp dụng Scale/Rotation, xóa mesh/camera/light không dùng.
2. Sửa normal, xóa mặt ẩn và hình học trùng; triangulate khi xuất để đo đúng. Đưa origin vào slot đã nêu.
3. Kiểm tra Decimate/UV/atlas, số material và số tam giác trong Statistics; xem silhouette ở màn hình nhỏ.
4. Export glTF2.0 → GLB, Selected Objects, +Y Up, apply modifiers. Không xuất animation/skin.
5. Nén tùy chọn bằng công cụ offline rồi kiểm tra lại GLB, giấy phép và hình ảnh. Không cần nén mẫu procedural.
6. Đặt vào `public/models`, đăng ký cấu hình và credits, chạy `npm run check:models`, `npm run build`.
   `predev`/`prebuild` tạo manifest file có thật; không có file thì slot dùng hình khối, không dò404/CDN.

## Nén tùy chọn

- **Meshopt**: loader tích hợp từ bản three đã ghim; bật `compression.meshopt` trong registry. Không tải CDN.
- **Draco**: bật `compression.draco`; tự host `draco_wasm_wrapper.js`, `draco_decoder.wasm` đúng phiên bản
  tại `public/models/decoders/draco/`. Worker tối đa1; ghi nguồn/version/LICENSE phần mềm decoder.
- **KTX2/Basis**: bật `compression.ktx2`; tự host `basis_transcoder.js`, `basis_transcoder.wasm` tại
  `public/models/decoders/basis/`. Loader detectSupport(renderer), worker tối đa1. Giữ LICENSE phần mềm.
- Không ghi decoder URL của dịch vụ bên ngoài vào ứng dụng. Script chặn cấu hình Draco/KTX2 thiếu file.
  G1 có đường nạp nhưng **chưa có fixture GLB nén thật để kiểm chứng cả ba định dạng**.

## Checklist giấy phép bắt buộc

- [ ] Tự tạo hoặc CC0; không dùng nhãn “free download” làm bằng chứng. Không tài nguyên không rõ tác giả/quyền.
- [ ] Kiểm cả mesh, texture và tài nguyên phụ; lưu đường dẫn nguồn và bằng chứng CC0.
- [ ] `public/models/CREDITS.md`: đúng filename, nguồn, tác giả, giấy phép, link, ngày ISO. Không TODO/ô trống.
- [ ] Nếu tự tạo: xác nhận quyền với mọi thành phần; không trộn texture chưa có phép vào mô hình tự tạo.
- [ ] Decoder là phần mềm có giấy phép riêng (Draco/Basis Apache-2.0, Meshopt MIT), phải giữ thông báo tương ứng.
- [ ] Thử trên mobile thật, 2D, WebGL lỗi, low/medium/high; rà bộ nhớ khi đổi qua lại và GPU context loss.

## Chất lượng và đo lường

Low DPR1; Medium/High tối đa1.5. Chỉ High có bóng PCF mềm đơn giản512px; ánh sáng gồm một hemisphere
và một directional. Khởi động đo khung hình theo hai cửa sổ2s, giảm chất lượng khi tụt kéo dài.
Dao động camera rất nhẹ chỉ6s sau mở/3s sau tương tác; tắt với reduced-motion. Khi đứng yên dùng demand,
khi ẩn tab/ngoài viewport/tab Sân khấu mobile không hiển thị dùng never. Không có render loop vô hạn.

Chạy dev, thêm `?debug3d=1`: FPS, tam giác hình học, tam giác thực vẽ (gồm shadow pass), draw calls.
Production không có bảng debug dù có query. FPS chỉ có ý nghĩa khi đang vẽ, không phải lúc demand đã nghỉ.
`npm run measure:3d` sau build báo tổng gzip các chunk dành riêng cho dynamic PalaceCanvas;
không tính shared React/Next, model/decoder chưa phân phối, không tính gzip như thời gian tải mạng thực.
