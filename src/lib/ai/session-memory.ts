export type FocusSource = {
  type: "article" | "case" | "doc" | "software";
  id: number;
};

export type HistoryItem = { role: "user" | "assistant"; content: string };

export type SessionMemory = {
  /** Tóm tắt chạy của phiên — AI đọc cái này thay vì cả chat dài */
  summary: string;
  /** Ghi chú thông số / kết luận ngắn */
  notes: string;
  focusDocs: {
    type: "article" | "case" | "doc" | "software";
    id: number;
    title: string;
    href: string;
  }[];
};

export function emptySessionMemory(): SessionMemory {
  return { summary: "", notes: "", focusDocs: [] };
}

function isSourceType(t: unknown): t is FocusSource["type"] {
  return (
    t === "article" || t === "case" || t === "doc" || t === "software"
  );
}

export function parseSessionMemory(raw: string | null | undefined): SessionMemory {
  if (!raw?.trim()) return emptySessionMemory();
  try {
    const p = JSON.parse(raw) as Partial<SessionMemory>;
    return {
      summary: String(p.summary || ""),
      notes: String(p.notes || ""),
      focusDocs: Array.isArray(p.focusDocs)
        ? p.focusDocs
            .filter(
              (d) =>
                d && isSourceType(d.type) && Number.isFinite(Number(d.id)),
            )
            .map((d) => ({
              type: d.type as FocusSource["type"],
              id: Number(d.id),
              title: String(d.title || ""),
              href: String(d.href || ""),
            }))
            .slice(0, 6)
        : [],
    };
  } catch {
    return emptySessionMemory();
  }
}

/** Cập nhật bộ nhớ phiên không cần gọi AI thêm (nhẹ, ổn định). */
export function updateSessionMemoryHeuristic(
  prev: SessionMemory,
  question: string,
  answer: string,
  docs: { type: FocusSource["type"]; id: number; title: string; href: string }[],
): SessionMemory {
  const focusMap = new Map(
    prev.focusDocs.map((d) => [`${d.type}:${d.id}`, d] as const),
  );
  for (const d of docs) {
    focusMap.set(`${d.type}:${d.id}`, {
      type: d.type,
      id: d.id,
      title: d.title,
      href: d.href,
    });
  }
  const focusDocs = [...focusMap.values()].slice(0, 6);
  const srcLabel = docs.map((d) => d.title).join("; ") || "(không nguồn)";
  const line = `• Hỏi: ${question.slice(0, 120).replace(/\s+/g, " ")} → Nguồn: ${srcLabel.slice(0, 160)} | TL: ${answer.slice(0, 160).replace(/\s+/g, " ")}…`;
  const summary = `${prev.summary ? `${prev.summary.trim()}\n` : ""}${line}`
    .trim()
    .slice(-1800);

  // Giữ vài thông số dạng số/mã xuất hiện trong câu trả lời
  const codes = answer.match(/\b(?:IEC\/?EN?\s*)?\d{3,5}(?:-\d+)?\b|\b\d+(?:[.,]\d+)?\s*(?:V|A|Hz|kW)\b/gi) || [];
  const noteAdd = codes.slice(0, 8).join(", ");
  const notes = noteAdd
    ? `${prev.notes ? `${prev.notes}; ` : ""}${noteAdd}`.slice(-500)
    : prev.notes;

  return { summary, notes, focusDocs };
}
