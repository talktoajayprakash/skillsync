import { ensureAuth } from "../auth.js";
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
