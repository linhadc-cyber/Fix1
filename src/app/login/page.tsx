import { LoginForm } from "@/components/LoginForm";
import { requireUser } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const user = await requireUser();
  if (user) {
    redirect("/");
  }

  return (
    <div className="login-shell">
      <div className="login-backdrop" aria-hidden />
      <LoginForm />
    </div>
  );
}
