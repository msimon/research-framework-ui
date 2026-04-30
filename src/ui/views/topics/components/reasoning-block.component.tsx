'use client';

type Props = {
  text: string;
  open: boolean;
  onToggle: () => void;
};

export function ReasoningBlock({ text, open, onToggle }: Props) {
  return (
    <details
      open={open}
      onToggle={onToggle}
      className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground"
    >
      <summary className="cursor-pointer select-none font-medium">Thinking…</summary>
      <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] leading-relaxed">{text}</pre>
    </details>
  );
}
