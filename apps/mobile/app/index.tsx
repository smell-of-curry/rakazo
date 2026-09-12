import {
  normalizeCreateBotProfile,
  type SearchHit,
  type SpaceBot,
  type SpaceGroup,
} from "@rakazo/contracts";
import { isNeedsYou } from "@rakazo/core";
import { botColors } from "@rakazo/ui-tokens";
import { Redirect, useFocusEffect, useNavigation, useRouter } from "expo-router";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BotAvatar } from "../components/bot-avatar";
import { BotOrganizeModal } from "../components/bot-organize-modal";
import { GroupAvatar } from "../components/group-avatar";
import { NativeSymbol } from "../components/native-symbol";
import {
  currentApiBase,
  loadSessionToken,
  type MobileBot,
  type MobileBotSection,
  type MobileGroup,
  type MobileMe,
  type MobileSpace,
  type MobileSpaceNavigation,
  rpc,
  selectedSpaceId,
  selectInitialSpace,
  selectSpace,
} from "../lib/api";
import { mobileTokens, resolveMobileAppearance, typeScale } from "../lib/appearance";
import { botAvatarSrc, withMemberAvatarSrc } from "../lib/bot-avatar-src";
import { allowFocusPrompt, scheduleFocusPrompt } from "../lib/focus-prompt";
import { t, useI18n } from "../lib/i18n";
import { filterBots, formatThreadTime, userInitials } from "../lib/inbox";
import {
  canDeleteInboxSpace,
  type InboxChatItem,
  type InboxSpace,
  type InboxSpaceItem,
  removeInboxSpace,
  retryInboxSpaceFallback,
  selectInboxSpace,
  spaceInboxItems,
} from "../lib/inbox-spaces";
import { dismissThreadNotifications, resumeLiveNotifications } from "../lib/live-notifications";
import { native, useThemedStyles } from "../lib/native";
import { previewSnippet } from "../lib/preview";
import { registerPushToken } from "../lib/push";
import { querySpaceSearch } from "../lib/search";
import { mobileSearchDestination } from "../lib/search-destination";

const FALLBACK_COLOR = botColors[3];
const PIN_AVATAR = 56;
const ROW_AVATAR = 40;

type InboxItem = InboxSpaceItem | { type: "search"; hit: SearchHit };

async function openMobileSpace(spaceId: string | undefined, open: () => void) {
  if (spaceId && !(await selectSpace(spaceId))) {
    Alert.alert(t("Could not switch spaces"), t("Try again."));
    return;
  }
  open();
}

