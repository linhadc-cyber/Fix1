import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { canAdmin, requireUser } from "@/lib/session";
import { updateUser } from "@/app/actions";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireUser();
  if (!me || !canAdmin(me.role)) redirect("/");

  const { id: idStr } = await params;
  const id = Number(idStr);
  const user = db.select().from(users).where(eq(users.id, id)).get();
  if (!user) notFound();

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <p className="text-sm text-[var(--muted)]">
        <Link href="/admin/users">← Danh sách người dùng</Link>
      </p>
      <h1 className="text-2xl font-semibold">Sửa người dùng</h1>
      <form action={updateUser} className="card space-y-3">
        <input type="hidden" name="id" value={user.id} />
        <label>
          <span className="label">Username (đăng nhập)</span>
          <input
            name="username"
            required
            className="input"
            defaultValue={user.username}
          />
        </label>
        <label>
          <span className="label">Tên hiển thị</span>
          <input
            name="displayName"
            required
            className="input"
            defaultValue={user.displayName}
          />
        </label>
        <label>
          <span className="label">Mật khẩu mới (để trống nếu giữ nguyên)</span>
          <input
            name="password"
            type="password"
            className="input"
            autoComplete="new-password"
          />
        </label>
        <label>
          <span className="label">Vai trò</span>
          <select name="role" className="select" defaultValue={user.role}>
            <option value="viewer">Chỉ xem</option>
            <option value="editor">Biên tập</option>
            <option value="admin">Quản trị</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="disabled"
            value="1"
            defaultChecked={user.disabled}
            disabled={user.id === me.id}
          />
          Khóa tài khoản (không cho đăng nhập)
        </label>
        <button type="submit" className="btn btn-primary">
          Lưu thay đổi
        </button>
      </form>
    </div>
  );
}
