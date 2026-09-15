import { marked } from "marked";

marked.setOptions({
  gfm: true,
  breaks: false,
});

/** Nội dung nội bộ (admin upload) — render HTML phía server cho tài liệu lớn nhanh hơn ReactMarkdown. */
export function Markdown({ content }: { content: string }) {
  const html = marked.parse(content || "", { async: false }) as string;

  return (
    <div
      className="prose-fix1 space-y-3 text-[15px] leading-7 text-[var(--foreground)]"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
