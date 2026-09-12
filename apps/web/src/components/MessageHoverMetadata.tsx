import type { ReactNode } from "react";

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
      className={`pointer-events-none absolute top-1/2 z-10 flex -translate-y-1/2 items-center opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100 ${
        pinned ? "pointer-events-auto opacity-100" : ""
      } ${side === "end" ? "start-full ms-1" : "end-full me-1"}`}
    >
      {children}
    </div>
  );
}
