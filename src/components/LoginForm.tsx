"use client";

import { FormEvent, useState } from "react";

export function LoginForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.get("username"),
          password: form.get("password"),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Đăng nhập thất bại");
        setLoading(false);
        return;
      }
      // Hard navigate so session cookie is sent on the next request
      window.location.assign("/");
    } catch {
      setError("Không kết nối được máy chủ");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="login-card animate-rise">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">
          Fix1
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--foreground)]">
          Đăng nhập
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Kho kiến thức sửa chữa nội bộ — vào Trang chủ để xem và hỏi AI.
        </p>
      </div>
      <label className="mb-3 block">
        <span className="label">Tài khoản</span>
        <input
          name="username"
          required
          autoComplete="username"
          className="input"
          defaultValue="admin"
        />
      </label>
      <label className="mb-4 block">
        <span className="label">Mật khẩu</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="input"
        />
      </label>
      {error ? (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={loading}
        className="btn btn-primary w-full py-2.5"
      >
        {loading ? "Đang đăng nhập..." : "Đăng nhập"}
      </button>
    </form>
  );
}
