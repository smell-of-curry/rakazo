import { i18n } from "@lingui/core";
import type { ConnectionCatalogItem } from "@rakazo/contracts";
import {
  Button,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@rakazo/ui-web";
import { Search } from "lucide-react";
import type { ReactNode } from "react";
import { InstalledRow, type InstallStatus, MarketplaceCard } from "./items";

export type InstalledKind = "connection" | "mcp" | "source";

export type InstalledEntry = {
  id: string;
  kind: InstalledKind;
  name: string;
  logo?: string | null;
  status: InstallStatus;
  extra?: ReactNode;
};

function matchName(name: string, slug: string | undefined, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return name.toLowerCase().includes(needle) || (slug?.toLowerCase().includes(needle) ?? false);
}

export function IntegrationsView({
  query,
  onQuery,
  tab,
  onTab,
  catalog,
  featured,
  installed,
  pending,
  error,
  onConnect,
  onReopen,
  onRemove,
  onAddMcp,
}: {
  query: string;
  onQuery: (value: string) => void;
  tab: "marketplace" | "installed";
  onTab: (tab: "marketplace" | "installed") => void;
  catalog: ConnectionCatalogItem[];
  featured: ConnectionCatalogItem[];
  installed: InstalledEntry[];
  pending: string | null;
  error: string | null;
  onConnect: (item: ConnectionCatalogItem) => void;
  onReopen: (entry: InstalledEntry) => void;
  onRemove: (entry: InstalledEntry) => void;
  onAddMcp: () => void;
}) {
  const searching = Boolean(query.trim());
  const searchLabel = i18n._({ id: "Search", message: "Search" });
  const catalogRows = catalog.filter((item) => matchName(item.name, item.slug, query));
  const featuredRows = searching
    ? []
    : featured.filter((item) => catalog.some((row) => row.slug === item.slug));
  const installedRows = installed.filter((entry) => matchName(entry.name, undefined, query));
  const featuredSlugs = new Set(featuredRows.map((item) => item.slug));
  const rest = catalogRows.filter((item) => !featuredSlugs.has(item.slug));

  function marketplaceCard(item: ConnectionCatalogItem) {
    return (
      <MarketplaceCard
        key={`${item.connectorId}:${item.slug}`}
        name={item.name}
        logo={item.logo}
        connected={item.connected}
        connecting={pending === `${item.connectorId}:${item.slug}`}
        testId={`connection-tile-${item.slug.toLowerCase()}`}
        onConnect={() => onConnect(item)}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <InputGroup className="mx-6 mt-3 h-8 w-auto rounded-full bg-muted">
        <InputGroupAddon>
          <Search size={14} strokeWidth={1.8} aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          aria-label={searchLabel}
          placeholder={searchLabel}
        />
      </InputGroup>
      {error ? <p className="px-6 pt-3 text-small text-destructive">{error}</p> : null}
      <Tabs
        value={tab}
        onValueChange={(value) => onTab(value as "marketplace" | "installed")}
        className="mt-3 min-h-0 flex-1 gap-0"
      >
        <TabsList className="mx-6">
          <TabsTrigger value="marketplace" className="text-body">
            {i18n._({ id: "Marketplace", message: "Marketplace" })}
          </TabsTrigger>
          <TabsTrigger value="installed" className="text-body">
            {i18n._({ id: "Installed", message: "Installed" })}
          </TabsTrigger>
        </TabsList>
        <div id="integration-list" className="rk-scroll min-h-0 flex-1 overflow-y-auto px-6 py-3">
          <TabsContent value="marketplace">
            {!searching && featuredRows.length > 0 ? (
              <div data-testid="featured-connectors">
                {featuredRows.map((item) => marketplaceCard(item))}
              </div>
            ) : null}
            {rest.map((item) => marketplaceCard(item))}
            {catalogRows.length === 0 && featuredRows.length === 0 ? (
              <p className="text-small text-muted-foreground">
                {i18n._({ id: "No apps available yet.", message: "No apps available yet." })}
              </p>
            ) : null}
            <Button
              type="button"
              variant="link"
              size="xs"
              className="mt-2 px-0 text-body text-muted-foreground"
              onClick={onAddMcp}
            >
              {i18n._({ id: "Add MCP server", message: "Add MCP server" })}
            </Button>
          </TabsContent>
          <TabsContent value="installed">
            {installedRows.map((entry) => (
              <InstalledRow
                key={`${entry.kind}:${entry.id}`}
                name={entry.name}
                logo={entry.logo}
                status={entry.status}
                pending={pending === entry.id}
                testId={`installed-${entry.name.toLowerCase().replace(/\s+/g, "-")}`}
                extra={entry.extra}
                onReopen={entry.status === "waiting" ? () => onReopen(entry) : undefined}
                onRemove={() => onRemove(entry)}
              />
            ))}
            <Button
              type="button"
              variant="link"
              size="xs"
              className="mt-2 px-0 text-body text-muted-foreground"
              onClick={onAddMcp}
            >
              {i18n._({ id: "Add MCP server", message: "Add MCP server" })}
            </Button>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
