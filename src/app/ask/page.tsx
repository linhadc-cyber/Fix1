import { AskChat } from "@/components/AskChat";
import { hasAiKey, resolveAiConfig } from "@/lib/ai/ask";

export default async function AskPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const cfg = resolveAiConfig();
  const modelLabel = cfg
    ? `Provider: ${cfg.provider === "ark" ? "ModelArk" : "DeepSeek"} · ${cfg.model}`
    : undefined;

  return (
    <div className="ask-page w-full">
      <AskChat
        hasKey={hasAiKey()}
        modelLabel={modelLabel}
        initialQuestion={(q || "").trim()}
      />
    </div>
  );
}
