"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const CONFIRM_SECONDS = 5;

type ConfirmDeleteProps = {
  label?: string;
  message: string;
  className?: string;
  /** Server action nhận FormData */
  action?: (formData: FormData) => void | Promise<void>;
  hiddenFields?: Record<string, string | number>;
  /** Xóa phía client (API) */
  onConfirm?: () => void | Promise<void>;
  ariaLabel?: string;
};

export function ConfirmDelete({
  label = "Xóa",
  message,
  className = "btn btn-secondary text-red-700",
  action,
  hiddenFields,
  onConfirm,
  ariaLabel,
}: ConfirmDeleteProps) {
  const [open, setOpen] = useState(false);
  const [left, setLeft] = useState(CONFIRM_SECONDS);
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  function clearTimer() {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function close() {
    clearTimer();
    setOpen(false);
    setLeft(CONFIRM_SECONDS);
    setBusy(false);
  }

  function openDialog() {
    setOpen(true);
    setLeft(CONFIRM_SECONDS);
    clearTimer();
    timerRef.current = window.setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          clearTimer();
          setOpen(false);
          return CONFIRM_SECONDS;
        }
        return s - 1;
      });
    }, 1000);
  }

  useEffect(() => () => clearTimer(), []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function handleConfirm() {
    if (busy) return;
    setBusy(true);
    clearTimer();
    try {
      if (onConfirm) {
        await onConfirm();
        close();
        return;
      }
      if (action) {
        const fd = new FormData();
        if (hiddenFields) {
          for (const [k, v] of Object.entries(hiddenFields)) {
            fd.set(k, String(v));
          }
        }
        await action(fd);
        close();
      }
    } catch (err) {
      // Server action redirect() — coi như thành công
      const dig =
        err && typeof err === "object" && "digest" in err
          ? String((err as { digest?: string }).digest || "")
          : "";
      if (dig.startsWith("NEXT_REDIRECT")) {
        close();
        return;
      }
      setBusy(false);
      setOpen(true);
      setLeft(CONFIRM_SECONDS);
    }
  }

  const dialog =
    open && mounted
      ? createPortal(
          <div
            className="confirm-delete-backdrop"
            role="presentation"
            onClick={close}
          >
            <div
              className="confirm-delete-dialog"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="confirm-delete-title"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="confirm-delete-title" className="text-lg font-semibold">
                Xác nhận xóa
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                {message}
              </p>
              <p className="mt-2 text-sm font-medium text-red-700">
                Còn {left}s — hết giờ sẽ hủy tự động nếu bạn không xác nhận.
              </p>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={close}
                  disabled={busy}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className="btn btn-primary !bg-red-700 hover:!bg-red-800"
                  disabled={busy}
                  onClick={() => void handleConfirm()}
                >
                  {busy ? "Đang xóa…" : `Xác nhận xóa (${left})`}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        className={className}
        aria-label={ariaLabel || label}
        onClick={openDialog}
      >
        {label}
      </button>
      {dialog}
    </>
  );
}
