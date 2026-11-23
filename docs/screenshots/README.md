# H1.1 — ảnh trước và sau

Ảnh Playwright/Chromium trên InMemory, viewport **390×844** và **1440×900**, DPR1,
reduced-motion bật, JPEG82. Trước: main `9407b2b` (H1), checkout riêng. Sau: nhánh H1.1,
production build. Không chỉnh sửa ảnh, không ảnh stock hay mô hình ngoài.
Mỗi lượt tạo tài khoản/nhân vật hư cấu mới nên tuổi/chỉ số/xuất thân có thể khác;
không coi các khác biệt ngẫu nhiên này là thay đổi luật. Không seed qua endpoint production.

| Màn hình | Mobile trước | Mobile sau | Desktop trước | Desktop sau |
| --- | --- | --- | --- | --- |
| Sân khấu | [Trước](before/mobile-stage.jpg) | [Sau](after/mobile-stage.jpg) | [Trước](before/desktop-stage.jpg) | [Sau](after/desktop-stage.jpg) |
| Y phục | [Trước](before/mobile-wardrobe.jpg) | [Sau](after/mobile-wardrobe.jpg) | [Trước](before/desktop-wardrobe.jpg) | [Sau](after/desktop-wardrobe.jpg) |
| Cung viện | [Trước](before/mobile-chamber.jpg) | [Sau](after/mobile-chamber.jpg) | [Trước](before/desktop-chamber.jpg) | [Sau](after/desktop-chamber.jpg) |
| Hồ sơ | [Trước](before/mobile-profile.jpg) | [Sau](after/mobile-profile.jpg) | [Trước](before/desktop-profile.jpg) | [Sau](after/desktop-profile.jpg) |
| Tạo nhân vật | [Trước](before/mobile-setup.jpg) | [Sau](after/mobile-setup.jpg) | [Trước](before/desktop-setup.jpg) | [Sau](after/desktop-setup.jpg) |
| Đăng nhập | [Trước](before/mobile-login.jpg) | [Sau](after/mobile-login.jpg) | [Trước](before/desktop-login.jpg) | [Sau](after/desktop-login.jpg) |

Thử đồ chưa mua: [mobile](after/mobile-tryon.jpg), [desktop](after/desktop-tryon.jpg).
Nền2D phân lớp: [mobile](after/mobile-2d.jpg), [desktop](after/desktop-2d.jpg).
Y phục mobile mở đầy, cuộn đến thẻ đầu để thấy hình; chạm hình rồi thu gọn cuộn thư để xem toàn nhân vật.
Nếu SwiftShader tự hạ về2D trong lúc chụp, script chọn lại3D Thấp qua cài đặt trước ảnh3D; không tắt policy tự hạ.
Những ảnh này dùng dữ liệu nhân vật thật trong Memory; fixture hiển thị tối đa dùng cho phép đo
tam giác không được dùng làm ảnh trước/sau.

## Chụp lại

Chạy một server InMemory cục bộ (đặt GAME_REPOSITORY=memory, ALLOW_IN_MEMORY=true,
COOKIE_SECURE=false), không dùng Supabase thật. `scripts/capture-interface.cjs` dùng
`/usr/bin/chromium`, GPU phần mềm SwiftShader và tài khoản thử riêng.

```sh
node scripts/capture-interface.cjs before 3102
node scripts/capture-interface.cjs after 3113
```

Server3102 là checkout main H1 trong worktree riêng,3113 là production build H1.1.
Không chạy dev và build cùng `.next`. Ảnh/chỉ số không khẳng định hiệu năng điện thoại thật.
