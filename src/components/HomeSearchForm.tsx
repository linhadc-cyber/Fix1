"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

type Props = {
  tab: string;
  q: string;
  placeholder: string;
};

function hrefForTab(tab: string) {
  return tab === "articles" ? "/" : `/?tab=${tab}`;
}

/** Ô tìm + nút Tìm + nút Xóa (xóa chữ trong ô; có lọc URL thì bỏ lọc luôn). */
export function HomeSearchForm({ tab, q, placeholder }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(q);

  useEffect(() => {
    setValue(q);
  }, [q]);

  function clearSearch() {
    setValue("");
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.focus();
    }
    if (q) {
      router.push(hrefForTab(tab));
      router.refresh();
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const term = value.trim();
    const base = hrefForTab(tab);
    // Tìm mới luôn về trang 1
    if (!term) {
      router.push(base);
    } else if (tab === "articles") {
      router.push(`/?q=${encodeURIComponent(term)}`);
    } else {
      router.push(`${base}&q=${encodeURIComponent(term)}`);
    }
    router.refresh();
  }

  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={onSubmit}>
      <label className="min-w-[14rem] flex-1">
        <span className="label">Tìm kiếm</span>
        <input
          ref={inputRef}
          name="q"
          className="input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
        />
      </label>
      <button type="submit" className="btn btn-primary">
        Tìm
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={clearSearch}
        aria-label="Xóa chữ trong ô tìm kiếm"
      >
        Xóa
      </button>
    </form>
  );
}
