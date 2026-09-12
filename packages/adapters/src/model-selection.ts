import type { AgentRunRequest } from "@rakazo/adapter-kit";
import type { Actor } from "@rakazo/contracts";
import {
  type findDefaultModelCredential,
  findModelCredential,
  type PrismaClient,
} from "@rakazo/db";
import { listPiCatalog, scriptedCatalogEntry } from "./pi-models.js";
import { OPENAI_COMPATIBLE_PROVIDER_ID } from "./pi-openai-compatible-provider.js";

type ModelCredential = Awaited<ReturnType<typeof findDefaultModelCredential>>;

export function isCatalogModelChoice(provider: string, modelId: string) {
  return [...listPiCatalog(), scriptedCatalogEntry].some(
    (item) => item.provider === provider && item.id === modelId,
  );
}

export async function validateConnectedModelChoice(
  prisma: PrismaClient,
  actor: Pick<Actor, "userId" | "spaceId">,
  provider: string,
  modelId: string,
  deployment?: { provider: string; key?: string },
) {
  const credential = await findModelCredential(prisma, actor, provider);
  if (!credential) {
    if (
      deployment?.key &&
      deployment.provider === provider &&
      isCatalogModelChoice(provider, modelId)
    ) {
      return undefined;
    }
    return "Connect that model provider first";
  }
  if (isCatalogModelChoice(provider, modelId)) return undefined;
  // Free-form saved IDs only resolve at runtime for openai-compatible connections.
  if (provider !== OPENAI_COMPATIBLE_PROVIDER_ID) {
    return "Unknown model for that provider";
  }
  const savedChoice = await prisma.spaceModelPreference.findFirst({
    where: {
      spaceId: actor.spaceId,
      userId: actor.userId,
      modelId,
      credential: { userId: actor.userId, provider },
    },
    select: { id: true },
  });
  return savedChoice ? undefined : "Unknown model for that provider";
}

type ModelChoice = {
  modelProvider: string | null;
  modelId: string | null;
  thinkingLevel: string | null;
};

/** Select configuration without loading secrets or applying a runtime-specific fallback. */
export function selectConfiguredModel(input: {
  bot: ModelChoice | null;
  routine?: ModelChoice | null;
  overrideCredential: ModelCredential;
  defaultCredential: ModelCredential;
  settings: { defaultModelProvider: string | null; defaultModelId: string | null } | null;
  deployment: { provider: string; model: string } | null;
}) {
  const { overrideCredential, defaultCredential, settings, deployment } = input;
  const hasRoutineOverride = Boolean(input.routine?.modelProvider && input.routine.modelId);
  const bot = hasRoutineOverride ? input.routine! : input.bot;
  const hasOverride = Boolean(bot?.modelProvider && bot.modelId);
  // The override provider, model and credential must win together.
  const useOverride = Boolean(hasOverride && overrideCredential);
  const credential = useOverride ? overrideCredential : defaultCredential;
  return {
    provider:
      (useOverride ? bot!.modelProvider : null) ??
      credential?.provider ??
      settings?.defaultModelProvider ??
      deployment?.provider,
    id:
      (useOverride ? bot!.modelId : null) ??
      credential?.defaultModel ??
      settings?.defaultModelId ??
      deployment?.model,
    credential,
    // Preserve bot thinking for the Space default; drop it for an unavailable override.
    thinkingLevel:
      hasOverride && !useOverride
        ? null
        : ((bot?.thinkingLevel as AgentRunRequest["model"]["thinkingLevel"]) ?? null),
  };
}
