import type { ReactNode } from "react";

/** Shared so the timestamp matches the rail: 0 at rest on fine pointers, 1 on hover. */
export const messageHoverRevealClass =
  "opacity-100 transition-opacity [@media(hover:hover)_and_(pointer:fine)]:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover/message:opacity-100";

export function MessageHoverMetadata({
  side,
  pinned = false,
  children,
}: {
  side: "start" | "end";
  pinned?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      data-testid="message-hover-rail"
      data-hover-pinned={pinned ? "" : undefined}
      className={`absolute top-1/2 z-10 flex -translate-y-1/2 items-center pointer-events-auto ${messageHoverRevealClass} [@media(hover:hover)_and_(pointer:fine)]:pointer-events-none [@media(hover:hover)_and_(pointer:fine)]:group-hover/message:pointer-events-auto focus-within:pointer-events-auto focus-within:opacity-100 ${
        pinned ? "pointer-events-auto opacity-100" : ""
      } ${side === "end" ? "start-full ms-1" : "end-full me-1"}`}
    >
      {children}
    </div>
  );
}
