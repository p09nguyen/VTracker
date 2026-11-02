# 🎯 VTracker - Valorant Daily Store & Night Market Tracker

Ứng dụng web cá nhân cao cấp dùng để theo dõi cửa hàng Valorant hằng ngày, xem Chợ Đêm (Night Market), kiểm tra Shop Phụ Kiện (Kingdom Credits), xem trước hiệu ứng âm thanh/video vũ khí (VFX & Finisher) và thiết lập danh sách Wishlist để nhận thông báo ngay khi skin yêu thích xuất hiện.

---

## ✨ Tính năng nổi bật

1. **⚡ Đồng bộ 1-Click Riot Client (Không cần mật khẩu)**:
   - Tự động nhận diện Riot Client đang mở trên máy tính (Windows) thông qua lockfile cục bộ.
   - Không lưu trữ mật khẩu, an toàn tuyệt đối 100%.

2. **🔑 Đăng nhập trực tiếp tài khoản Riot Games**:
   - Hỗ trợ đăng nhập bằng Username & Password.
   - Hỗ trợ xác thực 2 lớp (**2FA / MFA**) qua mã email 6 số từ Riot Games.

3. **🎯 Cửa hàng xoay vòng hằng ngày (Daily Store)**:
   - Hiển thị 4 skin ngẫu nhiên trong ngày với giá VP chính xác.
   - Bộ đếm thời gian thực (Hours : Minutes : Seconds) đếm ngược đến lúc shop reset (07:00 sáng).
   - Tự động làm mới khi hết giờ.

4. **🌙 Chợ Đêm (Night Market)**:
   - Hiển thị 6 thẻ bài bí ẩn với hiệu ứng lật thẻ 3D chân thực.
   - Mở khóa phần trăm giảm giá (VD: -35%, -45%), giá gốc gạch ngang và giá ưu đãi bằng điểm VP.

5. **📦 Bộ sưu tập nổi bật (Featured Bundles)**:
   - Theo dõi các bundle trang phục đang mở bán, thời hạn còn lại và danh sách từng khẩu súng kèm giá.

6. **💎 Cửa hàng phụ kiện (Kingdom Credits)**:
   - Hiển thị 4 vật phẩm phụ kiện (Thẻ người chơi, Bình xịt, Móc khóa súng, Danh hiệu) có thể mua lại bằng KC.

7. **❤️ Danh sách mong muốn (Wishlist Alert System)**:
   - Tra cứu hơn 1.400+ skin súng trong toàn bộ dữ liệu game Valorant.
   - Bộ lọc theo Tier: *Ultra, Exclusive, Premium, Deluxe, Select*.
   - Lưu wishlist trên trình duyệt.
   - **Tín hiệu cảnh báo rực rỡ**: Khi cửa hàng ngày hoặc Chợ Đêm có skin nằm trong Wishlist của bạn, banner cảnh báo phát sáng và phát âm thanh thông báo.

8. **🎬 Trình phát Video & Biến thể màu sắc (Chromas & VFX)**:
   - Xem trước hiệu ứng hoạt ảnh kết liễu (Finisher) và hoạt cảnh thay đạn dạng video chất lượng cao từ Riot CDN.
   - Đổi qua lại giữa các phiên bản màu sắc (Chromas) với ảnh vũ khí độ nét cao.

9. **🎮 Chế độ Demo (Demo Mode)**:
   - Thử nghiệm ngay giao diện với các skin hàng đầu (Kuronami Vandal, Prime Karambit, Reaver Operator, Araxys Vandal) mà không bắt buộc phải đăng nhập.

---

## 🚀 Hướng dẫn khởi động nhanh

### Cách 1: Sử dụng file chạy nhanh (Khuyên dùng)
- Nhấp đúp chuột vào file [`start.bat`](file:///g:/VTracker/start.bat) trong thư mục `g:\VTracker`.
- Trình duyệt sẽ tự động mở trang web tại địa chỉ: `http://localhost:3888`.

### Cách 2: Khởi động qua Terminal
```bash
npm start
```
Truy cập: [http://localhost:3888](http://localhost:3888)
