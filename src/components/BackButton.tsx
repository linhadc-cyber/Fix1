"use client";

type BackButtonProps = {
  fallbackHref: string;
  label?: string;
  className?: string;
};

/** Quay trang liền trước trong Fix1; nếu không được thì về fallbackHref. */
export function BackButton({
  fallbackHref,
  label = "← Quay lại",
  className = "btn btn-secondary",
}: BackButtonProps) {
  function onClick() {
    const here = window.location.href;
    try {
      const ref = document.referrer;
      if (ref) {
        const prev = new URL(ref);
        if (
          prev.origin === window.location.origin &&
          prev.href.split("#")[0] !== here.split("#")[0]
        ) {
          window.history.back();
          window.setTimeout(() => {
            if (window.location.href === here) {
              window.location.assign(fallbackHref);
            }
          }, 300);
          return;
        }
      }
    } catch {
      // ignore
    }
    window.location.assign(fallbackHref);
  }

  return (
    <button type="button" className={className} onClick={onClick}>
      {label}
    </button>
  );
}
