import Link from "next/link";
import { db } from "@/db";
import { users } from "@/db/schema";
import { canAdmin, requireUser } from "@/lib/session";
import { createUser, deleteUser, toggleUserDisabled } from "@/app/actions";
import { roleLabel } from "@/lib/utils";
import { redirect } from "next/navigation";
import { ConfirmDelete } from "@/components/ConfirmDelete";

export default async function AdminUsersPage() {
  const me = await requireUser();
  if (!me || !canAdmin(me.role)) {
    redirect("/");
  }

  const list = db.select().from(users).all();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Quản lý người dùng</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Chỉ admin. Có thể sửa / khóa / xóa tài khoản (xóa chỉ khi chưa có nội dung).
        </p>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-[var(--muted)]">
              <th className="py-2 pr-3">Tài khoản</th>
              <th className="py-2 pr-3">Tên hiển thị</th>
              <th className="py-2 pr-3">Vai trò</th>
              <th className="py-2 pr-3">Trạng thái</th>
              <th className="py-2">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id} className="border-b border-[var(--border)]">
                <td className="py-2.5 pr-3">{u.username}</td>
                <td className="py-2.5 pr-3">{u.displayName}</td>
                <td className="py-2.5 pr-3">{roleLabel[u.role] || u.role}</td>
                <td className="py-2.5 pr-3">
                  {u.disabled ? (
                    <span className="text-red-700">Đã khóa</span>
                  ) : (
                    <span className="text-[var(--brand)]">Đang mở</span>
                  )}
                </td>
                <td className="py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/users/${u.id}/edit`}
                        className="btn btn-secondary"
                      >
                        Sửa
                      </Link>
                      {u.id !== me.id ? (
                        <form action={toggleUserDisabled}>
                          <input type="hidden" name="id" value={u.id} />
                          <button type="submit" className="btn btn-secondary">
                            {u.disabled ? "Mở khóa" : "Khóa"}
                          </button>
                        </form>
                      ) : (
                        <span className="self-center text-[var(--muted)]">Bạn</span>
                      )}
                    </div>
                    {u.id !== me.id ? (
                      <ConfirmDelete
                        message={`Xóa tài khoản “${u.username}”? Chỉ xóa được khi chưa có nội dung.`}
                        action={deleteUser}
                        hiddenFields={{ id: u.id }}
                      />
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form action={createUser} className="card max-w-lg space-y-3">
        <h2 className="text-lg font-semibold">Thêm người dùng</h2>
        <label>
          <span className="label">Username</span>
          <input name="username" required className="input" />
        </label>
        <label>
          <span className="label">Tên hiển thị</span>
          <input name="displayName" required className="input" />
        </label>
        <label>
          <span className="label">Mật khẩu</span>
          <input name="password" type="password" required className="input" />
        </label>
        <label>
          <span className="label">Vai trò</span>
          <select name="role" className="select" defaultValue="viewer">
            <option value="viewer">Chỉ xem</option>
            <option value="editor">Biên tập</option>
            <option value="admin">Quản trị</option>
          </select>
        </label>
        <button type="submit" className="btn btn-primary">
          Tạo tài khoản
        </button>
      </form>
    </div>
  );
}
