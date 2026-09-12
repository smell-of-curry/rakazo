import { Trans, useLingui } from "@lingui/react/macro";
import type { Bot, BotMcpServer, McpServer, McpTransport } from "@rakazo/contracts";
import { deriveMcpSlug } from "@rakazo/core";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Field,
  FieldLabel,
  Input,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@rakazo/ui-web";
import { useState } from "react";
import { rpc } from "../../lib/rpc";

export function McpAddDialog({
  open,
  bots,
  botAssignments,
  onClose,
  onCreated,
}: {
  open: boolean;
  bots: Bot[];
  botAssignments: Record<string, BotMcpServer[]>;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const { t } = useLingui();
  const [transport, setTransport] = useState<McpTransport>("streamable_http");
  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [secret, setSecret] = useState("");
  const [headerName, setHeaderName] = useState("Authorization");
  const [headerValue, setHeaderValue] = useState("");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [selectedBotIds, setSelectedBotIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    setName("");
    setEndpoint("");
    setSecret("");
    setHeaderValue("");
    setCommand("");
    setArgs("");
    setSelectedBotIds([]);
    setError(null);
  }

  async function addServer() {
    setError(null);
    if (!name.trim()) {
      setError(t`Add a server name.`);
      return;
    }
    if (transport !== "stdio" && !endpoint.trim()) {
      setError(t`Add an HTTPS server URL.`);
      return;
    }
    if (transport === "stdio" && !command.trim()) {
      setError(t`Add a stdio command.`);
      return;
    }
    setSaving(true);
    try {
      const slug = deriveMcpSlug(name);
      const headers = headerValue.trim()
        ? { [headerName.trim() || "Authorization"]: headerValue.trim() }
        : {};
      const created =
        transport === "stdio"
          ? await rpc.mcp.servers.create({
              slug,
              name: name.trim(),
              transport,
              command: command.trim(),
              args: args.split(/\s+/).filter(Boolean),
              env: {},
              secret: secret || undefined,
              enabled: true,
            })
          : await rpc.mcp.servers.create({
              slug,
              name: name.trim(),
              transport,
              endpoint: endpoint.trim(),
              headers,
              secret: secret || undefined,
              enabled: true,
            });
      await Promise.all(
        selectedBotIds.map((botId) => {
          const existing = (botAssignments[botId] ?? []).filter(
            (entry) => entry.serverId !== created.id,
          );
          return rpc.mcp.assignments.replace({
            botId,
            assignments: [
              ...existing,
              { serverId: created.id, allowAllTools: true, allowedTools: [] },
            ],
          });
        }),
      );
      reset();
      await onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t`Could not add MCP server`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-w-md gap-4 bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-title font-semibold">
            <Trans>Add MCP server</Trans>
          </DialogTitle>
        </DialogHeader>
        {error ? (
          <p role="alert" className="text-small text-destructive">
            {error}
          </p>
        ) : null}
        <Field>
          <FieldLabel htmlFor="mcp-name">
            <Trans>Server name</Trans>
          </FieldLabel>
          <Input
            id="mcp-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Mobbin"
          />
        </Field>
        <Tabs value={transport} onValueChange={(value) => setTransport(value as McpTransport)}>
          <TabsList className="w-full">
            <TabsTrigger value="streamable_http">HTTP</TabsTrigger>
            <TabsTrigger value="sse">SSE</TabsTrigger>
            <TabsTrigger value="stdio">STDIO</TabsTrigger>
          </TabsList>
        </Tabs>
        {transport === "stdio" ? (
          <>
            <Field>
              <FieldLabel htmlFor="mcp-command">
                <Trans>Command</Trans>
              </FieldLabel>
              <Input
                id="mcp-command"
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                placeholder="/opt/mcp-server"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="mcp-args">
                <Trans>Arguments</Trans>
              </FieldLabel>
              <Input
                id="mcp-args"
                value={args}
                onChange={(event) => setArgs(event.target.value)}
                placeholder="--stdio"
              />
            </Field>
          </>
        ) : (
          <Field>
            <FieldLabel htmlFor="mcp-endpoint">
              <Trans>Server URL</Trans>
            </FieldLabel>
            <Input
              id="mcp-endpoint"
              value={endpoint}
              onChange={(event) => setEndpoint(event.target.value)}
              placeholder="https://api.mobbin.com/mcp"
            />
          </Field>
        )}
        <details className="rounded-lg border border-border">
          <summary className="cursor-pointer px-3 py-2 text-body">
            <Trans>Advanced</Trans>
          </summary>
          <div className="space-y-3 border-t border-border p-3">
            <Field>
              <FieldLabel htmlFor="mcp-secret">
                <Trans>Access token (optional)</Trans>
              </FieldLabel>
              <Input
                id="mcp-secret"
                type="password"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                placeholder={t`Stored encrypted`}
              />
            </Field>
            {transport !== "stdio" ? (
              <div className="grid grid-cols-[.7fr_1fr] gap-2">
                <Input
                  aria-label={t`Header name`}
                  value={headerName}
                  onChange={(event) => setHeaderName(event.target.value)}
                />
                <Input
                  aria-label={t`Header value`}
                  type="password"
                  value={headerValue}
                  onChange={(event) => setHeaderValue(event.target.value)}
                />
              </div>
            ) : null}
          </div>
        </details>
        {bots.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {bots.map((bot) => {
              const selected = selectedBotIds.includes(bot.id);
              return (
                <Button
                  key={bot.id}
                  type="button"
                  variant={selected ? "default" : "outline"}
                  size="xs"
                  className="rounded-full"
                  aria-pressed={selected}
                  onClick={() =>
                    setSelectedBotIds((current) =>
                      current.includes(bot.id)
                        ? current.filter((id) => id !== bot.id)
                        : [...current, bot.id],
                    )
                  }
                >
                  {bot.name}
                </Button>
              );
            })}
          </div>
        ) : null}
        <Button type="button" disabled={saving} onClick={() => void addServer()}>
          {saving ? <Trans>Adding…</Trans> : <Trans>Add server</Trans>}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export function mcpStatus(server: McpServer): "connected" | "waiting" | "disabled" {
  if (!server.enabled) return "disabled";
  if (server.oauthStatus === "reconnect") return "waiting";
  if (server.oauthStatus === "none" && server.transport !== "stdio" && !server.hasSecret) {
    return "waiting";
  }
  return "connected";
}
