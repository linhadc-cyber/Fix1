import { marked } from "marked";

marked.setOptions({
  gfm: true,
  breaks: false,
});

function slugifyHeading(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/gi, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

export type TocItem = { id: string; text: string; level: 2 | 3 };

/** Lấy mục lục H2/H3 từ markdown. */
export function extractMarkdownToc(content: string): TocItem[] {
  const items: TocItem[] = [];
  const seen = new Map<string, number>();
  for (const line of (content || "").split(/\r?\n/)) {
    const m = /^(#{2,3})\s+(.+)$/.exec(line.trim());
    if (!m) continue;
    const level = m[1].length as 2 | 3;
    const text = m[2].replace(/#+\s*$/, "").trim();
    if (!text) continue;
    let id = slugifyHeading(text) || `h-${items.length}`;
    const n = (seen.get(id) || 0) + 1;
    seen.set(id, n);
    if (n > 1) id = `${id}-${n}`;
    items.push({ id, text, level });
  }
  return items;
}

function injectHeadingIds(html: string): string {
  const seen = new Map<string, number>();
  return html.replace(/<h([23])>([\s\S]*?)<\/h\1>/gi, (_full, level, inner) => {
    const text = String(inner).replace(/<[^>]+>/g, "").trim();
    let id = slugifyHeading(text) || `h-${seen.size}`;
    const n = (seen.get(id) || 0) + 1;
    seen.set(id, n);
    if (n > 1) id = `${id}-${n}`;
    return `<h${level} id="${id}">${inner}</h${level}>`;
  });
}

/** Nội dung nội bộ — bảng striped qua CSS .prose-fix1 table. */
export function Markdown({ content }: { content: string }) {
  const raw = marked.parse(content || "", { async: false }) as string;
  const html = injectHeadingIds(raw);

  return (
    <div
      className="prose-fix1 space-y-3 text-[15px] leading-7 text-[var(--foreground)]"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
