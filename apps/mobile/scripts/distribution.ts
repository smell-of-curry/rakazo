import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Document = { [key: string]: any };

export type MobileDistribution = {
  name: string;
  slug: string;
  owner: string;
  scheme: string;
  projectId: string;
  bundleIdentifier: string;
  version: string;
  appStoreConnectAppId: string;
  apiUrl: string;
};

export function parseDistribution(value: string | undefined): MobileDistribution {
  if (!value) throw new Error("Set MOBILE_DISTRIBUTION_CONFIG before releasing.");
  let input: unknown;
  try {
    input = JSON.parse(value);
  } catch {
    throw new Error("MOBILE_DISTRIBUTION_CONFIG must be valid JSON.");
  }
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Mobile distribution must be an object.");
  const source = input as Record<string, unknown>;
  const fields = [
    "name",
    "slug",
    "owner",
    "scheme",
    "projectId",
    "bundleIdentifier",
    "version",
    "appStoreConnectAppId",
    "apiUrl",
  ] as const;
  for (const field of fields) {
    const item = source[field];
    if (typeof item !== "string" || !item.trim() || item !== item.trim() || /[\r\n\0]/.test(item))
      throw new Error(`Mobile distribution requires a valid ${field}.`);
  }
  const config = Object.fromEntries(
    fields.map((field) => [field, source[field]]),
  ) as MobileDistribution;
  if (
    config.name.length > 60 ||
    !/^[a-z0-9][a-z0-9_-]*$/i.test(config.slug) ||
    !/^[a-z0-9][a-z0-9_-]*$/i.test(config.owner) ||
    !/^[a-z][a-z0-9+.-]*$/.test(config.scheme) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(config.projectId) ||
    !/^[a-z][a-z0-9]*(?:\.[a-z0-9][a-z0-9-]*)+$/i.test(config.bundleIdentifier) ||
    !/^\d+\.\d+\.\d+$/.test(config.version) ||
    !/^\d+$/.test(config.appStoreConnectAppId)
  )
    throw new Error("Mobile distribution contains an invalid application identity.");
  let url: URL;
  try {
    url = new URL(config.apiUrl);
  } catch {
    throw new Error("Mobile distribution requires an HTTPS server URL.");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash)
    throw new Error(
      "Mobile distribution requires an HTTPS server URL without credentials, query or fragment.",
    );
  return config;
}

/** Replaces native extension and app-group identities together with the application identity. */
function remapIdentifiers(value: Json, previous: string, next: string): Json {
  if (typeof value === "string") {
    for (const prefix of ["", "group."]) {
      const oldId = prefix + previous;
      if (value === oldId || value.startsWith(`${oldId}.`))
        return prefix + next + value.slice(oldId.length);
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => remapIdentifiers(item, previous, next));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, remapIdentifiers(item, previous, next)]),
    );
  return value;
}

export function configureDistribution(app: Document, eas: Document, config: MobileDistribution) {
  const previous = app.expo?.ios?.bundleIdentifier;
  if (typeof previous !== "string" || !previous || !eas.build?.production)
    throw new Error("Mobile source configuration is incomplete.");
  const result = remapIdentifiers(
    structuredClone(app),
    previous,
    config.bundleIdentifier,
  ) as Document;
  const expo = result.expo;
  Object.assign(expo, {
    name: config.name,
    slug: config.slug,
    owner: config.owner,
    scheme: config.scheme,
    version: config.version,
    runtimeVersion: { policy: "fingerprint" },
  });
  expo.extra ??= {};
  expo.extra.eas ??= {};
  expo.extra.eas.projectId = config.projectId;
  expo.updates = { ...expo.updates, url: `https://u.expo.dev/${config.projectId}` };
  const build = structuredClone(eas);
  build.build["fork-testflight"] = {
    ...build.build.production,
    distribution: "store",
    autoIncrement: true,
    environment: "production",
    channel: "fork-testflight",
    env: { ...build.build.production.env, EXPO_PUBLIC_API_URL: config.apiUrl },
  };
  build.submit ??= {};
  build.submit["fork-testflight"] = { ios: { ascAppId: config.appStoreConnectAppId } };
  return { app: result, eas: build };
}

async function main() {
  const config = parseDistribution(process.env.MOBILE_DISTRIBUTION_CONFIG);
  const root = path.resolve(import.meta.dirname, "..");
  const appFile = path.join(root, "app.json");
  const easFile = path.join(root, "eas.json");
  const [app, eas] = await Promise.all([readFile(appFile, "utf8"), readFile(easFile, "utf8")]);
  const configured = configureDistribution(JSON.parse(app), JSON.parse(eas), config);
  // Mask individual fields too: a secret containing JSON does not mask its fields in CLI output.
  if (process.env.GITHUB_ACTIONS === "true")
    for (const value of Object.values(config))
      console.log(`::add-mask::${value.replaceAll("%", "%25")}`);
  await Promise.all([
    writeFile(appFile, `${JSON.stringify(configured.app, null, 2)}\n`),
    writeFile(easFile, `${JSON.stringify(configured.eas, null, 2)}\n`),
  ]);
}

if (import.meta.main) {
  await main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Mobile configuration failed.");
    process.exitCode = 1;
  });
}
