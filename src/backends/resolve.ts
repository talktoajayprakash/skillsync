import { ensureAuth, getAuthClient, hasToken } from "../auth.js";
import { credentialsExist } from "../config.js";
import { GDriveBackend } from "./gdrive.js";
import { GithubBackend } from "./github.js";
import { LocalBackend } from "./local.js";
import { RoutingBackend } from "./routing.js";
import type { StorageBackend } from "./interface.js";

export async function resolveBackend(backendName: string): Promise<StorageBackend> {
  let inner: StorageBackend;
  if (backendName === "gdrive") inner = new GDriveBackend(await ensureAuth());
  else if (backendName === "github") inner = new GithubBackend();
  else inner = new LocalBackend();
  return new RoutingBackend(inner);
}

/** Like resolveBackend but never triggers auth flows — returns null for unconfigured backends. */
export async function tryResolveBackend(backendName: string): Promise<StorageBackend | null> {
  if (backendName === "gdrive") {
    if (!credentialsExist() || !hasToken()) return null;
    try { return new RoutingBackend(new GDriveBackend(getAuthClient())); } catch { return null; }
  }
  if (backendName === "github") return new RoutingBackend(new GithubBackend());
  return new RoutingBackend(new LocalBackend());
}
