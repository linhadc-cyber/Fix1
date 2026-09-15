"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type SourceBundle = {
  articles: { id: number; title: string }[];
  cases: { id: number; title: string }[];
  media: { id: number; title: string; kind: string }[];
};

type Msg = {
  role: "user" | "assistant";
  text: string;
  sources?: SourceBundle;
};

export function AiChat({ hasKey }: { hasKey: boolean }) {
  const [mode, setMode] = useState<"local" | "hybrid">("local");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || loading) return;

    setError("");
    setLoading(true);
    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setQuestion("");

    try {
      const res = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Không hỏi được AI");
        setLoading(false);
        return;
      }
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: data.answer, sources: data.sources },
      ]);
    } catch {
      setError("Lỗi kết nối máy chủ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {!hasKey ? (
          <div className="card border-[color:var(--accent)]">
          <h2 className="text-xl font-semibold">Chưa gắn API key Gemini</h2>
          <p className="mt-2 text-base text-[var(--muted)]">
            Thêm key vào file <code className="rounded bg-[var(--bg-soft)] px-1.5 py-0.5">.env.local</code>:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-[#14202b] p-4 text-base text-[#edf2f6]">
{`GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.0-flash`}
          </pre>
          <p className="mt-3 text-base text-[var(--muted)]">
            Lấy key tại Google AI Studio, rồi restart <code>npm run dev</code> /{" "}
            <code>npm run start</code>.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`btn ${mode === "local" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setMode("local")}
        >
          Chỉ kiến thức Fix1
        </button>
        <button
          type="button"
          className={`btn ${mode === "hybrid" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setMode("hybrid")}
        >
          Fix1 + kiến thức ngoài
        </button>
      </div>

      <div className="card min-h-[20rem] space-y-4">
        {messages.length === 0 ? (
          <p className="text-lg text-[var(--muted)]">
            Ví dụ: “Inverter báo lỗi OVDC thì kiểm tra gì trước?” hoặc “Checklist
            an toàn khi làm việc với ắc quy?”
          </p>
        ) : (
          messages.map((m, i) => (
            <div
              key={`${m.role}-${i}`}
              className={`animate-rise rounded-xl px-4 py-3 ${
                m.role === "user"
                  ? "ml-8 bg-[var(--brand)] text-white"
                  : "mr-4 bg-[var(--bg-soft)]"
              }`}
            >
              <div className="mb-1 text-sm font-semibold opacity-80">
                {m.role === "user" ? "Bạn" : "Fix1 AI"}
              </div>
              <div className="whitespace-pre-wrap text-base leading-relaxed">
                {m.text}
              </div>
              {m.sources ? (
                <div className="mt-3 space-y-1 border-t border-black/10 pt-2 text-sm">
                  {m.sources.articles.map((a) => (
                    <div key={`a-${a.id}`}>
                      <Link href={`/articles/${a.id}`} className="underline">
                        Bài #{a.id}: {a.title}
                      </Link>
                    </div>
                  ))}
                  {m.sources.cases.map((c) => (
                    <div key={`c-${c.id}`}>
                      <Link href={`/cases/${c.id}`} className="underline">
                        Tình huống #{c.id}: {c.title}
                      </Link>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))
        )}
        {loading ? (
          <p className="animate-rise text-base text-[var(--muted)]">
            Đang hỏi Gemini...
          </p>
        ) : null}
        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-base text-red-700">
            {error}
          </p>
        ) : null}
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="textarea min-h-[5.5rem] flex-1"
          placeholder="Nhập câu hỏi sửa chữa..."
          disabled={!hasKey || loading}
        />
        <button
          type="submit"
          className="btn btn-primary self-end px-6 py-3"
          disabled={!hasKey || loading || !question.trim()}
        >
          Gửi
        </button>
      </form>
    </div>
  );
}
