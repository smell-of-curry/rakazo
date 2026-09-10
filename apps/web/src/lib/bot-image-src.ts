export function botImageSrc(bot: {
  id?: string;
  botId?: string;
  hasAvatar?: boolean;
  updatedAt?: string;
}): string | undefined {
  if (!bot.hasAvatar) return undefined;
  const id = bot.id ?? bot.botId;
  if (!id) return undefined;
  return bot.updatedAt ? `/api/bots/${id}/avatar?v=${bot.updatedAt}` : `/api/bots/${id}/avatar`;
}

export function withMemberImages<T extends { botId: string; hasAvatar?: boolean }>(members: T[]) {
  return members.map((member) => ({
    ...member,
    imageSrc: member.hasAvatar ? `/api/bots/${member.botId}/avatar` : undefined,
  }));
}
