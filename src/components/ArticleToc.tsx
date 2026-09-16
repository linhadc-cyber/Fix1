import type { TocItem } from "@/components/Markdown";

function TocList({ items }: { items: TocItem[] }) {
  return (
    <ul className="reader-toc-list">
      {items.map((item) => (
        <li key={item.id} className={item.level === 3 ? "toc-h3" : undefined}>
          <a href={`#${item.id}`}>{item.text}</a>
        </li>
      ))}
    </ul>
  );
}

export function ArticleToc({ items }: { items: TocItem[] }) {
  if (items.length < 2) return null;

  return (
    <nav className="zone zone-toc reader-toc" aria-label="Mục lục">
      <p className="zone-title">Mục lục</p>
      <details className="reader-toc-mobile">
        <summary>Mở mục lục ({items.length} mục)</summary>
        <TocList items={items} />
      </details>
      <div className="reader-toc-desktop">
        <TocList items={items} />
      </div>
    </nav>
  );
}
