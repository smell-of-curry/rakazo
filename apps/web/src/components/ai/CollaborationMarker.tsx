import { BotAvatar, type GroupAvatarMember } from "@rakazo/ui-web";

export function CollaborationMarker({
  ariaLabel,
  color,
  identity,
  imageSrc,
  shape,
  label,
  onClick,
}: {
  ariaLabel: string;
  color: string;
  identity: string;
  imageSrc?: string;
  shape?: string | null;
  label: string;
  onClick: () => void;
}) {
  return (
    <div className="flex justify-center">
      <button
        type="button"
        data-testid="peer-receipt-chip"
        aria-label={ariaLabel}
        onClick={onClick}
        className="inline-flex max-w-full items-center gap-1.5 py-1 text-caption text-muted-foreground hover:text-foreground"
      >
        <span aria-hidden className="size-1.5 shrink-0 animate-pulse rounded-full bg-foreground" />
        <BotAvatar color={color} shape={shape} identity={identity} imageSrc={imageSrc} size={14} />
        <span dir="auto" className="truncate">
          {label}
        </span>
      </button>
    </div>
  );
}

export function TypingDots() {
  return (
    <span data-testid="typing-dots" className="inline-flex items-center gap-1" aria-hidden>
      <span className="size-1 animate-pulse rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
      <span className="size-1 animate-pulse rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
      <span className="size-1 animate-pulse rounded-full bg-muted-foreground" />
    </span>
  );
}

export function ActiveBotGlyph({
  bots: _bots,
  label,
}: {
  bots: GroupAvatarMember[];
  label: string;
}) {
  return (
    <div className="flex justify-start" role="status">
      <div
        data-testid="message-bot-bubble"
        className="rounded-[18px] bg-muted px-3 py-2 text-body text-foreground"
      >
        <TypingDots />
        <span className="sr-only">{label}</span>
      </div>
    </div>
  );
}
