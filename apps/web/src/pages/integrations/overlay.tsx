import { Trans, useLingui } from "@lingui/react/macro";
import type {
  Bot,
  BotMcpServer,
  CapabilityInstall,
  Connection,
  ConnectionCatalogItem,
  McpServer,
} from "@rakazo/contracts";
import { abortableDelay, buildFeaturedConnectorTiles } from "@rakazo/core";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@rakazo/ui-web";
import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { connectMcpOauth, MCP_OAUTH_CHANNEL } from "../../lib/mcp-connect";
import { rpc } from "../../lib/rpc";
import { McpAddDialog, mcpStatus } from "./mcp-form";
import { type InstalledEntry, IntegrationsView } from "./view";

function itemKey(item: Pick<ConnectionCatalogItem, "connectorId" | "slug">) {
  return `${item.connectorId}:${item.slug}`;
}

function markConnected(
  items: ConnectionCatalogItem[],
  connectorId: string,
  slug: string,
  connected: boolean,
) {
  return items.map((entry) =>
    entry.connectorId === connectorId && entry.slug === slug ? { ...entry, connected } : entry,
  );
}

function activeAccounts(
  connections: Connection[],
  item: Pick<ConnectionCatalogItem, "connectorId" | "slug">,
) {
  return connections.filter(
    (row) =>
      row.connectorId === item.connectorId &&
      row.provider === item.slug &&
      (row.status === "connected" || row.status === "pending"),
  );
}

function connectionStatus(row: Connection): InstalledEntry["status"] {
  if (row.status === "pending") return "waiting";
  if (row.status === "error") return "disabled";
  return "connected";
}

function catalogFor(catalog: ConnectionCatalogItem[], row: Connection) {
  return catalog.find(
    (entry) => entry.connectorId === row.connectorId && entry.slug === row.provider,
  );
}

