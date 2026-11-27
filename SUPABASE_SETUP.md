# Thiết lập lưu đăng ký thông báo bền vững

VTracker có thể lưu khóa VAPID và đăng ký Web Push trong Supabase Free thay vì các file cục bộ dễ mất khi Render khởi động lại.

`auth_data` cũng giữ token/cookie Riot mà server cần để tải cửa hàng lúc gửi thông báo. Các bảng bật Row Level Security và chỉ cấp quyền cho service role; khóa bí mật chỉ được cấu hình trong Render.

## 1. Tạo bảng trong Supabase

Tạo project Supabase Free, mở **SQL Editor**, rồi chạy nội dung file `supabase/migrations/202611270001_push_storage.sql`.

## 2. Cấu hình Render

Trong **Render → VTracker service → Environment**, thêm:

- `SUPABASE_URL`: Project URL trong Supabase.
- `SUPABASE_SECRET_KEY`: secret API key phía server của project. Chỉ thêm ở Render, không đặt trong frontend hoặc commit vào Git.

Mã cũng chấp nhận biến cũ `SUPABASE_SERVICE_ROLE_KEY` nếu đang dùng legacy service-role JWT.

Lưu Environment để Render redeploy. Trong log cần thấy:

```text
[NotificationService] Initialized with Supabase storage. Total push subscribers: ...
```

Nếu thấy `local storage`, Supabase chưa được cấu hình; dữ liệu vẫn có nguy cơ mất khi Render Free restart hoặc ngủ.

## 3. Đăng ký lại iPhone

Mở VTracker từ biểu tượng **Thêm vào Màn hình chính** trên iPhone. Nếu khóa VAPID cũ khác khóa mới, VTracker sẽ bỏ đăng ký cũ. Bấm bật thông báo một lần để tạo subscription mới, lưu vào Supabase và nhận thông báo thử.

Sau đó kiểm tra Render Logs: lúc 07:00 giờ Việt Nam phải có log `Triggering daily shop notification`, tiếp theo là số thiết bị trong `Running daily alert for ... devices`.

UptimeRobot có thể tiếp tục ping URL chính của web service mỗi 5 phút để giảm khả năng Render Free ngủ. Render Free vẫn có thể restart bất kỳ lúc nào; dữ liệu Supabase được giữ lại, nhưng lịch trong tiến trình Node có thể bỏ lỡ một lần nếu restart đúng lúc chạy.

Supabase Free có thể tạm dừng project nếu hoạt động cơ sở dữ liệu thấp suốt một tuần. Lịch gửi hằng ngày sẽ truy cập database, nhưng nền tảng không cam kết project miễn phí luôn chạy.
