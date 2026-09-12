import {
  AVATAR_CENTER,
  AVATAR_EYE_INK,
  AVATAR_SHAPES,
  AVATAR_VIEWBOX,
  resolveAvatarColorDef,
  resolveAvatarShape,
} from "@rakazo/core";

export function LandingBotAvatar({
  color,
  size = 38,
  identity,
  className,
}: {
  color: string;
  size?: number;
  identity?: string;
  className?: string;
}) {
  const seed = identity ?? color;
  const colorDef = resolveAvatarColorDef(seed, color);
  const shape = resolveAvatarShape(seed);
  const gradId = `landing-${seed.replace(/[^a-zA-Z0-9-_]/g, "")}`;

  return (
    <svg
      aria-hidden="true"
      className={className}
      height={size}
      viewBox={AVATAR_VIEWBOX}
      width={size}
      style={{ width: size, height: size, flex: "none" }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={colorDef.light} />
          <stop offset="100%" stopColor={colorDef.dark} />
        </linearGradient>
      </defs>
      <path d={AVATAR_SHAPES[shape]} fill={`url(#${gradId})`} />
      <g fill={AVATAR_EYE_INK}>
        <ellipse cx={AVATAR_CENTER - 29} cy={AVATAR_CENTER - 8} rx={10} ry={7} />
        <ellipse cx={AVATAR_CENTER + 29} cy={AVATAR_CENTER - 8} rx={10} ry={7} />
      </g>
    </svg>
  );
}
