"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function isDetailReader(pathname: string) {
  return (
    /^\/articles\/\d+$/.test(pathname) ||
    /^\/cases\/\d+$/.test(pathname) ||
    /^\/media\/\d+$/.test(pathname)
  );
}

/** Khóa viewport trên /ask và trang đọc bài/tình huống/file; trang khác cuộn bình thường. */
export function AskShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAsk = pathname === "/ask";
  const isReader = isDetailReader(pathname);
  const lockViewport = isAsk || isReader;

  useEffect(() => {
    document.documentElement.classList.toggle("lock-viewport", lockViewport);
    document.body.classList.toggle("lock-viewport", lockViewport);
    return () => {
      document.documentElement.classList.remove("lock-viewport");
      document.body.classList.remove("lock-viewport");
    };
  }, [lockViewport]);

  return (
    <>
      <main
        className={
          isAsk
            ? "ask-shell mx-auto flex w-full max-w-6xl min-h-0 flex-1 flex-col overflow-hidden px-3 py-2 sm:px-4"
            : isReader
              ? "reader-shell mx-auto flex w-full max-w-6xl min-h-0 flex-1 flex-col overflow-hidden px-4 py-3 sm:px-4"
              : "mx-auto w-full max-w-6xl min-h-0 flex-1 px-4 py-6 page-enter"
        }
      >
        {children}
      </main>
      {lockViewport ? null : (
        <footer className="shrink-0 border-t border-[var(--border)] py-4 text-center text-sm text-[var(--muted)]">
          Fix1 — Kho kiến thức sửa chữa nội bộ · cổng 5051
        </footer>
      )}
    </>
  );
}