export function PluginsOverlay({
  onClose,
  activeBotId,
}: {
  onClose: () => void;
  activeBotId?: string;
}) {
  const { t } = useLingui();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"marketplace" | "installed">("marketplace");
  const [catalog, setCatalog] = useState<ConnectionCatalogItem[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [sources, setSources] = useState<CapabilityInstall[]>([]);
  const [servers, setServers] = useState<McpServer[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [botAssignments, setBotAssignments] = useState<Record<string, BotMcpServer[]>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addMcp, setAddMcp] = useState(false);
  const connectionAttempt = useRef<AbortController | null>(null);

  async function refresh() {
    const [items, installs, rows, nextServers, nextBots, assignments] = await Promise.all([
      rpc.connections.catalog({}),
      rpc.capabilities.list(),
      rpc.connections.list(),
      rpc.mcp.servers.list(),
      rpc.bots.list(),
      rpc.mcp.assignments.all(),
    ]);
    const activeBots = nextBots.filter((bot) => !bot.archivedAt);
    setCatalog(items);
    setConnections(rows);
    setSources(
      installs.filter(
        (install) => install.kind === "mcp" || install.kind === "api" || install.kind === "graphql",
      ),
    );
    setServers(nextServers);
    setBots(activeBots);
    setBotAssignments(
      Object.fromEntries(
        activeBots.map((bot) => [
          bot.id,
          assignments.filter((assignment) => assignment.botId === bot.id),
        ]),
      ),
    );
    return items;
  }

  useEffect(() => {
    void refresh().catch((err: unknown) =>
      setError(err instanceof Error ? err.message : t`Could not load integrations`),
    );
    return () => connectionAttempt.current?.abort();
  }, []);

  useEffect(() => {
    const channel = new BroadcastChannel(MCP_OAUTH_CHANNEL);
    channel.onmessage = (event: MessageEvent) => {
      if ((event.data as { type?: string } | null)?.type !== "mcp-oauth-complete") return;
      void refresh().catch(() => undefined);
    };
    return () => channel.close();
  }, []);

  const featured = useMemo(
    () =>
      buildFeaturedConnectorTiles(catalog)
        .map((tile) => tile.item)
        .filter((item): item is ConnectionCatalogItem => Boolean(item)),
    [catalog],
  );

  function setItemConnected(item: ConnectionCatalogItem, connected: boolean) {
    setCatalog((prev) => markConnected(prev, item.connectorId, item.slug, connected));
  }

  async function notifyAppConnected(item: ConnectionCatalogItem) {
    if (!activeBotId) return;
    await rpc.onboarding
      .appConnected({ botId: activeBotId, provider: item.slug, connectorId: item.connectorId })
      .catch(() => undefined);
  }

  async function connect(item: ConnectionCatalogItem) {
    connectionAttempt.current?.abort();
    const controller = new AbortController();
    connectionAttempt.current = controller;
    setError(null);
    const key = itemKey(item);
    setPending(key);
    try {
      const existing = activeAccounts(connections, item).filter(
        (row) => row.status === "connected",
      );
      const started = await rpc.connections.begin({
        connectorId: item.connectorId,
        provider: item.slug,
        displayName: existing.length <= 0 ? item.name : `${item.name} ${existing.length + 1}`,
      });
      if (started.authorizationUrl) {
        window.open(started.authorizationUrl, "rakazo-plugin-connect", "noopener,noreferrer");
      }
      if (item.noAuth && !started.authorizationUrl) {
        if (controller.signal.aborted) return;
        setItemConnected(item, true);
        void notifyAppConnected(item);
        await refresh().catch(() => undefined);
        return;
      }
      for (let i = 0; i < 45; i += 1) {
        if (controller.signal.aborted) return;
        const row = await rpc.connections
          .complete({ connectionId: started.connectionId })
          .catch(() => undefined);
        if (row?.status === "connected") {
          if (controller.signal.aborted) return;
          setItemConnected(item, true);
          void notifyAppConnected(item);
          await refresh().catch(() => undefined);
          return;
        }
        await abortableDelay(2_000, controller.signal);
      }
      if (controller.signal.aborted) return;
      setError(t`Connection to ${item.name} is still pending. You can close this and check again.`);
      await refresh().catch(() => undefined);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : t`Could not connect`);
    } finally {
      if (connectionAttempt.current === controller) {
        connectionAttempt.current = null;
        setPending(null);
      }
    }
  }

  async function revokeConnection(row: Connection, item?: ConnectionCatalogItem) {
    setError(null);
    setPending(row.id);
    try {
      await rpc.connections.revoke({ connectionId: row.id });
      if (item) {
        const remaining = activeAccounts(connections, item).filter((entry) => entry.id !== row.id);
        if (remaining.every((entry) => entry.status !== "connected")) {
          setItemConnected(item, false);
        }
      }
      await refresh().catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : t`Could not revoke connection`);
    } finally {
      setPending(null);
    }
  }

  async function connectOAuth(server: McpServer) {
    setError(null);
    setPending(server.id);
    try {
      const result = await connectMcpOauth(server.id);
      await refresh();
      if (result === "already_connected") {
        setError(t`This server is already connected. Disconnect it first to authorize again.`);
      } else if (result === "authorization_not_requested") {
        setError(t`This server did not request browser authorization.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t`Could not start OAuth`);
    } finally {
      setPending(null);
    }
  }

  async function removeServer(server: McpServer) {
    setError(null);
    setPending(server.id);
    try {
      await rpc.mcp.servers.remove({ id: server.id });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t`Could not delete MCP server`);
    } finally {
      setPending(null);
    }
  }

  async function removeSource(install: CapabilityInstall) {
    setPending(install.id);
    setError(null);
    try {
      await rpc.capabilities.remove({ id: install.id });
      setSources((current) => current.filter((source) => source.id !== install.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t`Could not remove connector`);
    } finally {
      setPending(null);
    }
  }

  async function toggleAssignment(server: McpServer, botId: string) {
    setError(null);
    const current = botAssignments[botId] ?? [];
    const assigned = current.some((entry) => entry.serverId === server.id);
    const next = assigned
      ? current.filter((entry) => entry.serverId !== server.id)
      : [...current, { serverId: server.id, allowAllTools: true, allowedTools: [] }];
    try {
      const updated = await rpc.mcp.assignments.replace({ botId, assignments: next });
      setBotAssignments((map) => ({ ...map, [botId]: updated }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t`Could not update agent access`);
    }
  }

  const installed: InstalledEntry[] = [
    ...connections
      .filter(
        (row) => row.status === "connected" || row.status === "pending" || row.status === "error",
      )
      .map((row) => ({
        id: row.id,
        kind: "connection" as const,
        name: row.displayName,
        logo: catalogFor(catalog, row)?.logo,
        status: connectionStatus(row),
      })),
    ...servers.map((server) => ({
      id: server.id,
      kind: "mcp" as const,
      name: server.name,
      status: mcpStatus(server),
      extra:
        bots.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1.5 pl-11">
            {bots.map((bot) => {
              const assigned = (botAssignments[bot.id] ?? []).some(
                (entry) => entry.serverId === server.id,
              );
              return (
                <Button
                  key={bot.id}
                  type="button"
                  variant={assigned ? "default" : "outline"}
                  size="xs"
                  className="rounded-full"
                  aria-pressed={assigned}
                  onClick={() => void toggleAssignment(server, bot.id)}
                >
                  {bot.name}
                </Button>
              );
            })}
          </div>
        ) : undefined,
    })),
    ...sources.map((source) => ({
      id: source.id,
      kind: "source" as const,
      name: source.name,
      status: "connected" as const,
    })),
  ];

  function onReopen(entry: InstalledEntry) {
    if (entry.kind === "connection") {
      const row = connections.find((item) => item.id === entry.id);
      const item = row ? catalogFor(catalog, row) : undefined;
      if (item) void connect(item);
      return;
    }
    const server = servers.find((item) => item.id === entry.id);
    if (server) void connectOAuth(server);
  }

  function onRemove(entry: InstalledEntry) {
    if (entry.kind === "connection") {
      const row = connections.find((item) => item.id === entry.id);
      if (row) void revokeConnection(row, catalogFor(catalog, row));
      return;
    }
    if (entry.kind === "mcp") {
      const server = servers.find((item) => item.id === entry.id);
      if (server) void removeServer(server);
      return;
    }
    const source = sources.find((item) => item.id === entry.id);
    if (source) void removeSource(source);
  }

  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="flex h-[640px] max-h-[calc(100%-2rem)] w-[560px] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-2xl bg-card p-0 sm:max-w-[560px]"
        >
          <DialogHeader className="flex-row items-center justify-between px-6 pt-5">
            <DialogTitle className="text-title font-semibold text-foreground">
              <Trans>Integrations</Trans>
            </DialogTitle>
            <DialogClose
              render={<Button variant="ghost" size="icon-sm" aria-label={t`Close integrations`} />}
            >
              <X />
            </DialogClose>
          </DialogHeader>
          <IntegrationsView
            query={query}
            onQuery={setQuery}
            tab={tab}
            onTab={setTab}
            catalog={catalog}
            featured={featured}
            installed={installed}
            pending={pending}
            error={error}
            onConnect={(item) => void connect(item)}
            onReopen={onReopen}
            onRemove={onRemove}
            onAddMcp={() => setAddMcp(true)}
          />
        </DialogContent>
      </Dialog>
      <McpAddDialog
        open={addMcp}
        bots={bots}
        botAssignments={botAssignments}
        onClose={() => setAddMcp(false)}
        onCreated={async () => {
          await refresh();
        }}
      />
    </>
  );
}
