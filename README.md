# Fix1 — Kho kiến thức sửa chữa

Web app nội bộ: bài viết, tình huống, tài liệu `.md`/`.docx`, hỏi AI kỹ thuật (DeepSeek). Chạy Windows, chia sẻ LAN.

**Cổng mặc định: `5051`**

## Tài khoản mặc định

Sau `npm run db:setup`:

- Username: `admin`
- Password: `admin123`

Chỉ **admin** thấy menu **Người dùng**. Khóa account khi nhân viên nghỉ.

## Yêu cầu

- Node.js ≥ 22.5 (khuyến nghị 24)
- Cổng **5051**

## Máy dev

```bash
npm install
npm run db:setup
npm run dev
```

Mở http://localhost:5051

`.env.local`:

```
SESSION_SECRET=doi-bang-chuoi-bi-mat-dai-it-nhat-32-ky-tu
PORT=5051
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_MODEL=deepseek-chat
```

## Hỏi AI kỹ thuật (ModelArk)

Theo hướng dẫn console ModelArk (OpenAI-compatible):

```
ARK_API_KEY=ark-...
ARK_BASE_URL=https://ark.ap-southeast.bytepluses.com/api/v3
ARK_MODEL=deepseek-v4-pro-ga-260813
```

Restart server sau khi sửa `.env.local`. Dùng ô **Hỏi AI kỹ thuật** trên menu.

## Thư viện & tài liệu cho AI

- **Thư viện**: tab Bài viết / Tình huống / Tài liệu, lọc theo thiết bị.
- Tài liệu chữ ưu tiên **`.md` hoặc `.docx`** (upload bắt buộc chọn loại thiết bị).
- File lưu theo khu: `data/knowledge/<thiet-bi>/{articles|cases|notes}/`
- Toàn bộ chữ được trích vào DB (`full_text`) lúc upload — AI đọc từ đây, không gửi file binary lên API.
- Ảnh/video: `data/uploads/` (minh họa; nên có tóm tắt).

## GitHub / máy công ty

Không commit `data/`, `.env.local`, `node_modules/`, `.next/`.

Máy công ty: clone → `.env.local` → `npm install` → `npm run db:setup` → `npm run build` → `npm run start` (hoặc `start-fix1.bat`). Firewall TCP **5051**.

Backup: copy cả thư mục `data/` (gồm `fix1.db`, `knowledge/`, `uploads/`).

## Vai trò

| Role | Quyền |
|------|--------|
| viewer | Xem, hỏi AI |
| editor | Thêm/sửa bài, tình huống, upload |
| admin | Tất cả + quản lý / khóa user |
