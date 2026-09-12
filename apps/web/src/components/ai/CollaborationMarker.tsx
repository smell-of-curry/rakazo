import { BotAvatar, GroupAvatar, type GroupAvatarMember } from "@rakazo/ui-web";

/** Lightweight peer event shown without exposing the exchanged message body. */
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
    <div className="flex justify-start">
      <button
        type="button"
        data-testid="peer-receipt-chip"
        aria-label={ariaLabel}
        onClick={onClick}
        className="inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground/75"
      >
        <BotAvatar color={color} shape={shape} identity={identity} imageSrc={imageSrc} size={16} />
        <span dir="auto" className="truncate">
          {label}
        </span>
      </button>
    </div>
  );
}

export function ActiveBotGlyph({ bots, label }: { bots: GroupAvatarMember[]; label: string }) {
  return (
    <div className="flex min-h-10 items-center gap-2 px-1" role="status">
      <GroupAvatar members={bots} size={28} />
      <span className="text-[13.5px] text-muted-foreground">{label}</span>
    </div>
  );
}
