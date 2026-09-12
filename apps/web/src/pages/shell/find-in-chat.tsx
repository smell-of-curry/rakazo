import { t } from "@lingui/core/macro";
import { Button, Input } from "@rakazo/ui-web";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef } from "react";

export type FindableMessage = { id: string; text: string };

export function highlightQuery(text: string, query: string): ReactNode {
  const needle = query.trim();
  if (!needle) return text;
  const lower = text.toLowerCase();
  const find = needle.toLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  let index = lower.indexOf(find);
  let key = 0;
  while (index !== -1) {
    if (index > cursor) parts.push(text.slice(cursor, index));
    parts.push(
      <mark key={key} className="bg-warning/30 text-inherit">
        {text.slice(index, index + needle.length)}
      </mark>,
    );
    key += 1;
    cursor = index + needle.length;
    index = lower.indexOf(find, cursor);
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

export function collectFindMatches(messages: readonly FindableMessage[], query: string): string[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return messages.filter((message) => message.text.toLowerCase().includes(needle)).map((m) => m.id);
}

export function FindInChat({
  open,
  query,
  onQuery,
  matches,
  activeIndex,
  onActiveIndex,
  onClose,
}: {
  open: boolean;
  query: string;
  onQuery: (value: string) => void;
  matches: readonly string[];
  activeIndex: number;
  onActiveIndex: (index: number) => void;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const count = matches.length;
  const label = useMemo(() => {
    if (!query.trim()) return "";
    if (count === 0) return "0/0";
    return `${activeIndex + 1}/${count}`;
  }, [activeIndex, count, query]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function cycle(delta: number) {
    if (count === 0) return;
    onActiveIndex((activeIndex + delta + count) % count);
  }

  return (
    <div
      data-testid="find-in-chat"
      className="absolute end-3 top-3 z-30 flex h-9 items-center gap-1 rounded-full border border-border bg-card px-2 shadow-md"
    >
      <Input
        ref={inputRef}
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            cycle(event.shiftKey ? -1 : 1);
          }
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
        }}
        placeholder={t`Find in chat`}
        aria-label={t`Find in chat`}
        className="h-7 min-w-36 border-0 bg-transparent px-2 text-body shadow-none focus-visible:ring-0"
      />
      <span className="min-w-8 text-center text-caption text-muted-foreground">{label}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={t`Previous match`}
        disabled={count === 0}
        onClick={() => cycle(-1)}
      >
        <ChevronUp />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={t`Next match`}
        disabled={count === 0}
        onClick={() => cycle(1)}
      >
        <ChevronDown />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={t`Close find`}
        onClick={onClose}
      >
        <X />
      </Button>
    </div>
  );
}
