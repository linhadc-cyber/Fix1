import Link from "next/link";
import { canAdmin, canEdit, requireUser } from "@/lib/session";
import { logoutAction } from "@/app/actions";

export async function Header() {
  const user = await requireUser();

  return (
    <header className="site-header">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 lg:gap-4">
          <Link href="/" className="brand-mark shrink-0">
            Fix1
          </Link>
          {user ? (
            <nav className="flex flex-wrap items-center gap-0.5">
              <Link href="/" className="nav-link">
                Trang chủ
              </Link>
              <Link href="/ask" className="nav-link nav-link-ai">
                Hỏi AI
              </Link>
              {canEdit(user.role) ? (
                <>
                  <Link href="/articles/new" className="nav-link">
                    + Bài viết
                  </Link>
                  <Link href="/cases/new" className="nav-link">
                    + Tình huống
                  </Link>
                  <Link href="/software/new" className="nav-link">
                    + Software
                  </Link>
                </>
              ) : null}
              {canAdmin(user.role) ? (
                <Link href="/admin/users" className="nav-link">
                  Người dùng
                </Link>
              ) : null}
            </nav>
          ) : null}
        </div>
        <div className="text-sm text-[var(--muted)]">
          {user ? (
            <form action={logoutAction} className="flex items-center gap-2">
              <span className="hidden sm:inline">
                <strong className="text-[var(--foreground)]">{user.displayName}</strong>{" "}
                <span className="opacity-70">({user.role})</span>
              </span>
              <button type="submit" className="btn btn-secondary">
                Đăng xuất
              </button>
            </form>
          ) : (
            <Link href="/login" className="btn btn-primary">
              Đăng nhập
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
