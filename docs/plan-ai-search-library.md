# Plan: Fix1 ↔ AI orchestration (đã implement)

## Luồng

1. Key scan (bỏ stopword) → chọn 1–2 tài liệu (bám focus phiên nếu follow-up)
2. Đóng gói: full nếu ≤14k ký tự; nếu dài → mục lục + mục khớp key
3. Prompt = policy + **tóm tắt phiên** + nguồn neo + 1–2 lượt gần + nội dung tài liệu
4. Sau trả lời: cập nhật `memory_json` trên phiên (summary + focusDocs + notes)

## File

- `src/lib/ai/doc-pack.ts` — chọn & đóng gói tài liệu
- `src/lib/ai/session-memory.ts` — bộ nhớ phiên
- `src/lib/ai/orchestrate.ts` — điều phối
- `chat_sessions.memory_json` — lưu DB

## Checklist

- [x] Key scan → chỉ điểm nguồn
- [x] AI đọc đủ (full/mục) không chỉ đoạn 900 ký tự
- [x] Nhớ ngữ cảnh phiên (summary)
- [x] Phiên mới = memory sạch
- [x] EN → dịch + key → search → answer
