import { Trans } from "@lingui/react/macro";
import { ArrowUp } from "lucide-react";
import type { ReactNode, UIEventHandler } from "react";
import { useEffect, useRef, useState } from "react";
import { countUnreadsAbove } from "./more-unreads-count";

function unreadBottoms(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>("[data-roster-unread]")].map(
    (row) => row.getBoundingClientRect().bottom,
  );
}

function scrollToUnreadAbove(root: HTMLElement) {
  const top = root.getBoundingClientRect().top;
  const row = [...root.querySelectorAll<HTMLElement>("[data-roster-unread]")].find(
    (item) => item.getBoundingClientRect().bottom < top,
  );
  row?.scrollIntoView({ block: "start" });
}

/** Blue jump pill when unread chats have scrolled above the roster. */
export function MoreUnreads({
  className,
  children,
  onScroll,
}: {
  className: string;
  children: ReactNode;
  onScroll?: UIEventHandler<HTMLDivElement>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(0);
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const measure = () =>
      setCount(countUnreadsAbove(root.getBoundingClientRect().top, unreadBottoms(root)));
    measure();
    root.addEventListener("scroll", measure, { passive: true });
    const mutations = new MutationObserver(measure);
    mutations.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-roster-unread"],
    });
    const resize = new ResizeObserver(measure);
    resize.observe(root);
    return () => {
      root.removeEventListener("scroll", measure);
      mutations.disconnect();
      resize.disconnect();
    };
  }, []);
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {count > 0 ? (
        <button
          type="button"
          data-testid="more-unreads"
          className="absolute top-2 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-unread px-3 py-1 text-[12px] font-medium text-white shadow-sm"
          onClick={() => {
            const root = scrollRef.current;
            if (root) scrollToUnreadAbove(root);
          }}
        >
          <ArrowUp size={14} strokeWidth={2} aria-hidden="true" />
          <Trans>More unreads</Trans>
        </button>
      ) : null}
      <div ref={scrollRef} className={className} onScroll={onScroll}>
        {children}
      </div>
    </div>
  );
}
