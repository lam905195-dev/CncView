import express from 'express';

const app = express();
const PORT = Number(process.env.PORT || 8787);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || '*';

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: '18mb' }));

// Basic per-IP throttling to reduce accidental loops. For public deployment,
// add platform-level authentication, stronger rate limiting and usage quotas.
const buckets = new Map();
app.use((req, res, next) => {
  if (req.path === '/health') return next();
  const now = Date.now();
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  let b = buckets.get(ip);
  if (!b || now - b.start > 60 * 60 * 1000) b = { start: now, count: 0 };
  b.count++;
  buckets.set(ip, b);
  if (b.count > 20) return res.status(429).type('text').send('Đã vượt giới hạn 20 yêu cầu/giờ từ địa chỉ này.');
  next();
});

app.get('/health', (_req, res) => res.json({ ok: true, service: 'CNC PRO Drawing AI proxy' }));

app.post('/api/drawing-analysis', async (req, res) => {
  try {
    if (!GEMINI_API_KEY) return res.status(503).type('text').send('Máy chủ chưa cấu hình GEMINI_API_KEY trong biến môi trường.');
    const { image_base64, image_mime, filename, notes, gcode, calibration } = req.body || {};
    if (typeof image_base64 !== 'string' || image_base64.length < 100) return res.status(400).type('text').send('Thiếu ảnh hợp lệ.');
    const mime = ['image/jpeg', 'image/png', 'image/webp'].includes(image_mime) ? image_mime : 'image/jpeg';
    if (image_base64.length > 16_000_000) return res.status(413).type('text').send('Ảnh quá lớn. Hãy giảm kích thước ảnh rồi thử lại.');
    const imageData = image_base64;
    const instructions = `Bạn là trợ lý phân tích bản vẽ kỹ thuật và cơ khí. Trả lời bằng tiếng Việt, rõ ràng, có cấu trúc.\n\nNGUYÊN TẮC BẮT BUỘC:\n- Không bao giờ tự bịa kích thước, dung sai, vật liệu, ký hiệu, chuẩn datum, tỷ lệ bản vẽ hoặc thông số gia công không nhìn thấy/không được cung cấp.\n- Phân biệt rõ: ĐỌC ĐƯỢC TRÊN BẢN VẼ; QUAN SÁT HÌNH HỌC; SUY LUẬN CẦN XÁC MINH; KHÔNG ĐỦ DỮ LIỆU.\n- Nếu chữ hoặc ký hiệu nhỏ/mờ, nói rõ không đọc chắc chắn; không đoán.\n- Không lấy số đo pixel hoặc ảnh phối cảnh làm kích thước mm nếu chưa có tỷ lệ/chuẩn hiệu chuẩn hợp lệ. Hiệu chuẩn ảnh 2D không đảm bảo chính xác trên ảnh 3D phối cảnh.\n- Nếu có G-code, chỉ so sánh sơ bộ các tọa độ/lệnh có trong chương trình với thông tin bản vẽ; nêu rõ chưa xác minh offset, đồ gá, dao, postprocessor, hành trình máy hoặc bộ điều khiển. Không tuyên bố chương trình an toàn để chạy.\n- Khi dữ liệu thiếu hoặc mâu thuẫn, liệt kê câu hỏi cần người dùng/kỹ sư xác nhận.\n\nHãy trình bày theo mục: 1) Tóm tắt chi tiết; 2) Kích thước/ký hiệu đọc được (bảng: nội dung, giá trị/đơn vị, độ chắc chắn, vị trí); 3) Đặc điểm hình học; 4) Dung sai/nhám/vật liệu nếu thật sự nhìn thấy; 5) Đối chiếu G-code nếu có; 6) Dữ liệu thiếu/mâu thuẫn; 7) Các bước kiểm tra tiếp theo. Không tự tạo giá trị để lấp chỗ trống.`;
    const context = [
      `Tên tệp: ${String(filename || 'không rõ').slice(0, 200)}`,
      `Ghi chú người dùng: ${String(notes || '(không có)').slice(0, 6000)}`,
      `Hiệu chuẩn ảnh (nếu có): ${JSON.stringify(calibration || null)}`,
      `G-code hiện tại (nếu có):\n${String(gcode || '(không cung cấp)').slice(0, 30000)}`
    ].join('\n\n');
    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instructions }] },
        contents: [{
          role: 'user',
          parts: [
            { text: context },
            { inlineData: { mimeType: mime, data: imageData } }
          ]
        }],
        generationConfig: { maxOutputTokens: 2200, temperature: 0.2 }
      })
    });
    const raw = await upstream.text();
    let payload;
    try { payload = JSON.parse(raw); } catch { payload = null; }
    if (!upstream.ok) {
      const message = payload?.error?.message || `Nhà cung cấp Gemini trả về HTTP ${upstream.status}`;
      return res.status(502).type('text').send(`Lỗi từ Gemini: ${message}`);
    }
    const text = (payload?.candidates?.[0]?.content?.parts || []).map(p => p.text || '').filter(Boolean).join('\n');
    if (!text) return res.status(502).type('text').send('Gemini không trả về nội dung phân tích.');
    res.type('text/plain; charset=utf-8').send(text);
  } catch (err) {
    console.error('drawing-analysis error:', err?.message || err);
    res.status(500).type('text').send('Máy chủ gặp lỗi khi phân tích. Kiểm tra log máy chủ để biết chi tiết.');
  }
});

app.listen(PORT, () => console.log(`CNC PRO Gemini proxy listening on port ${PORT}; model=${GEMINI_MODEL}`));
