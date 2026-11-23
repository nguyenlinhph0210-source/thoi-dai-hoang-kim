# Phông chữ tự host — H1.1

| Font | Tác giả / nguồn | Giấy phép | Phiên bản lấy về | Ngày |
| --- | --- | --- | --- | --- |
| Be Vietnam Pro 400/600 | [Be Vietnam Pro Project Authors](https://github.com/bettergui/BeVietnamPro), [Google Fonts](https://github.com/google/fonts/tree/main/ofl/bevietnampro) | [SIL OFL-1.1](Be-Vietnam-Pro-OFL.txt) | Google Fonts CSS v12, WOFF2 vietnamese/latin-ext/latin | 2026-11-24 |
| Noto Serif 500/600 | [Noto Project Authors](https://github.com/notofonts/latin-greek-cyrillic), [Google Fonts](https://github.com/google/fonts/tree/main/ofl/notoserif) | [SIL OFL-1.1](Noto-Serif-OFL.txt) | Google Fonts CSS v33, variable WOFF2 vietnamese/latin-ext/latin | 2026-11-24 |

Tệp từ fonts.gstatic.com, được lưu cục bộ theo tên trong `src/ui/fonts.css`. Noto Serif dùng cùng tệp variable
cho hai trọng lượng; không nhân đôi byte. Giữ nguyên tên font và copyright/OFL đi kèm.
Build/trình duyệt không gọi Google Fonts hoặc CDN. Subset `vietnamese` gồm U+1EA0–1EF9 và các chữ Ă/Đ/Ơ/Ư;
latin/latin-ext bổ sung chữ cơ bản, ký hiệu và dấu. Kiểm tra NFC toàn bộ src, không thay dấu bằng ASCII.
