import type { ArtifactStore } from "@rakazo/adapter-kit";
import type { Actor } from "@rakazo/contracts";
import {
  AttachmentValidationError,
  decodeBotAvatarBase64,
  sniffBotAvatarMimeType,
  validateBotAvatarMimeType,
} from "@rakazo/core";
import { IsolationError, type PrismaClient } from "@rakazo/db";
import type { Context, Hono } from "hono";
import { createOwnedArtifact } from "./artifacts.js";
import { commitBotUpdate } from "./bot-update.js";

function adapterContext(actor: Actor, botId: string, operationId: string) {
  return {
    operationId,
    traceId: operationId,
    spaceId: actor.spaceId,
    userId: actor.userId,
    botId,
    signal: new AbortController().signal,
  };
}

export async function removeBotAvatarArtifact(
  deps: { prisma: PrismaClient; artifacts: ArtifactStore },
  actor: Actor,
  botId: string,
  artifactId: string,
) {
  const row = await deps.prisma.artifact.findFirst({
    where: {
      id: artifactId,
      botId,
      spaceId: actor.spaceId,
      userId: actor.userId,
    },
    select: { id: true, storageKey: true },
  });
  if (!row) return;
  await deps.prisma.artifact.delete({ where: { id: row.id } });
  await deps.artifacts
    .remove(row.storageKey, adapterContext(actor, botId, `avatar-remove:${row.id}`))
    .catch(() => undefined);
}

export async function setBotAvatar(
  deps: {
    prisma: PrismaClient;
    artifacts: ArtifactStore;
    notify: (threadId: string, seq: number) => Promise<void>;
  },
  actor: Actor,
  input: { botId: string; name: string; mimeType: string; contentBase64: string },
) {
  validateBotAvatarMimeType(input.mimeType);
  const bytes = decodeBotAvatarBase64(input.contentBase64);
  const mimeType = sniffBotAvatarMimeType(bytes);
  if (!mimeType) {
    throw new AttachmentValidationError("Avatar must be a JPEG, PNG, or WebP image");
  }

  const bot = await deps.prisma.bot.findFirst({
    where: { id: input.botId, spaceId: actor.spaceId, userId: actor.userId, archivedAt: null },
    select: { id: true, thread: { select: { id: true } }, avatarArtifactId: true },
  });
  if (!bot?.thread) throw new IsolationError();

  const created = await createOwnedArtifact(deps, actor, {
    botId: bot.id,
    name: input.name,
    mimeType,
    contentBase64: input.contentBase64,
  });
  try {
    await commitBotUpdate({
      prisma: deps.prisma,
      notify: deps.notify,
      spaceId: actor.spaceId,
      threadId: bot.thread.id,
      botId: bot.id,
      emitBotUpdated: false,
      data: { avatarArtifactId: created.id },
    });
  } catch (error) {
    await removeBotAvatarArtifact(deps, actor, bot.id, created.id);
    throw error;
  }
  if (bot.avatarArtifactId) {
    await removeBotAvatarArtifact(deps, actor, bot.id, bot.avatarArtifactId);
  }
}

export function mountBotAvatarHttpRoutes(
  app: Hono,
  deps: { prisma: PrismaClient; artifacts: ArtifactStore },
  authenticate: (c: Context) => Promise<Actor | null>,
) {
  app.get("/api/bots/:botId/avatar", async (c) => {
    const sessionActor = await authenticate(c);
    if (!sessionActor) return c.json({ error: "Unauthorized" }, 401);

    const botId = c.req.param("botId");
    const requestedSpaceId = c.req.header("x-rakazo-space-id") ?? c.req.query("space");
    const bot = await deps.prisma.bot.findFirst({
      where: { id: botId, userId: sessionActor.userId },
      select: { id: true, spaceId: true, avatarArtifactId: true },
    });
    if (!bot?.avatarArtifactId) return c.body(null, 404);
    if (requestedSpaceId && bot.spaceId !== requestedSpaceId) return c.body(null, 404);
    if (bot.spaceId !== sessionActor.spaceId) {
      const member = await deps.prisma.spaceMember.findFirst({
        where: { userId: sessionActor.userId, spaceId: bot.spaceId },
        select: { id: true },
      });
      if (!member) return c.body(null, 404);
    }

    const actor: Actor = { ...sessionActor, spaceId: bot.spaceId };
    const row = await deps.prisma.artifact.findFirst({
      where: {
        id: bot.avatarArtifactId,
        botId: bot.id,
        spaceId: actor.spaceId,
        userId: actor.userId,
      },
    });
    if (!row) return c.body(null, 404);

    const bytes = await deps.artifacts.get(
      row.storageKey,
      adapterContext(actor, bot.id, `avatar-get:${row.id}`),
    );
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": row.mimeType,
        "cache-control": "private, max-age=3600",
      },
    });
  });
}
