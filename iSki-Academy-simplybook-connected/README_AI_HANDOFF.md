# iSki Academy — Ghi chú bàn giao AI

## Trạng thái hiện tại

Đây là source React + TypeScript + Vite của iSki Academy, nội dung website công khai bằng tiếng Anh cho khách quốc tế tại Kopaonik, Serbia, mùa đông 2026–2027. Website dùng nhận diện iSKI hiện có, ưu tiên booking enquiry, mobile-first và chuyển khách sang WhatsApp.

Phase 1 đã hoàn tất: website công khai, 13 route prerender, SEO, analytics hooks và luồng chuyển khách sang SimplyBook.me. Mã Phase 2 cũng đã có trong source: Node.js API, managed MySQL, authentication cho nhân viên, availability theo instructor và múi giờ Serbia, booking transaction, admin dashboard và mail outbox. Tuy nhiên các việc vận hành còn chờ owner: tạo tài khoản đầu tiên, nhập roster/ca/mùa/sức chứa thực tế, cấu hình Resend và kiểm thử end-to-end sau cấu hình. Không mở public booking cho đến khi owner hoàn thành các bước này và readiness phù hợp.

Preview/build/checkpoint không tự chứng minh website đã được phát hành production. Trước khi thông báo khách có thể đặt, kiểm tra trạng thái Publish và domain trong Webdev Dashboard. Không tự bật auto-publish.

## Lệnh phát triển và build

- Package manager được pin trong `package.json` là pnpm 11.25.0.
- Cài dependency đúng lockfile: `pnpm install --frozen-lockfile`.
- Chạy Preview: `pnpm dev` trên port 3000.
- Kiểm tra TypeScript: `pnpm typecheck`.
- Unit tests an toàn: `pnpm test`; các test hiện tại tập trung vào lịch, timezone và authentication, không tạo booking khách hàng.
- Build production: `pnpm build`. Lệnh build React và prerender 13 trang công khai, admin shell cùng trang 404.
- Build Webdev dùng `pnpm install --frozen-lockfile && pnpm build`, output `dist`.
- API health endpoint: `GET /api/health`; đây là health path khai báo cho server.

## Cấu trúc chính

- `src/App.tsx`: nội dung các trang công khai, navigation, Footer và route resolution.
- `src/BookingForm.tsx`, `src/AvailabilityCalendar.tsx`: booking form, availability theo ngày/giờ và kết nối API công khai.
- `src/SiteAudioControls.tsx`, `src/site-audio.css`: điều khiển ambience và click effect trên các route công khai; không render trong `/admin`.
- `src/admin/`: login, booking dashboard, quản lý instructor, cài đặt và lịch admin.
- `src/analytics.ts`: optional GA4/GTM/Meta Pixel loader và conversion events; không tự tạo credentials.
- `src/seo.ts`, `src/render.tsx`, `scripts/prerender.mjs`: metadata theo route, structured data và prerender.
- `server.mjs`, `server/app.mjs`, `server/routes/`: Node server, API router và public/admin API.
- `server/auth.mjs`, `server/availability-core.mjs`, `server/booking-service.mjs`, `server/admin-service.mjs`, `server/mail.mjs`: authentication, lịch, giao dịch booking, nghiệp vụ admin và email outbox.
- `db/migrations/001_phase2.sql`: schema Phase 2.
- `public/manus-routes.json`, `public/sitemap.xml`, `public/robots.txt`: route manifest và SEO discovery.
- `public/assets/`: logo, ảnh và hai MP3 đang dùng.
- `app.config.ts`: logo metadata của project trên nền tảng.
- `TODO.md`, `plan.md`, `PRODUCT_REQUIREMENTS.md`: acceptance outcomes, lộ trình và brief gốc.

## Các trang công khai

`/`, `/families`, `/kids`, `/adults`, `/performance`, `/book`, `/partners`, `/contact`, `/about/igor-andric`, `/gallery`, `/plan-your-visit`, `/prices` và `/faq`.

Mỗi trang công khai có metadata riêng. Domain canonical được đặt trong `src/seo.ts`; nếu domain chính thức thay đổi, cập nhật đồng bộ `SITE_ORIGIN`, `public/sitemap.xml` và metadata liên quan.

## Booking qua SimplyBook.me

