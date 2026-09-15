import { redirect } from "next/navigation";

export default async function MediaRedirect({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const { kind } = await searchParams;
  if (kind) redirect(`/library?tab=docs`);
  redirect("/library?tab=docs");
}
