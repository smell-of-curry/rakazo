import { t } from "@lingui/core/macro";
import type { ComputerReleaseReason, ComputerStatus, ThreadSnapshot } from "@rakazo/contracts";
import type { MutableRefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadComputerScreen } from "../../lib/computer-screen";
import { rpc } from "../../lib/rpc";
import {
  computerBootInFlight,
  computerCanShowScreen,
  computerPanelAutoBoot,
  computerPanelAutoUsesBoot,
  computerTakeoverBlocked,
  userHoldsComputerControl,
} from "../../lib/thread-events";
import type { Panel } from "./types";

export type ComputerCacheEntry = {
  computer: ComputerStatus | null;
  screenUrl: string | null;
};

export type UseComputerArgs = {
  panel: Panel;
  activeId: string | undefined;
  activeBotId: MutableRefObject<string | undefined>;
  snapshot: ThreadSnapshot | null;
  refreshThread: (id: string, signal?: AbortSignal) => Promise<ThreadSnapshot | null | undefined>;
};

export function useComputer({
  panel,
  activeId,
  activeBotId,
  snapshot,
  refreshThread,
}: UseComputerArgs) {
  const refreshThreadRef = useRef(refreshThread);
  refreshThreadRef.current = refreshThread;
  const [computer, setComputer] = useState<ComputerStatus | null>(null);
  const computerRef = useRef<ComputerStatus | null>(null);
  const computerCacheRef = useRef(new Map<string, ComputerCacheEntry>());
  const COMPUTER_CACHE_LIMIT = 20;

  function cacheComputerFor(botId: string, patch: Partial<ComputerCacheEntry>) {
    const cache = computerCacheRef.current;
    const prev = cache.get(botId) ?? { computer: null, screenUrl: null };
    cache.delete(botId);
    cache.set(botId, { ...prev, ...patch });
    if (cache.size > COMPUTER_CACHE_LIMIT) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
  }

  function commitComputer(next: ComputerStatus | null) {
    computerRef.current = next;
    setComputer(next);
  }

  const [screenUrl, setScreenUrl] = useState<string | null>(null);
  const [computerOpen, setComputerOpen] = useState(false);
  const [computerViewport, setComputerViewport] = useState<{
    height: number;
    offsetTop: number;
  } | null>(null);
  const [computerError, setComputerError] = useState<string | null>(null);
  const [computerErrorFromScreen, setComputerErrorFromScreen] = useState(false);
  const [booting, setBooting] = useState(false);
  const autoBooted = useRef<string | null>(null);
  const screenRequest = useRef(0);
  const computerVisible = useRef(false);
  computerVisible.current = panel === "computer" || computerOpen;

  useEffect(() => {
    if (!computerOpen) {
      setComputerViewport(null);
      return;
    }
    const viewport = window.visualViewport;
    if (!viewport) return;
    const sync = () => {
      setComputerViewport({ height: viewport.height, offsetTop: viewport.offsetTop });
    };
    sync();
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    return () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
    };
  }, [computerOpen]);

  async function refreshComputerScreen(id: string) {
    if (!computerVisible.current) return null;
    const request = ++screenRequest.current;
    return loadComputerScreen({
      load: () => rpc.computer.screenUrl({ botId: id }),
      isCurrent: () =>
        request === screenRequest.current && activeBotId.current === id && computerVisible.current,
      commit: (screen) => {
        setScreenUrl(screen.url);
        setComputerError(screen.error);
        setComputerErrorFromScreen(Boolean(screen.error));
        cacheComputerFor(id, { screenUrl: screen.url });
      },
      fallbackError: t`Could not connect to the computer screen`,
    });
  }

  async function bootComputer({
    takeControl,
    overlay,
    force = false,
  }: {
    takeControl: boolean;
    overlay: boolean;
    force?: boolean;
  }) {
    if (!activeId) return;
    const needsBoot =
      !computerBootInFlight(computer?.state) &&
      (force || computer?.state !== "running" || !screenUrl);
    if (overlay && needsBoot) setBooting(true);
    setComputerError(null);
    setComputerErrorFromScreen(false);
    try {
      if (needsBoot) await rpc.computer.boot({ botId: activeId });
      if (takeControl) await rpc.computer.takeover({ botId: activeId });
      await refreshThread(activeId);
    } catch (error) {
      setComputerError(error instanceof Error ? error.message : t`Could not take control`);
      setComputerErrorFromScreen(false);
      throw error;
    } finally {
      setBooting(false);
    }
  }

  useEffect(() => {
    if (panel !== "computer") {
      autoBooted.current = null;
      return;
    }
    if (!activeId) return;
    const botId = activeId;
    let cancelled = false;
    void (async () => {
      const snap = await refreshThreadRef.current(botId).catch(() => null);
      if (cancelled || activeBotId.current !== botId) return;
      const state = snap?.computer?.state;
      const screen = state === "running" ? await refreshComputerScreen(botId) : null;
      if (cancelled || activeBotId.current !== botId) return;
      const action = computerPanelAutoBoot(state, screen);
      if (action === "wait") {
        if (state === "running") autoBooted.current = botId;
        return;
      }
      if (action === "boot" && autoBooted.current === botId) return;
      autoBooted.current = botId;
      if (!computerPanelAutoUsesBoot(action)) return;
      await bootComputer({
        takeControl: false,
        overlay: action === "boot",
        force: true,
      }).catch(() => undefined);
    })();
    return () => {
      cancelled = true;
    };
  }, [panel, activeId]);

  useEffect(() => {
    setComputerOpen(false);
    setComputerError(null);
    setComputerErrorFromScreen(false);
  }, [activeId]);

  useEffect(() => {
    if (!computer?.busyBotName) {
      setComputerError(null);
      setComputerErrorFromScreen(false);
    }
  }, [computer?.busyBotName]);

  useEffect(() => {
    if (!computerOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setComputerOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [computerOpen]);

  useEffect(() => {
    if ((panel !== "computer" && !computerOpen) || !activeId || computer?.state !== "running")
      return;
    const ping = () => void rpc.computer.heartbeat({ botId: activeId }).catch(() => undefined);
    ping();
    const timer = window.setInterval(ping, 60_000);
    return () => window.clearInterval(timer);
  }, [panel, computerOpen, activeId, computer?.state]);

  useEffect(() => {
    const botId = activeId;
    if ((panel !== "computer" && !computerOpen) || !botId) return;
    if (computerCanShowScreen(computer?.state, screenUrl)) return;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      void refreshThreadRef.current(botId).catch(() => undefined);
    };
    tick();
    const timer = window.setInterval(tick, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [panel, computerOpen, activeId, computer?.state, screenUrl]);

  async function openComputer() {
    if (!activeId) return;
    if (computerBootInFlight(computer?.state)) {
      setComputerError(null);
      setComputerErrorFromScreen(false);
      setComputerOpen(true);
      void refreshComputerScreen(activeId).catch(() => undefined);
      return;
    }
    const needsTakeover = !userHoldsComputerControl(computer, activeId);
    const blocked = computerTakeoverBlocked(computer, snapshot?.run?.status);
    try {
      await bootComputer({
        takeControl: needsTakeover && !blocked,
        overlay: (needsTakeover && !blocked) || computer?.state !== "running",
        force: computer?.state !== "running",
      });
      setComputerOpen(true);
    } catch {
      // computerError already set in bootComputer
    }
  }

  const releaseComputer = useCallback(
    async (reason?: ComputerReleaseReason) => {
      const botId = activeBotId.current;
      if (!botId) return;
      try {
        await rpc.computer.release({ botId, reason });
        if (activeBotId.current !== botId) return;
        setComputerOpen(false);
        await refreshThreadRef.current(botId).catch(() => undefined);
      } catch {
        if (activeBotId.current !== botId) return;
        setComputerError(t`Could not continue`);
        setComputerErrorFromScreen(false);
      }
    },
    [activeBotId, refreshThreadRef],
  );

  return {
    computer,
    computerRef,
    computerCacheRef,
    cacheComputerFor,
    commitComputer,
    screenUrl,
    setScreenUrl,
    computerOpen,
    setComputerOpen,
    computerViewport,
    computerError,
    setComputerError,
    computerErrorFromScreen,
    setComputerErrorFromScreen,
    booting,
    setBooting,
    computerVisible,
    screenRequest,
    refreshComputerScreen,
    bootComputer,
    openComputer,
    releaseComputer,
  };
}
