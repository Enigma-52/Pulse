import { useState } from "react";
import { Check, Copy } from "lucide-react";

// Small inline copy-to-clipboard affordance for ids and stack traces.
export default function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable (e.g. http) — ignore */
    }
  };

  return (
    <button
      onClick={copy}
      title={copied ? "Copied" : `Copy ${label ?? ""}`.trim()}
      className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground border border-border rounded px-1.5 py-0.5 transition-colors"
    >
      {copied ? <Check className="w-3 h-3 text-status-ok" /> : <Copy className="w-3 h-3" />}
      {copied ? "copied" : label ?? "copy"}
    </button>
  );
}
