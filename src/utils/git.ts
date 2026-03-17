import { spawnSync } from "child_process";
import path from "path";

export interface GitRepoContext {
  repo: string;
  repoRoot: string;
  relPath: string;
}

/**
 * Returns git repo context for a path if it belongs to a GitHub-tracked repo,
 * or null otherwise.
 */
export function detectRepoContext(absPath: string): GitRepoContext | null {
  const rootResult = spawnSync("git", ["-C", absPath, "rev-parse", "--show-toplevel"], {
    encoding: "utf-8", stdio: "pipe",
  });
  if (rootResult.status !== 0) return null;
  const repoRoot = rootResult.stdout.trim();

  const remoteResult = spawnSync("git", ["-C", repoRoot, "remote", "get-url", "origin"], {
    encoding: "utf-8", stdio: "pipe",
  });
  if (remoteResult.status !== 0) return null;
  const remoteUrl = remoteResult.stdout.trim();

  const match =
    remoteUrl.match(/github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?$/) ??
    remoteUrl.match(/github\.com\/([^/]+\/[^/]+)/);
  if (!match) return null;

  const repo = match[1].replace(/\.git$/, "");
  const relPath = path.relative(repoRoot, absPath).replace(/\\/g, "/");
  return { repo, repoRoot, relPath };
}
