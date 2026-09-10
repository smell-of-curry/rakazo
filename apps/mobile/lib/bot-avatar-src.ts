import { currentApiBase } from "./api";

export function botAvatarSrc(bot?: {
  id?: string;
  botId?: string;
  hasAvatar?: boolean;
  updatedAt?: string;
}): string | undefined {
  if (!bot?.hasAvatar) return undefined;
  const id = bot.id ?? bot.botId;
  if (!id) return undefined;
  const path = `${currentApiBase()}/api/bots/${id}/avatar`;
  return bot.updatedAt ? `${path}?v=${encodeURIComponent(bot.updatedAt)}` : path;
}

export function withMemberAvatarSrc<
  T extends { botId: string; hasAvatar?: boolean; updatedAt?: string },
>(members: readonly T[]): Array<T & { imageSrc?: string }> {
  return members.map((member) => ({
    ...member,
    imageSrc: botAvatarSrc(member),
  }));
}
