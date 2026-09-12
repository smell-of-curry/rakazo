import type {
  AgentSkillCatalogEntry,
  Bot,
  Connection,
  ConnectionCatalogItem,
  Routine,
  TaughtSkill,
} from "@rakazo/contracts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { rpc } from "../../lib/rpc";

export function useSkills(bots: Bot[], initialBotsLoaded: boolean) {
  const [taughtSkills, setTaughtSkills] = useState<TaughtSkill[]>([]);
  const [taughtSkillsBotId, setTaughtSkillsBotId] = useState<string | null>(null);
  const [agentSkills, setAgentSkills] = useState<AgentSkillCatalogEntry[]>([]);
  const [mentionRoutines, setMentionRoutines] = useState<Array<Routine & { botName?: string }>>([]);
  const [mentionConnectors, setMentionConnectors] = useState<
    Array<{
      id: string;
      name: string;
      authStatus: "connected" | "needs_auth";
      connectionId?: string;
    }>
  >([]);
  const [teachBusy, setTeachBusy] = useState(false);

  const mentionBotsKey = useMemo(
    () => bots.map((bot) => `${bot.id}:${bot.name}`).join(","),
    [bots],
  );
  const botsForMentionsRef = useRef(bots);
  botsForMentionsRef.current = bots;

  const refreshAgentSkills = useCallback(() => {
    void rpc.agentSkills
      .list()
      .then(setAgentSkills)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void rpc.agentSkills
      .list()
      .then((skills) => {
        if (!cancelled) setAgentSkills(skills);
      })
      .catch(() => {
        if (!cancelled) setAgentSkills([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const currentBots = botsForMentionsRef.current;
    if (!initialBotsLoaded || currentBots.length === 0) {
      setMentionRoutines([]);
      setMentionConnectors([]);
      return;
    }
    let cancelled = false;
    const botNameById = new Map(currentBots.map((bot) => [bot.id, bot.name]));
    void Promise.all(
      currentBots.map((bot) =>
        rpc.routines
          .list({ botId: bot.id })
          .then((rows) =>
            rows.map((routine) => ({
              ...routine,
              botName: botNameById.get(bot.id) ?? bot.name,
            })),
          )
          .catch(() => [] as Array<Routine & { botName?: string }>),
      ),
    ).then((lists) => {
      if (!cancelled) setMentionRoutines(lists.flat());
    });
    void Promise.all([
      rpc.connections.list().catch(() => [] as Connection[]),
      rpc.connections.catalog({}).catch(() => [] as ConnectionCatalogItem[]),
    ]).then(([connections, catalog]) => {
      if (cancelled) return;
      const connected = connections.filter((row) => row.status === "connected");
      const options: Array<{
        id: string;
        name: string;
        authStatus: "connected" | "needs_auth";
        connectionId?: string;
      }> = connected.map((row) => ({
        id: row.id,
        name: row.displayName,
        authStatus: "connected" as const,
        connectionId: row.id,
      }));
      for (const item of catalog) {
        if (item.connected || item.noAuth) continue;
        if (
          connected.some(
            (row) =>
              row.provider.toLowerCase() === item.slug.toLowerCase() ||
              row.displayName.toLowerCase() === item.name.toLowerCase(),
          )
        ) {
          continue;
        }
        options.push({
          id: `catalog:${item.connectorId}:${item.slug}`,
          name: item.name,
          authStatus: "needs_auth",
        });
      }
      setMentionConnectors(options);
    });
    return () => {
      cancelled = true;
    };
  }, [initialBotsLoaded, mentionBotsKey]);

  return {
    taughtSkills,
    setTaughtSkills,
    taughtSkillsBotId,
    setTaughtSkillsBotId,
    agentSkills,
    setAgentSkills,
    mentionRoutines,
    mentionConnectors,
    teachBusy,
    setTeachBusy,
    refreshAgentSkills,
  };
}
