import fs from "fs";
import os from "os";
import path from "path";
import type { Config } from "./types.js";

export const CONFIG_DIR = path.join(os.homedir(), ".skillssync");
export const CREDENTIALS_PATH = path.join(CONFIG_DIR, "credentials.json");
export const TOKEN_PATH = path.join(CONFIG_DIR, "token.json");
export const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");
export const CACHE_DIR = path.join(CONFIG_DIR, "cache");

export function ensureConfigDir(): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

export function ensureCacheDir(): void {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

export function readConfig(): Config {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`No config found. Run "skillsync init" first.`);
  }
  const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")) as Record<string, unknown>;
  // Backwards compat: old configs used "registries" key
  if (raw.registries && !raw.collections) {
    raw.collections = raw.registries;
  }
  return raw as unknown as Config;
}

export function writeConfig(config: Config): void {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export function credentialsExist(): boolean {
  return fs.existsSync(CREDENTIALS_PATH);
}

export function readCredentials(): {
  client_id: string;
  client_secret: string;
  redirect_uris: string[];
} {
  if (!credentialsExist()) {
    throw new Error(
      `No credentials file found at ${CREDENTIALS_PATH}.\n\n` +
        `To set up Google Drive:\n` +
        `  1. Go to https://console.cloud.google.com/\n` +
        `  2. Create a project and enable the Google Drive API\n` +
        `  3. Create OAuth 2.0 credentials (Desktop app type)\n` +
        `  4. Download the JSON and save as ${CREDENTIALS_PATH}\n` +
        `  5. Run "skillsync init" again`
    );
  }
  const raw = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf-8"));
  const creds = raw.installed ?? raw.web ?? raw;
  return {
    client_id: creds.client_id,
    client_secret: creds.client_secret,
    redirect_uris: creds.redirect_uris ?? ["urn:ietf:wg:oauth:2.0:oob"],
  };
}
