CNC PRO — MÁY CHỦ PROXY AI PHÂN TÍCH BẢN VẼ

Tác dụng
- Nhận ảnh bản vẽ từ CNC PRO V11.7.
- Gửi ảnh + ghi chú + G-code hiện tại đến OpenAI Responses API.
- Trả về báo cáo tiếng Việt, phân biệt dữ liệu đọc được với suy luận.
- API key chỉ nằm ở biến môi trường của máy chủ, không nằm trong HTML.

Yêu cầu
- Node.js 20 trở lên.
- Tài khoản API của nhà cung cấp AI, quyền truy cập model và thanh toán/API quota phù hợp.
- Một nơi chạy máy chủ Node.js qua HTTPS khi dùng thực tế.

Chạy thử trên máy tính
1. Giải nén thư mục này.
2. Mở terminal tại thư mục CNC_PRO_AI_Backend.
3. Chạy: npm install
4. Đặt biến môi trường OPENAI_API_KEY ở terminal/hệ điều hành; không ghi khóa vào server.js hoặc HTML.
   Linux/macOS: export OPENAI_API_KEY='...'
   PowerShell: $env:OPENAI_API_KEY='...'
5. Tuỳ chọn đặt OPENAI_MODEL, PORT và CORS_ORIGIN.
6. Chạy: npm start
7. Kiểm tra http://localhost:8787/health phải trả về {"ok":true,...}.
8. URL endpoint trong CNC PRO khi chạy local: http://localhost:8787/api/drawing-analysis.
   Giao diện HTML hiện chỉ chấp nhận HTTPS endpoint, nên để dùng đúng nút từ trình duyệt, hãy triển khai proxy lên HTTPS. Không nên đổi sang HTTP công khai.

Triển khai thực tế
- Đưa server.js và package.json lên dịch vụ chạy Node.js hỗ trợ HTTPS.
- Cấu hình OPENAI_API_KEY trong phần Secrets/Environment Variables của dịch vụ.
- Cấu hình CORS_ORIGIN đúng origin chứa trang HTML; không dùng wildcard trong triển khai công khai.
- Đặt URL endpoint đầy đủ dạng https://ten-may-chu-cua-ban/api/drawing-analysis trong CNC PRO.
- Nên thêm đăng nhập hoặc xác thực người dùng, giới hạn chi phí ở dự án API, giới hạn tốc độ ở gateway/WAF và theo dõi mức sử dụng. Giới hạn IP trong ví dụ chỉ là lớp bảo vệ cơ bản, không thay thế xác thực sản xuất.

Giới hạn kỹ thuật
- AI thị giác có thể đọc nhầm ký hiệu, số nhỏ, đường nét đứt, dung sai hoặc hình chiếu. Luôn kiểm tra với bản vẽ gốc.
- Ảnh chụp phối cảnh/3D không cho phép suy ra mọi kích thước chính xác nếu thiếu kích thước chuẩn.
- Báo cáo không phải chứng nhận an toàn G-code và không thay thế mô phỏng đúng bộ điều khiển, kiểm tra đồ gá, dao, offset và chạy thử an toàn.
- Việc gửi ảnh lên máy chủ có nghĩa ảnh và ngữ cảnh được gửi đến nhà cung cấp AI; chỉ gửi tài liệu bạn có quyền chia sẻ.