export default function Home() {
  const tokens = mobileTokens();
  const appearance = resolveMobileAppearance();
  const styles = useThemedStyles(createHomeStyles);
  const { t, locale } = useI18n();
  const navigation = useNavigation();
  const [bots, setBots] = useState<MobileBot[]>([]);
  const [groups, setGroups] = useState<MobileGroup[]>([]);
  const [botSections, setBotSections] = useState<MobileBotSection[]>([]);
  const [spaces, setSpaces] = useState<MobileSpace[]>([]);
  const [me, setMe] = useState<MobileMe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [organizeTarget, setOrganizeTarget] = useState<{
    kind: "bot" | "group";
    id: string;
  } | null>(null);
  const inboxRequestId = useRef(0);
  const creatingBotRef = useRef(false);
  const spaceActionRef = useRef<{ busy: boolean; recoveryId: string | null }>({
    busy: false,
    recoveryId: null,
  });
  const [spaceBusy, setSpaceBusy] = useState(false);
  const [spaceRecoveryId, setSpaceRecoveryId] = useState<string | null>(null);

  const loadBots = useCallback(async () => {
    if (spaceActionRef.current.busy || spaceActionRef.current.recoveryId) return;
    const requestId = ++inboxRequestId.current;
    setError(null);
    try {
      const [navigation, nextMe] = await Promise.all([
        rpc<MobileSpaceNavigation>("spaces/list"),
        rpc<MobileMe>("me"),
      ]);
      if (requestId !== inboxRequestId.current) return;
      if (!(await selectInitialSpace(nextMe.spaceId))) {
        throw new Error(t("Could not save the default space"));
      }
      if (requestId !== inboxRequestId.current) return;
      setBots(navigation.current.bots);
      setBotSections(navigation.current.botSections);
      setGroups(navigation.current.groups);
      setSpaces(navigation.spaces);
      setMe(nextMe);
    } catch (err) {
      if (requestId !== inboxRequestId.current) return;
      setError(err instanceof Error ? err.message : t("Could not load bots"));
    }
  }, []);

  const refreshBots = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadBots();
    } finally {
      setRefreshing(false);
    }
  }, [loadBots]);

  useEffect(() => {
    void loadSessionToken().then((token) => {
      setHasSession(Boolean(token));
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!hasSession) return;
    void registerPushToken().catch(() => undefined);
  }, [hasSession]);

  useFocusEffect(
    useCallback(() => {
      if (!hasSession) return;
      let cancelled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const tick = async () => {
        if (AppState.currentState === "active") await loadBots();
        if (!cancelled) timer = setTimeout(() => void tick(), 5_000);
      };
      void tick();
      return () => {
        cancelled = true;
        if (timer !== undefined) clearTimeout(timer);
      };
    }, [hasSession, loadBots]),
  );

  const searching = Boolean(query.trim());

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchHits([]);
      setSearchLoading(false);
      return;
    }
    const abort = new AbortController();
    const timer = setTimeout(() => {
      setSearchLoading(true);
      void querySpaceSearch(trimmed)
        .then((hits) => {
          if (!abort.signal.aborted) setSearchHits(hits);
        })
        .catch(() => {
          if (!abort.signal.aborted) setSearchHits([]);
        })
        .finally(() => {
          if (!abort.signal.aborted) setSearchLoading(false);
        });
    }, 200);
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [query, searching]);

  const visible = useMemo(() => filterBots(bots, query), [bots, query]);
  const visibleGroups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return groups;
    return groups.filter((group) =>
      `${group.name} ${group.preview}`.toLowerCase().includes(needle),
    );
  }, [groups, query]);
  const listData = useMemo((): InboxItem[] => {
    if (query.trim() && searching) {
      return searchHits.map((hit) => ({ type: "search", hit }));
    }
    const sidebarSpaces =
      spaces.length > 0
        ? spaces.map((space) =>
            space.id === me?.spaceId
              ? { ...space, bots: visible, groups: visibleGroups, botSections }
              : {
                  ...space,
                  bots: filterBots(space.bots, query),
                  groups: space.groups.filter((group) =>
                    `${group.name} ${group.preview}`
                      .toLowerCase()
                      .includes(query.trim().toLowerCase()),
                  ),
                },
          )
        : me
          ? [
              {
                id: me.spaceId,
                name: t("Personal"),
                isDefault: true,
                hasContent: true,
                bots: visible,
                groups: visibleGroups,
                botSections,
              },
            ]
          : [];
    return spaceInboxItems(sidebarSpaces);
  }, [botSections, locale, me, spaces, query, searching, searchHits, visible, visibleGroups]);
  const initials = userInitials(me?.name ?? "");
  const organizeChat = organizeTarget
    ? organizeTarget.kind === "bot"
      ? bots.find((bot) => bot.id === organizeTarget.id)
      : groups.find((group) => group.id === organizeTarget.id)
    : null;
  const router = useRouter();

  function openBotChat(bot: MobileBot | SpaceBot) {
    if (spaceActionRef.current.busy || spaceActionRef.current.recoveryId) return;
    void openMobileSpace(bot.spaceId, () =>
      router.push({ pathname: "/thread", params: { botId: bot.id, name: bot.name } }),
    );
  }

  function openGroupChat(group: MobileGroup | SpaceGroup) {
    if (spaceActionRef.current.busy || spaceActionRef.current.recoveryId) return;
    void openMobileSpace(group.spaceId, () =>
      router.push({
        pathname: "/group-thread",
        params: { groupId: group.id, name: group.name },
      }),
    );
  }

  async function chooseInboxSpace(spaceId: string) {
    if (spaceActionRef.current.busy) return;
    spaceActionRef.current.busy = true;
    setSpaceBusy(true);
    inboxRequestId.current += 1;
    try {
      const refresh = async () => {
        spaceActionRef.current.recoveryId = null;
        setSpaceRecoveryId(null);
        spaceActionRef.current.busy = false;
        await refreshBots();
      };
      const selected =
        spaceActionRef.current.recoveryId === spaceId
          ? await retryInboxSpaceFallback(spaceId, refresh)
          : await selectInboxSpace(spaceId, refresh);
      if (!selected) throw new Error(t("Could not switch spaces"));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("Could not switch spaces");
      setError(message);
      Alert.alert(message, t("Try again."));
    } finally {
      spaceActionRef.current.busy = false;
      setSpaceBusy(false);
    }
  }

  async function deleteInboxSpace(space: InboxSpace) {
    if (
      !canDeleteInboxSpace(space) ||
      spaceActionRef.current.busy ||
      spaceActionRef.current.recoveryId
    )
      return;
    spaceActionRef.current.busy = true;
    setSpaceBusy(true);
    inboxRequestId.current += 1;
    try {
      const recoveryId = await removeInboxSpace(space.id, async () => {
        spaceActionRef.current.busy = false;
        await refreshBots();
      });
      if (recoveryId) {
        spaceActionRef.current.recoveryId = recoveryId;
        setSpaceRecoveryId(recoveryId);
        setError(t("Could not switch spaces"));
      }
    } catch (err) {
      Alert.alert(
        t("Could not delete space"),
        err instanceof Error ? err.message : t("Try again."),
      );
    } finally {
      spaceActionRef.current.busy = false;
      setSpaceBusy(false);
    }
  }

  function showSpaceActions(space: InboxSpace) {
    if (
      !canDeleteInboxSpace(space) ||
      spaceActionRef.current.busy ||
      spaceActionRef.current.recoveryId
    )
      return;
    Alert.alert(space.name, undefined, [
      { text: t("Cancel"), style: "cancel" },
      {
        text: t("Delete space"),
        style: "destructive",
        onPress: () =>
          Alert.alert(
            t("Delete {name}?", { name: space.name }),
            t("This removes the empty space for everyone."),
            [
              { text: t("Cancel"), style: "cancel" },
              {
                text: t("Delete"),
                style: "destructive",
                onPress: () => void deleteInboxSpace(space),
              },
            ],
          ),
      },
    ]);
  }

  const createQuickBot = useCallback(async () => {
    if (creatingBotRef.current || spaceActionRef.current.busy || spaceActionRef.current.recoveryId)
      return;
    creatingBotRef.current = true;
    try {
      // Authoritative roster so a slow home fetch does not treat later bots as first.
      // A failed list is unknown — use the delayed path rather than assuming first.
      const existing = await rpc<MobileBot[]>("bots/list").catch(() => null);
      const isFirstBot = existing !== null && existing.length === 0;
      const bot = await rpc<MobileBot>("bots/create", {
        ...normalizeCreateBotProfile({ name: "New Bot", title: "", description: "" }),
        notifyOnFinish: true,
        computerMode: "team",
      });
      void refreshBots().catch(() => undefined);
      allowFocusPrompt(bot.id);
      router.replace({ pathname: "/thread", params: { botId: bot.id, name: bot.name } });
      void (async () => {
        const started = await rpc("onboarding/start", { botId: bot.id })
          .then(() => true)
          .catch(() => false);
        if (!started) return;
        scheduleFocusPrompt(bot.id, isFirstBot);
      })();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Could not create bot"));
    } finally {
      creatingBotRef.current = false;
    }
  }, [refreshBots, router, t]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t("Bots"),
      headerLargeTitle: true,
      headerSearchBarOptions: {
        placeholder: t("Search"),
        hideWhenScrolling: false,
        onChangeText: (event: { nativeEvent: { text: string } }) =>
          setQuery(event.nativeEvent.text),
        onCancelButtonPress: () => setQuery(""),
      },
      headerLeft: () => (
        <CircleButton accessibilityLabel={t("Account")} onPress={() => router.push("/account")}>
          <Text style={styles.profileInitials}>{initials}</Text>
        </CircleButton>
      ),
      headerRight: () => (
        <CircleButton
          accessibilityLabel={t("Create")}
          onPress={() => {
            if (spaceActionRef.current.busy || spaceActionRef.current.recoveryId) return;
            Alert.alert(t("Create"), undefined, [
              { text: t("New bot"), onPress: () => void createQuickBot() },
              { text: t("New group"), onPress: () => router.push("/new-group") },
              { text: t("New space"), onPress: () => router.push("/new-space") },
              { text: t("Cancel"), style: "cancel" },
            ]);
          }}
        >
          <NativeSymbol ios="plus" android="add" size={18} />
        </CircleButton>
      ),
    });
  }, [createQuickBot, initials, navigation, router, styles.profileInitials, t]);

  if (!ready) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={native.secondaryLabel} />
      </View>
    );
  }
  if (!hasSession) return <Redirect href="/sign-in" />;

  return (
    <View style={styles.screen}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {spaceRecoveryId ? (
        <Pressable
          accessibilityRole="button"
          disabled={spaceBusy}
          onPress={() => void chooseInboxSpace(spaceRecoveryId)}
          style={styles.recoveryAction}
        >
          <Text style={styles.recoveryLabel}>{t("Try again.")}</Text>
        </Pressable>
      ) : null}

      <FlatList<InboxItem>
        data={listData}
        keyExtractor={(item) => {
          if (item.type === "heading") return `heading-${item.key}`;
          if (item.type === "pinned") return `pinned-${item.key}`;
          if (item.type === "bot") return item.bot.id;
          if (item.type === "group") return `group-${item.group.id}`;
          const hit = item.hit;
          return `${hit.kind}-${hit.botId ?? hit.groupId}-${hit.messageId ?? hit.artifactId ?? hit.routineId ?? hit.url}`;
        }}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        indicatorStyle={appearance === "dark" ? "white" : "black"}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void refreshBots();
            }}
            tintColor={native.secondaryLabel}
            colors={[tokens.mutedForeground]}
            progressBackgroundColor={tokens.muted}
          />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            {query.trim()
              ? searchLoading
                ? t("Searching…")
                : t("No results")
              : t("Tap + to create a bot")}
          </Text>
        }
        renderItem={({ item }) =>
          item.type === "search" ? (
            <SearchRow
              hit={item.hit}
              onPress={() => {
                setQuery("");
                setSearchHits([]);
                router.push(mobileSearchDestination(item.hit));
              }}
            />
          ) : item.type === "heading" ? (
            item.space ? (
              <View style={styles.spaceHeading}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={item.title}
                  accessibilityState={{
                    selected: item.space.id === me?.spaceId,
                    disabled: spaceBusy,
                  }}
                  disabled={spaceBusy}
                  onPress={() => {
                    if (item.space) void chooseInboxSpace(item.space.id);
                  }}
                  style={({ pressed }) => [styles.spaceSelect, pressed && styles.rowPressed]}
                >
                  <Text style={styles.spaceTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                </Pressable>
                {canDeleteInboxSpace(item.space) ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("Space actions for {name}", { name: item.title })}
                    disabled={spaceBusy || !!spaceRecoveryId}
                    onPress={() => {
                      if (item.space) showSpaceActions(item.space);
                    }}
                    style={({ pressed }) => [styles.spaceActions, pressed && styles.rowPressed]}
                  >
                    <NativeSymbol ios="ellipsis" android="ellipsis-horizontal" size={20} />
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <Text style={styles.sectionHeading}>{item.title}</Text>
            )
          ) : item.type === "pinned" ? (
            <PinnedInboxGrid
              items={item.items}
              currentSpaceId={me?.spaceId}
              onOpenBot={openBotChat}
              onOpenGroup={openGroupChat}
              onOrganize={(kind, id) => setOrganizeTarget({ kind, id })}
            />
          ) : item.type === "group" ? (
            <GroupRow
              group={item.group}
              onPress={() => openGroupChat(item.group)}
              onLongPress={
                item.group.spaceId === me?.spaceId
                  ? () => setOrganizeTarget({ kind: "group", id: item.group.id })
                  : undefined
              }
            />
          ) : (
            <BotRow
              bot={item.bot}
              onPress={() => openBotChat(item.bot)}
              onLongPress={
                item.bot.spaceId === me?.spaceId
                  ? () => setOrganizeTarget({ kind: "bot", id: item.bot.id })
                  : undefined
              }
            />
          )
        }
      />
      {organizeChat && organizeTarget ? (
        <BotOrganizeModal
          bot={organizeChat}
          sections={botSections}
          onClose={() => setOrganizeTarget(null)}
          onUpdate={async (update) => {
            await rpc(`${organizeTarget.kind}s/update`, {
              [`${organizeTarget.kind}Id`]: organizeChat.id,
              ...update,
            });
            if (organizeTarget.kind === "bot" && update.notifyOnFinish !== undefined) {
              await resumeLiveNotifications(
                currentApiBase(),
                await loadSessionToken(),
                selectedSpaceId() ?? "",
              ).catch(() => undefined);
              if (!update.notifyOnFinish && "threadId" in organizeChat) {
                await dismissThreadNotifications({ threadId: organizeChat.threadId }).catch(
                  () => undefined,
                );
              }
            }
            await loadBots();
          }}
          onCreateSection={async (name) => {
            await rpc("botSections/create", {
              [`${organizeTarget.kind}Id`]: organizeChat.id,
              name,
            });
            await loadBots();
          }}
        />
      ) : null}
    </View>
  );
}

