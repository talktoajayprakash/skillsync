import fs from "fs";
import path from "path";
import { CACHE_DIR, ensureCacheDir } from "./config.js";
import { AGENT_PATHS } from "./types.js";
import type { RegistryInfo } from "./types.js";

export function getCachePath(registry: RegistryInfo, skillName?: string): string {
  const base = path.join(CACHE_DIR, "gdrive", registry.folderId);
  return skillName ? path.join(base, skillName) : base;
}

export function ensureCachePath(registry: RegistryInfo): string {
  const p = getCachePath(registry);
  fs.mkdirSync(p, { recursive: true });
  return p;
}

export function createSymlink(
  skillName: string,
  cachePath: string,
  agentName: string
): void {
  const agentDir = AGENT_PATHS[agentName];
  if (!agentDir) {
    const supported = Object.keys(AGENT_PATHS).join(", ");
    throw new Error(
      `Unknown agent "${agentName}". Supported agents: ${supported}`
    );
  }

  fs.mkdirSync(agentDir, { recursive: true });

  const linkPath = path.join(agentDir, skillName);

  // Remove existing symlink or directory
  if (fs.existsSync(linkPath)) {
    const stat = fs.lstatSync(linkPath);
    if (stat.isSymbolicLink()) {
      fs.unlinkSync(linkPath);
    } else {
      throw new Error(
        `${linkPath} already exists and is not a symlink. Remove it manually to proceed.`
      );
    }
  }

  fs.symlinkSync(cachePath, linkPath);
}

export function skillExistsInCache(
  registry: RegistryInfo,
  skillName: string
): boolean {
  return fs.existsSync(getCachePath(registry, skillName));
}
