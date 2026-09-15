import { redirect } from "next/navigation";

export default async function LibraryRedirect({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; equipment?: string }>;
}) {
  const { tab, equipment } = await searchParams;
  const p = new URLSearchParams();
  if (tab) p.set("tab", tab);
  if (equipment) p.set("equipment", equipment);
  const qs = p.toString();
  redirect(qs ? `/?${qs}` : "/");
}
