"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/Markdown";
import { ConfirmDelete } from "@/components/ConfirmDelete";

export type ChatSource = {
  type: "article" | "case" | "doc" | "software";
  id: number;
  title: string;
  href: string;
  label: string;
  equipmentName: string | null;
  excerpt: string;
  score: number;
};

type Msg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  sources?: ChatSource[];
  mode?: "local" | "internet";
};

type SessionItem = {
  id: number;
  title: string;
  updatedAt: string;
  messageCount: number;
};

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AskChat({
  hasKey,
  modelLabel,
  initialQuestion = "",
}: {
  hasKey: boolean;
  modelLabel?: string;
  initialQuestion?: string;
}) {
  const [allowInternet, setAllowInternet] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessionTitle, setSessionTitle] = useState("Phiên chat mới");
  const [maxSessions, setMaxSessions] = useState(30);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);
  const seeded = useRef(false);
  const sessionIdRef = useRef<number | null>(null);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, loading, error]);

  const refreshSessions = useCallback(async () => {
    const res = await fetch("/api/ai/sessions");
    if (!res.ok) return;
    const data = await res.json();
    setSessions(data.sessions || []);
    if (data.max) setMaxSessions(data.max);
  }, []);

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  async function ensureSession(firstQuestion?: string) {
    if (sessionIdRef.current) return sessionIdRef.current;
    const res = await fetch("/api/ai/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: firstQuestion?.slice(0, 80) || "Phiên chat mới",
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.session?.id) {
      throw new Error(data.error || "Không tạo được phiên chat");
    }
    setSessionId(data.session.id);
    sessionIdRef.current = data.session.id;
    setSessionTitle(data.session.title || "Phiên chat mới");
    await refreshSessions();
    return data.session.id as number;
  }

  async function persistMessages(
    sid: number,
    nextMessages: Msg[],
    titleHint?: string,
  ) {
    setSaving(true);
    try {
      const res = await fetch(`/api/ai/sessions/${sid}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: titleHint,
          messages: nextMessages.map((m) => ({
            role: m.role,
            content: m.text,
            sources: m.sources || [],
            mode: m.mode || "local",
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Lưu phiên thất bại");
      }
      if (data.session?.title) setSessionTitle(data.session.title);
      await refreshSessions();
      setSavedFlash("Đã lưu phiên");
      window.setTimeout(() => setSavedFlash(""), 1800);
    } finally {
      setSaving(false);
    }
  }

  async function sendQuestion(raw: string) {
    const q = raw.trim();
    if (!q || loading || !hasKey) return;

    setError("");
    setLoading(true);
    const history = messages.map((m) => ({
      role: m.role,
      content: m.text,
    }));
    // Nguồn đang theo dõi trong phiên (từ các trả lời trước) — để AI không nhảy lung tung
    const focusMap = new Map<string, { type: ChatSource["type"]; id: number }>();
    for (const m of messages) {
      for (const s of m.sources || []) {
        focusMap.set(`${s.type}:${s.id}`, { type: s.type, id: s.id });
      }
    }
    const focusSources = [...focusMap.values()].slice(0, 8);

    const userMsg: Msg = { id: uid(), role: "user", text: q };
    const withUser = [...messages, userMsg];
    setMessages(withUser);
    setQuestion("");

    try {
      const sid = await ensureSession(q);
      const res = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          allowInternet,
          history,
          focusSources,
          sessionId: sid,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Không hỏi được AI");
        setLoading(false);
        return;
      }
      const assistantMsg: Msg = {
        id: uid(),
        role: "assistant",
        text: data.answer || "",
        sources: data.sources || [],
        mode: data.mode === "internet" ? "internet" : "local",
      };
      const next = [...withUser, assistantMsg];
      setMessages(next);
      await persistMessages(sid, next, q.slice(0, 80));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi kết nối máy chủ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (seeded.current) return;
    const q = initialQuestion.trim();
    if (!q || !hasKey) return;
    seeded.current = true;
    void sendQuestion(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion, hasKey]);

  async function onNewSession() {
    if (loading) return;
    setError("");
    setMessages([]);
    setSessionId(null);
    sessionIdRef.current = null;
    setSessionTitle("Phiên chat mới");
    setSavedFlash("Phiên mới — chưa lưu đến khi bạn hỏi");
    window.setTimeout(() => setSavedFlash(""), 2200);
  }

  async function onSaveSession() {
    if (!messages.length) {
      setError("Chưa có nội dung để lưu");
      return;
    }
    try {
      const sid = await ensureSession(
        messages.find((m) => m.role === "user")?.text,
      );
      await persistMessages(sid, messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lưu thất bại");
    }
  }

  async function onOpenSession(id: number) {
    if (loading || id === sessionId) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/ai/sessions/${id}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Không mở được phiên");
        return;
      }
      setSessionId(data.session.id);
      sessionIdRef.current = data.session.id;
      setSessionTitle(data.session.title || "Phiên chat");
      setMessages(
        (data.messages || []).map(
          (m: {
            id: number;
            role: "user" | "assistant";
            content: string;
            sourcesJson?: string;
            mode?: string;
          }) => {
            let sources: ChatSource[] = [];
            try {
              sources = JSON.parse(m.sourcesJson || "[]");
            } catch {
              sources = [];
            }
            return {
              id: `db-${m.id}`,
              role: m.role,
              text: m.content,
              sources,
              mode: m.mode === "internet" ? "internet" : "local",
            } as Msg;
          },
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  async function onDeleteSession(id: number) {
    const res = await fetch(`/api/ai/sessions/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Xóa thất bại");
      throw new Error(data.error || "Xóa thất bại");
    }
    if (sessionId === id) {
      setSessionId(null);
      sessionIdRef.current = null;
      setMessages([]);
      setSessionTitle("Phiên chat mới");
    }
    await refreshSessions();
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void sendQuestion(question);
  }

  return (
    <div className="ask-chat">
      {!hasKey ? (
        <div className="zone zone-meta shrink-0">
          <h2 className="text-lg font-semibold">Chưa gắn ModelArk API key</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Thêm vào <code>.env.local</code> rồi restart server.
          </p>
        </div>
      ) : null}

      <div className="ask-chat-panel">
        <div className="ask-chat-toolbar zone-actions">
          <div className="min-w-0 flex-1">
            <p className="zone-title mb-0">Hỏi AI kỹ thuật</p>
            <h1 className="truncate text-base font-semibold leading-tight">
              {sessionTitle}
            </h1>
            <p className="truncate text-xs text-[var(--muted)]">
              {modelLabel || "ModelArk"}
              {sessionId ? ` · phiên #${sessionId}` : " · chưa lưu"}
              {savedFlash ? ` · ${savedFlash}` : ""}
              {saving ? " · đang lưu…" : ""}
            </p>
          </div>
          <div className="ask-chat-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void onNewSession()}
              disabled={loading}
            >
              Phiên mới
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void onSaveSession()}
              disabled={loading || saving || messages.length === 0}
            >
              Lưu phiên
            </button>
            <label className="ask-chat-internet shrink-0">
              <input
                type="checkbox"
                checked={allowInternet}
                onChange={(e) => setAllowInternet(e.target.checked)}
              />
              <span>Internet</span>
            </label>
          </div>
        </div>

        <div className="ask-chat-body">
          <aside className="ask-chat-sessions" aria-label="Phiên chat">
            <div className="ask-chat-sessions-head">
              Phiên ({sessions.length}/{maxSessions})
            </div>
            <div className="ask-chat-sessions-list">
              {sessions.length === 0 ? (
                <p className="px-2 py-3 text-xs text-[var(--muted)]">
                  Chưa có phiên lưu. Hỏi hoặc bấm Lưu phiên.
                </p>
              ) : (
                sessions.map((s) => (
                  <div
                    key={s.id}
                    className={`ask-session-item ${s.id === sessionId ? "active" : ""}`}
                  >
                    <button
                      type="button"
                      className="ask-session-open"
                      onClick={() => void onOpenSession(s.id)}
                      title={s.title}
                    >
                      <span className="ask-session-title">{s.title}</span>
                      <span className="ask-session-meta">
                        {s.messageCount} tin · {s.updatedAt}
                      </span>
                    </button>
                    <ConfirmDelete
                      label="×"
                      ariaLabel="Xóa phiên"
                      className="ask-session-del"
                      message={`Xóa phiên “${s.title}” và toàn bộ lịch sử chat?`}
                      onConfirm={() => onDeleteSession(s.id)}
                    />
                  </div>
                ))
              )}
            </div>
          </aside>

          <div className="ask-chat-main">
            <div ref={listRef} className="ask-chat-messages">
              {messages.length === 0 && !loading ? (
                <div className="space-y-2 text-[var(--muted)]">
                  <p>
                    Chat theo phiên: hỏi → tự lưu. Dừng máy / làm việc khác rồi
                    mở lại phiên trong danh sách bên trái.
                  </p>
                  <p className="text-sm">
                    Tối đa {maxSessions} phiên; phiên thứ {maxSessions + 1} sẽ
                    xóa phiên cũ nhất.
                  </p>
                </div>
              ) : null}

              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[95%] rounded-lg px-4 py-3 ${
                    m.role === "user"
                      ? "ml-auto bg-[var(--brand)] text-white"
                      : "mr-auto border border-[var(--border)] bg-[var(--zone-content-bg)]"
                  }`}
                >
                  <div className="mb-1 text-xs font-semibold opacity-80">
                    {m.role === "user"
                      ? "Bạn"
                      : m.mode === "internet"
                        ? "Fix1 AI · Fix1 + internet"
                        : "Fix1 AI · tài liệu nội bộ"}
                  </div>
                  {m.role === "assistant" ? (
                    <div className="prose-chat text-base leading-relaxed">
                      <Markdown content={m.text} />
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap text-base leading-relaxed">
                      {m.text}
                    </div>
                  )}
                  {m.sources && m.sources.length > 0 ? (
                    <div className="mt-3 space-y-2 border-t border-black/10 pt-3">
                      <div className="text-xs font-semibold uppercase tracking-wide opacity-70">
                        Nguồn ({m.sources.length})
                      </div>
                      {m.sources.map((s) => (
                        <Link
                          key={`${s.type}-${s.id}`}
                          href={s.href}
                          className="block rounded-lg border border-black/10 bg-white/70 px-3 py-2 text-sm text-[var(--foreground)] hover:border-[var(--brand)]"
                        >
                          <div className="font-medium">
                            {s.label}: {s.title}
                          </div>
                          <div className="mt-0.5 text-xs text-[var(--muted)]">
                            Mở đọc đầy đủ
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}

              {loading ? (
                <p className="text-sm text-[var(--muted)]">
                  Đang đọc chỉ mục Fix1 và soạn trả lời…
                </p>
              ) : null}
              {error ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              ) : null}
            </div>

            <form onSubmit={onSubmit} className="ask-chat-composer">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendQuestion(question);
                  }
                }}
                className="textarea ask-chat-input"
                placeholder="Nhập câu hỏi… (Enter gửi)"
                disabled={!hasKey || loading}
                rows={2}
              />
              <button
                type="submit"
                className="btn btn-primary ask-chat-send"
                disabled={!hasKey || loading || !question.trim()}
              >
                Gửi
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
