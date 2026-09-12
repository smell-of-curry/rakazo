import {
  AVATAR_CENTER,
  AVATAR_SHAPES,
  AVATAR_VIEWBOX,
  type AvatarShape,
  resolveAvatarColorDef,
  resolveAvatarShape,
} from "@rakazo/core";
import { memo, useEffect, useId, useState } from "react";
import { cn } from "./lib/utils.js";
import "./styles.css";

export interface BotAvatarProps {
  imageSrc?: string;
  color: string;
  shape?: string | null;
  identity?: string;
  size?: number;
  className?: string;
  status?: string;
}

export const BotAvatar = memo(function BotAvatar({
  imageSrc,
  color,
  shape,
  identity = "",
  size = 36,
  className,
}: BotAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => {
    setImageFailed(false);
  }, [imageSrc]);
  const gradId = useId().replace(/[^a-zA-Z0-9-_]/g, "");
  const colorDef = resolveAvatarColorDef(identity, color);
  const resolvedShape = resolveAvatarShape(identity, shape);

  if (imageSrc && !imageFailed) {
    return (
      <div
        className={cn("relative overflow-hidden rounded-full select-none shrink-0", className)}
        style={{ width: size, height: size }}
      >
        <img
          alt=""
          src={imageSrc}
          className="size-full rounded-full object-cover"
          onError={() => setImageFailed(true)}
        />
      </div>
    );
  }

  return (
    <svg
      viewBox={AVATAR_VIEWBOX}
      width={size}
      height={size}
      aria-hidden="true"
      className={cn("shrink-0 overflow-visible select-none", className)}
    >
      <defs>
        <linearGradient id={`avatar-ink-${gradId}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={colorDef.light} />
          <stop offset="100%" stopColor={colorDef.dark} />
        </linearGradient>
      </defs>
      <path d={AVATAR_SHAPES[resolvedShape]} fill={`url(#avatar-ink-${gradId})`} />
      <g fill="var(--primary)">
        <ellipse cx={AVATAR_CENTER - 29} cy={AVATAR_CENTER - 8} rx={10} ry={7} />
        <ellipse cx={AVATAR_CENTER + 29} cy={AVATAR_CENTER - 8} rx={10} ry={7} />
      </g>
    </svg>
  );
});

export function AvatarShapePreview({
  shape,
  color,
  selected,
  onClick,
}: {
  shape: AvatarShape;
  color: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  const colorDef = resolveAvatarColorDef("preview", color);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={shape}
      aria-pressed={selected ?? false}
      className={cn(
        "relative flex size-11 items-center justify-center rounded-xl transition-transform hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "hover:bg-muted",
      )}
    >
      <svg viewBox={AVATAR_VIEWBOX} className="size-8 overflow-visible" aria-hidden="true">
        <path d={AVATAR_SHAPES[shape]} fill={colorDef.light} />
        <g fill="var(--primary)">
          <ellipse cx={AVATAR_CENTER - 29} cy={AVATAR_CENTER - 8} rx={10} ry={7} />
          <ellipse cx={AVATAR_CENTER + 29} cy={AVATAR_CENTER - 8} rx={10} ry={7} />
        </g>
      </svg>
    </button>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex h-11 w-11 items-center justify-center gap-1.5 rounded-full bg-card">
        <span className="h-4 w-[7px] rounded-full bg-primary" />
        <span className="h-4 w-[7px] rounded-full bg-primary" />
      </div>
      <span className="font-[Aeonik,ui-sans-serif] text-[28px] tracking-tight text-foreground">
        Rakazo
      </span>
    </div>
  );
}