function TitleCapsule({ title, compact }: { title?: string | null; compact?: boolean }) {
  const styles = useThemedStyles(createHomeStyles);
  const value = title?.trim() ?? "";
  if (!value) return null;
  return (
    <View style={[styles.capsule, compact && styles.pinnedCapsule]}>
      <Text style={styles.capsuleLabel} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function NeedsYouBadge({ compact }: { compact?: boolean }) {
  const styles = useThemedStyles(createHomeStyles);
  const { t } = useI18n();
  return (
    <View style={[styles.alertTag, compact && styles.pinnedCapsule]}>
      <Text style={styles.alertTagLabel} numberOfLines={1}>
        {t("Needs you")}
      </Text>
    </View>
  );
}

function ConversationRow({
  title,
  preview,
  time,
  avatar,
  alert,
  unread,
  onPress,
  onLongPress,
  accessibilityLabel,
  accessibilityHint,
}: {
  title: string;
  preview: string;
  time: string;
  avatar: ReactNode;
  alert?: string | null;
  unread?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
}) {
  const styles = useThemedStyles(createHomeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      {avatar}
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text
            style={[styles.name, unread && styles.nameUnread]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {title}
          </Text>
          <View style={styles.rowMeta}>
            {unread ? <View accessibilityElementsHidden style={styles.unreadDot} /> : null}
            {alert ? <NeedsYouBadge /> : time ? <Text style={styles.time}>{time}</Text> : null}
          </View>
        </View>
        {preview ? (
          <Text style={[styles.preview, unread && styles.unreadPreview]} numberOfLines={1}>
            {preview}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function CircleButton({
  children,
  onPress,
  accessibilityLabel,
  active = false,
  accent = false,
}: {
  children: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  active?: boolean;
  accent?: boolean;
}) {
  const styles = useThemedStyles(createHomeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.circleButton,
        accent && active ? styles.circleAccent : (active || pressed) && styles.circlePressed,
      ]}
    >
      {children}
    </Pressable>
  );
}

function SearchRow({ hit, onPress }: { hit: SearchHit; onPress: () => void }) {
  const styles = useThemedStyles(createHomeStyles);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.name} numberOfLines={1}>
            {hit.title}
          </Text>
          <Text style={styles.time}>{hit.kind}</Text>
        </View>
        <Text style={styles.preview} numberOfLines={2}>
          {hit.groupName ?? hit.botName} · {hit.snippet}
        </Text>
      </View>
    </Pressable>
  );
}

function BotRow({
  bot,
  onPress,
  onLongPress,
}: {
  bot: MobileBot | SpaceBot;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const { t } = useI18n();
  const preview = previewSnippet(bot.preview, 40) || t("No messages yet");
  const time = bot.updatedAt ? formatThreadTime(bot.updatedAt) : "";
  const needsYou = isNeedsYou(bot.status);
  const label = [
    bot.name,
    bot.title.trim() || null,
    needsYou ? t("Needs you") : null,
    bot.notifyOnFinish ? null : t("notifications silenced"),
    bot.unread ? t("unread") : null,
    time,
    preview,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <ConversationRow
      title={bot.name}
      preview={preview}
      time={time}
      alert={needsYou ? t("Needs you") : null}
      unread={bot.unread}
      accessibilityLabel={label}
      accessibilityHint={
        onLongPress ? t("Long press to pin, move, or silence notifications") : undefined
      }
      onPress={onPress}
      onLongPress={onLongPress}
      avatar={
        <BotAvatar
          color={bot.color || FALLBACK_COLOR}
          shape={bot.avatarShape}
          identity={bot.id}
          size={ROW_AVATAR}
          muted={!bot.notifyOnFinish}
          imageSrc={botAvatarSrc(bot)}
        />
      }
    />
  );
}

function GroupRow({
  group,
  onPress,
  onLongPress,
}: {
  group: MobileGroup | SpaceGroup;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const { t } = useI18n();
  const preview =
    previewSnippet(group.preview, 40) || group.members.map((member) => member.name).join(", ");
  const time = group.updatedAt ? formatThreadTime(group.updatedAt) : "";
  const needsYou = group.members.some((member) => isNeedsYou(member.status));
  return (
    <ConversationRow
      title={group.name}
      preview={preview}
      time={time}
      alert={needsYou ? t("Needs you") : null}
      unread={group.unread}
      accessibilityLabel={[
        group.name,
        needsYou ? t("Needs you") : null,
        group.unread ? t("unread") : null,
        time,
        preview,
      ]
        .filter(Boolean)
        .join(", ")}
      accessibilityHint={onLongPress ? t("Long press to pin or move to a section") : undefined}
      onPress={onPress}
      onLongPress={onLongPress}
      avatar={<GroupAvatar members={withMemberAvatarSrc(group.members)} size={ROW_AVATAR} />}
    />
  );
}

function PinnedInboxGrid({
  items,
  currentSpaceId,
  onOpenBot,
  onOpenGroup,
  onOrganize,
}: {
  items: InboxChatItem[];
  currentSpaceId?: string;
  onOpenBot: (bot: MobileBot | SpaceBot) => void;
  onOpenGroup: (group: MobileGroup | SpaceGroup) => void;
  onOrganize: (kind: "bot" | "group", id: string) => void;
}) {
  const styles = useThemedStyles(createHomeStyles);
  const { t } = useI18n();
  return (
    <View style={styles.pinnedGrid}>
      {items.map((item) => {
        if (item.type === "group") {
          const { group } = item;
          const needsYou = group.members.some((member) => isNeedsYou(member.status));
          return (
            <Pressable
              key={`group:${group.id}`}
              accessibilityRole="button"
              accessibilityLabel={[group.name, needsYou ? t("Needs you") : null]
                .filter(Boolean)
                .join(", ")}
              accessibilityHint={
                group.spaceId === currentSpaceId
                  ? t("Long press to pin or move to a section")
                  : undefined
              }
              onPress={() => onOpenGroup(group)}
              onLongPress={
                group.spaceId === currentSpaceId ? () => onOrganize("group", group.id) : undefined
              }
              style={({ pressed }) => [styles.pinnedCell, pressed && styles.rowPressed]}
            >
              <GroupAvatar members={withMemberAvatarSrc(group.members)} size={PIN_AVATAR} />
              <Text style={styles.pinnedName} numberOfLines={1}>
                {group.name}
              </Text>
              {needsYou ? <NeedsYouBadge compact /> : null}
            </Pressable>
          );
        }
        const { bot } = item;
        const needsYou = isNeedsYou(bot.status);
        return (
          <Pressable
            key={`bot:${bot.id}`}
            accessibilityRole="button"
            accessibilityLabel={[
              bot.name,
              needsYou ? t("Needs you") : bot.title.trim(),
              bot.notifyOnFinish ? null : t("notifications silenced"),
            ]
              .filter(Boolean)
              .join(", ")}
            accessibilityHint={
              bot.spaceId === currentSpaceId
                ? t("Long press to pin, move, or silence notifications")
                : undefined
            }
            onPress={() => onOpenBot(bot)}
            onLongPress={
              bot.spaceId === currentSpaceId ? () => onOrganize("bot", bot.id) : undefined
            }
            style={({ pressed }) => [styles.pinnedCell, pressed && styles.rowPressed]}
          >
            <BotAvatar
              color={bot.color || FALLBACK_COLOR}
              shape={bot.avatarShape}
              identity={bot.id}
              size={PIN_AVATAR}
              muted={!bot.notifyOnFinish}
              imageSrc={botAvatarSrc(bot)}
            />
            <Text style={styles.pinnedName} numberOfLines={1}>
              {bot.name}
            </Text>
            {needsYou ? <NeedsYouBadge compact /> : <TitleCapsule title={bot.title} compact />}
          </Pressable>
        );
      })}
    </View>
  );
}

function createHomeStyles() {
  const tokens = mobileTokens();
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: native.page,
    },
    centered: {
      alignItems: "center",
      justifyContent: "center",
    },
    circleButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: native.fillPressed,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    circlePressed: {
      backgroundColor: native.fill,
    },
    circleAccent: {
      backgroundColor: tokens.primary,
    },
    profileInitials: {
      color: native.label,
      ...typeScale.title,
    },
    error: {
      color: native.secondaryLabel,
      ...typeScale.small,
      paddingHorizontal: 20,
      paddingBottom: 8,
    },
    list: {
      flexGrow: 1,
      paddingBottom: 32,
    },
    empty: {
      color: native.secondaryLabel,
      ...typeScale.body,
      paddingHorizontal: 20,
      paddingTop: 28,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 56,
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 12,
    },
    rowPressed: {
      opacity: 0.55,
    },
    rowBody: {
      flex: 1,
      minWidth: 0,
    },
    rowTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    rowMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    name: {
      flex: 1,
      minWidth: 0,
      color: native.label,
      ...typeScale.bodySemibold,
      writingDirection: "auto",
    },
    nameUnread: {
      fontWeight: "600",
    },
    capsule: {
      flexShrink: 0,
      maxWidth: "100%",
      borderRadius: 999,
      backgroundColor: native.fill,
      paddingHorizontal: 6,
      paddingVertical: 1,
    },
    pinnedCapsule: {
      maxWidth: "100%",
    },
    capsuleLabel: {
      color: native.secondaryLabel,
      ...typeScale.micro,
      writingDirection: "auto",
    },
    alertTag: {
      flexShrink: 1,
      borderRadius: 999,
      backgroundColor: `${tokens.warning}26`,
      paddingHorizontal: 6,
      paddingVertical: 1,
    },
    alertTagLabel: {
      color: tokens.warning,
      ...typeScale.micro,
      writingDirection: "auto",
    },
    time: {
      color: native.secondaryLabel,
      ...typeScale.caption,
    },
    preview: {
      flexShrink: 1,
      minWidth: 0,
      marginTop: 2,
      color: native.secondaryLabel,
      ...typeScale.small,
      writingDirection: "auto",
    },
    unreadPreview: {
      color: native.label,
      fontWeight: "500",
    },
    unreadDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: tokens.foreground,
    },
    pinnedGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    pinnedCell: {
      width: "33.333%",
      alignItems: "center",
      paddingHorizontal: 4,
      paddingVertical: 8,
      gap: 4,
    },
    pinnedName: {
      width: "100%",
      textAlign: "center",
      color: native.label,
      ...typeScale.captionMedium,
      writingDirection: "auto",
    },
    spaceHeading: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingTop: 8,
    },
    spaceSelect: {
      flex: 1,
      minHeight: 36,
      justifyContent: "center",
      paddingHorizontal: 4,
      paddingVertical: 6,
    },
    spaceTitle: {
      color: native.secondaryLabel,
      ...typeScale.captionMedium,
      letterSpacing: 0.66,
      textTransform: "uppercase",
      writingDirection: "auto",
    },
    spaceActions: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    recoveryAction: {
      minHeight: 44,
      paddingHorizontal: 20,
      justifyContent: "center",
    },
    recoveryLabel: {
      color: native.label,
      ...typeScale.title,
    },
    sectionHeading: {
      color: native.secondaryLabel,
      ...typeScale.captionMedium,
      letterSpacing: 0.66,
      textTransform: "uppercase",
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 4,
    },
  });
}