- Website không tự thu thập hoặc lưu yêu cầu đặt lịch ở luồng công khai. Nút Book a Lesson dẫn khách đến trang SimplyBook.me.
- Đặt `VITE_SIMPLYBOOK_URL` thành URL booking công khai của tài khoản SimplyBook.me trong hosting environment variables trước khi build. `VITE_EXTERNAL_BOOKING_URL` chỉ được giữ làm fallback tương thích ngược.
- Khi chưa có URL, website hiển thị nút WhatsApp để khách xin đường dẫn thay vì giả vờ đã có lịch đặt chỗ.
- Lịch, dịch vụ, nhân viên, khung giờ, xác nhận và thanh toán do SimplyBook.me quản lý. Không bật hoặc quảng bá hệ thống lịch nội bộ cũ.
- Development, tests và production có thể dùng chung managed database; không tạo hoặc xóa booking giả khi chạy validation. Chỉ làm end-to-end booking sau khi owner đã thống nhất test data và phạm vi.

## Admin, bảo mật và email

- Trang nhân viên: `/admin`; đăng nhập bằng email/password, không có public self-registration hay default password.
- Tạo owner đầu tiên qua flow one-time setup; dùng setup/recovery secrets được cung cấp trong protected secret manager, không ghi, đọc, gửi qua chat hay đóng gói giá trị secret. Hai token phải khác nhau và đáp ứng đúng yêu cầu kiểm tra của ứng dụng.
- Admin có booking management, instructor roster, shifts/time off/closures, availability calendar và business settings. Temporary staff accounts phải đổi mật khẩu theo yêu cầu của flow.
- Giữ CSRF/origin checks, session cookie bảo mật, role checks và không đưa guest records hoặc nội dung admin vào public output.
- Email booking dùng Resend khi `RESEND_API_KEY` và `RESEND_FROM_EMAIL` đã cấu hình hợp lệ qua Secrets. Khi chưa cấu hình, không tuyên bố email đã gửi; booking và trạng thái outbox phải thể hiện pending/not configured theo thiết kế.
- Không thêm payment gateway đầy đủ; deposit/payment link thủ công chỉ sau khi staff xác nhận booking.

## Âm thanh website

- Nguồn hai file được owner gửi nằm trong cùng một Google Drive folder; đường dẫn và file IDs được lưu ở cuối `plan.md`.
- `public/assets/snowing-in-dresden-background.mp3` dùng làm ambience loop nhẹ. Mặc định tắt; khách chủ động bật trong bảng **Sound**, vì trình duyệt thường chặn autoplay có âm thanh. Có thể bật/tắt riêng.
- `public/assets/snowball-click.mp3` dùng cho button/link/interactive controls trên trang công khai. Mặc định bật ở lượt truy cập đầu, có công tắc tắt riêng và lưu lựa chọn tắt trong local storage. Tệp được preload/decode; audio context được làm nóng khi pointer/keyboard bắt đầu tương tác; sound source được start trực tiếp trong click-capture event, không dùng timer, không chờ request hoàn tất và không chặn thao tác của khách.
- Hai âm thanh không chạy trong staff admin. Tệp `Snow fall.mp3` 15 giây trong Drive chưa được gán vai trò nên không được đóng gói/dùng trong website.

## SEO, analytics và nội dung

- Giữ route manifest, sitemap/robots, title/description theo trang, Open Graph và schema chỉ dựa trên thông tin có thật.
- GA4/GTM/Meta Pixel chỉ tải khi owner cung cấp IDs thật qua cấu hình; không đưa credentials vào client output hoặc source archive.
- Không bịa testimonial/rating, không thêm claim `500 coaching hours/year`, không tạo lookalike của Igor. Giữ đúng thông tin 5 ski instructors đã có trong brief.
- Dùng ảnh brand thật có trong source hoặc do owner cung cấp; không thay ảnh thật bằng ảnh dựng như thể là founder.

## Tiếp tục dự án

1. Tạo tài khoản owner qua flow setup bảo mật; không lưu mật khẩu hoặc setup secrets trong source code.
2. Lấy URL booking công khai từ SimplyBook.me và đặt biến `VITE_SIMPLYBOOK_URL` trong hosting.
3. Kiểm tra đăng nhập `/admin/content`, tạo bài nháp, đăng bài và thêm ảnh bằng URL HTTPS.
4. Kiểm tra menu, Gallery, Stories và luồng chuyển sang SimplyBook.me trên iPhone Safari.
5. Chạy `pnpm install --frozen-lockfile`, `pnpm test` và `pnpm build` trong môi trường triển khai trước khi publish.

Nội dung website công khai bằng tiếng Anh; handoff/requirements nội bộ bằng tiếng Việt và tiếng Anh. Handoff cũ có thể chứa URL/commit lịch sử; chỉ Version history và trạng thái Publish hiện hành mới xác nhận bản production.
