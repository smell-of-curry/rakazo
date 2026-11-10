import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { configureDistribution, parseDistribution } from "../scripts/distribution.js";

const identity = {
  name: "Example Fork",
  slug: "example-fork",
  owner: "example-owner",
  scheme: "example-fork",
  projectId: "11111111-2222-3333-4444-555555555555",
  bundleIdentifier: "com.example.fork",
  version: "1.2.3",
  appStoreConnectAppId: "1234567890",
  apiUrl: "https://app.example.test",
};
const read = (file: string) =>
  JSON.parse(readFileSync(path.resolve(import.meta.dirname, "..", file), "utf8"));

describe("fork mobile distribution", () => {
  it.each([true, false])(
    "the release command validates before writing configuration: valid=%s",
    (valid) => {
      const root = mkdtempSync(path.join(tmpdir(), "mobile-distribution-"));
      try {
        mkdirSync(path.join(root, "scripts"));
        const script = path.join(root, "scripts/distribution.ts");
        copyFileSync(path.resolve(import.meta.dirname, "../scripts/distribution.ts"), script);
        const originalApp = JSON.stringify(read("app.json"));
        const originalEas = JSON.stringify(read("eas.json"));
        writeFileSync(path.join(root, "app.json"), originalApp);
        writeFileSync(path.join(root, "eas.json"), originalEas);
        const result = spawnSync(process.execPath, [script], {
          encoding: "utf8",
          env: {
            ...process.env,
            MOBILE_DISTRIBUTION_CONFIG: valid ? JSON.stringify(identity) : "{}",
            GITHUB_ACTIONS: "true",
          },
        });
        expect(result.status, result.stderr).toBe(valid ? 0 : 1);
        if (valid) {
          const app = JSON.parse(readFileSync(path.join(root, "app.json"), "utf8"));
          expect(app.expo.ios.bundleIdentifier).toBe(identity.bundleIdentifier);
          expect(result.stdout).toContain(`::add-mask::${identity.projectId}`);
        } else {
          expect(readFileSync(path.join(root, "app.json"), "utf8")).toBe(originalApp);
          expect(readFileSync(path.join(root, "eas.json"), "utf8")).toBe(originalEas);
        }
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
  );

  it("moves the real app and every native extension to the fork without changing the source", () => {
    const app = read("app.json");
    const eas = read("eas.json");
    const before = JSON.stringify({ app, eas });
    const next = configureDistribution(app, eas, parseDistribution(JSON.stringify(identity)));
    expect(JSON.stringify({ app, eas })).toBe(before);
    expect(JSON.stringify(next.app)).not.toContain(app.expo.ios.bundleIdentifier);
    expect(next.app.expo.ios.bundleIdentifier).toBe(identity.bundleIdentifier);
    expect(next.app.expo.android.package).toBe(identity.bundleIdentifier);
    for (const extension of next.app.expo.extra.eas.build.experimental.ios.appExtensions)
      expect(extension.bundleIdentifier).toMatch(/^com\.example\.fork\./);
    expect(next.app.expo.extra.eas.projectId).toBe(identity.projectId);
    expect(next.app.expo.updates.url).toBe(`https://u.expo.dev/${identity.projectId}`);
    expect(next.app.expo.runtimeVersion).toEqual({ policy: "fingerprint" });
    expect(next.eas.build["fork-testflight"].env.EXPO_PUBLIC_API_URL).toBe(identity.apiUrl);
    expect(next.eas.submit["fork-testflight"]).toEqual({
      ios: { ascAppId: identity.appStoreConnectAppId },
    });
    expect(next.eas.build.production).toEqual(eas.build.production);
  });

  it.each([undefined, "", "null", "[]", "{}", "invalid"])(
    "fails closed for missing or malformed identity: %s",
    (input) => {
      expect(() => parseDistribution(input)).toThrow();
    },
  );

  it.each([
    "http://app.example.test",
    "https://user:secret@example.test",
    "https://example.test?token=secret",
    "https://example.test#secret",
    "invalid",
  ])("refuses unsafe server configuration", (apiUrl) => {
    expect(() => parseDistribution(JSON.stringify({ ...identity, apiUrl }))).toThrow();
  });

  it("rejects log-control characters without disclosing configuration values", () => {
    const name = "private-name\n::warning::leak";
    expect(() => parseDistribution(JSON.stringify({ ...identity, name }))).toThrow(
      /^Mobile distribution requires a valid name\.$/,
    );
  });
});
